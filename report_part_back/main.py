"""
main.py — ESG 보고서 FastAPI 서버 v2
──────────────────────────────────────────────────────────────
실행:
    uvicorn main:app --reload --port 8000

데이터 흐름 (역방향 계층):
    standardized_data.data_point_id
        → data_points.data_id → data.indicator_id
        → indicators.issue_id → issues.esg_category_id
        → esg_category

목차 구조:
    대목차: esg_category.name
    중목차: indicators.name
    소목차: standardized_data.metric_name

엔드포인트:
    POST /api/report/generate?year=YYYY   보고서 생성 (기본값: 당해년도)
    GET  /api/report/draft                현재 초안 반환
    PATCH /api/report/draft/commentary    중목차 코멘터리 수정 (실시간 저장)
    POST /api/report/reset                초안을 원본으로 초기화
    POST /api/report/export               파일 내보내기 (pdf/docx/hwp)
    GET  /health                          헬스 체크
"""

from __future__ import annotations

import json
import os
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from supabase import create_client, Client

# ── 환경 변수 ──────────────────────────────────────────────────────────────────

load_dotenv(".env")

SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_KEY", "")
OPENAI_KEY    = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL  = "gpt-4o-mini"
DRAFT_PATH    = "draft.json"
EXPORT_DIR    = "exports"

# ── FastAPI 앱 ─────────────────────────────────────────────────────────────────

app = FastAPI(title="ESG Report API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173",
                   "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# 1. Supabase 데이터 조회
# ══════════════════════════════════════════════════════════════════════════════

def _get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_KEY 환경 변수가 없습니다.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_all_data(year: int) -> dict:
    """
    보고서 생성에 필요한 모든 테이블을 일괄 조회합니다.
    standardized_data는 선택된 연도의 데이터만 가져옵니다.
    """
    client = _get_supabase()

    cats       = {r["id"]: r for r in client.table("esg_category").select("*").execute().data}
    issues_map = {r["id"]: r for r in client.table("issues").select("*").execute().data}
    inds       = {r["id"]: r for r in client.table("indicators")
                  .select("id,name,issue_id,indicator_code,requirement_text").execute().data}
    data_tbl   = {r["id"]: r for r in client.table("data")
                  .select("id,name,indicator_id").execute().data}
    dps        = {r["id"]: r for r in client.table("data_points")
                  .select("id,name,unit,data_type,data_id").execute().data}
    sd_rows    = (
        client.table("standardized_data")
        .select("id,data_point_id,site_id,reporting_date,metric_name,value,unit")
        .gte("reporting_date", f"{year}-01-01")
        .lte("reporting_date", f"{year}-12-31")
        .execute().data
    )

    print(f"  [DB] esg_category:{len(cats)} issues:{len(issues_map)} "
          f"indicators:{len(inds)} data:{len(data_tbl)} "
          f"data_points:{len(dps)} standardized_data({year}):{len(sd_rows)}")

    return {
        "cats": cats,
        "issues": issues_map,
        "inds": inds,
        "data_tbl": data_tbl,
        "dps": dps,
        "sd_rows": sd_rows,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 2. 시각화 타입 결정 및 데이터 집계
# ══════════════════════════════════════════════════════════════════════════════

# 카운트성 단위 → 테이블 기본
_TABLE_UNITS = {"명", "건", "시간", "개소", "개사", "개", "개업체"}

# 꺾은선: 위험/사고/부상 등 월별 추이가 의미 있는 지표
# (단위가 카운트성이면서 아래 키워드를 포함하면 line으로 분류)
_LINE_KEYWORDS = {"위험", "사망", "부상", "질병", "발생", "사고"}

# 분류별 연간 합계: 성별/연령대/지역별 등 범주형 분해 지표
# (월별 추이보다 연간 집계 비교가 의미 있는 지표)
_BREAKDOWN_KEYWORDS = {"성별", "연령대", "지역별", "직급별", "부서별"}


def _chart_type(unit: str, data_type: str, metric_name: str = "") -> str:
    """
    단위·데이터타입·지표명을 기반으로 시각화 방식을 결정합니다.

    bar           : 연속형 수치 (MWh, tCO2e, Nm3 등) → 월별 막대 차트
    donut         : 비율 (%) → 도넛 차트
    line          : 위험·사고·부상 등 카운트 추이 → 꺾은선 그래프
    breakdown_bar : 성별·연령대·지역별 분류 카운트 → 연간 합계 가로 막대
    table         : 기타 카운트 (명, 건, 시간 등) → 월별 테이블
    text          : 텍스트 데이터 → 텍스트 블록
    """
    if data_type in ("text", "Text") or unit in ("Text", "text", ""):
        return "text"
    if unit == "%":
        return "donut"
    if unit in _TABLE_UNITS:
        if any(kw in metric_name for kw in _LINE_KEYWORDS):
            return "line"
        if any(kw in metric_name for kw in _BREAKDOWN_KEYWORDS):
            return "breakdown_bar"
        return "table"
    return "bar"


def _aggregate_metric(rows: list[dict], unit: str) -> dict:
    """
    월별 행(rows)을 연간 집계 데이터로 변환합니다.

    % 단위 → 연간 평균
    그 외   → 연간 합계

    반환 형태:
    {
        "by_site"         : { site_id: annual_value },
        "monthly_by_site" : { site_id: { "YYYY-MM": value } },
        "total"           : 전체 합산(or 평균),
        "is_rate"         : bool,
        "months"          : ["YYYY-MM", ...]
    }
    """
    is_rate = unit == "%"

    by_site_monthly: dict[str, dict[str, float]] = defaultdict(dict)
    for r in rows:
        if r["value"] is None:
            continue
        site  = r["site_id"] or "전체"
        month = (r["reporting_date"] or "")[:7]
        by_site_monthly[site][month] = float(r["value"])

    by_site: dict[str, float] = {}
    for site, monthly in by_site_monthly.items():
        vals = list(monthly.values())
        by_site[site] = round(sum(vals) / len(vals), 3) if is_rate else round(sum(vals), 3)

    all_vals = [v for vals in by_site_monthly.values() for v in vals.values()]
    if not all_vals:
        total = 0.0
    elif is_rate:
        total = round(sum(all_vals) / len(all_vals), 3)
    else:
        total = round(sum(all_vals), 3)

    months = sorted({m for monthly in by_site_monthly.values() for m in monthly})

    return {
        "by_site":          dict(by_site),
        "monthly_by_site":  {s: dict(m) for s, m in by_site_monthly.items()},
        "total":            total,
        "is_rate":          is_rate,
        "months":           months,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 3. 보고서 계층 구조 빌드
#    esg_category → indicators → metric_name
# ══════════════════════════════════════════════════════════════════════════════

def build_report_structure(db: dict, year: int) -> list[dict]:
    """
    DB 데이터를 바탕으로 대목차 → 중목차 → 소목차 계층 구조를 빌드합니다.

    반환 구조:
    [
      {
        "category_id"  : 1,
        "category_name": "Environmental",
        "category_code": "E",
        "indicators": [
          {
            "indicator_id"   : 5,
            "indicator_name" : "GHG 배출량 감축 목표 및 진척도",
            "requirement_text": "...",
            "commentary"     : {"original": "", "current": "", "last_modified": null},
            "metrics": [
              {
                "metric_name": "기준 연도 Scope 1, 2, 3 배출량",
                "unit"       : "tCO₂e",
                "chart_type" : "bar",
                "aggregated" : { ... }
              }
            ]
          }
        ]
      }
    ]
    """
    cats       = db["cats"]
    issues_map = db["issues"]
    inds       = db["inds"]
    data_tbl   = db["data_tbl"]
    dps        = db["dps"]
    sd_rows    = db["sd_rows"]

    # dp_id → 계층 메타 매핑
    dp_to_chain: dict[int, dict] = {}
    for dp_id, dp in dps.items():
        d   = data_tbl.get(dp["data_id"])
        if not d:
            continue
        ind = inds.get(d["indicator_id"])
        if not ind:
            continue
        issue = issues_map.get(ind["issue_id"])
        if not issue:
            continue
        cat = cats.get(issue["esg_category_id"])
        if not cat:
            continue
        dp_to_chain[dp_id] = {"dp": dp, "ind": ind, "cat": cat}

    # cat_id → ind_id → metric_name → rows
    tree: dict[int, dict[int, dict[str, list]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    cat_meta: dict[int, dict] = {}
    ind_meta: dict[int, dict] = {}

    for sd in sd_rows:
        chain = dp_to_chain.get(sd["data_point_id"])
        if not chain:
            continue
        cat_id = chain["cat"]["id"]
        ind_id = chain["ind"]["id"]
        cat_meta[cat_id] = chain["cat"]
        ind_meta[ind_id] = chain["ind"]
        tree[cat_id][ind_id][sd["metric_name"]].append(sd)

    sections: list[dict] = []

    for cat_id in sorted(tree.keys()):
        cat = cat_meta[cat_id]
        indicators_out: list[dict] = []

        for ind_id in sorted(tree[cat_id].keys()):
            ind = ind_meta[ind_id]
            metrics_out: list[dict] = []

            for metric_name, rows in tree[cat_id][ind_id].items():
                # unit / data_type는 첫 번째 행 기준
                first_dp = dps.get(rows[0]["data_point_id"]) if rows else {}
                unit      = rows[0]["unit"] if rows else ""
                data_type = (first_dp.get("data_type") or "numeric") if first_dp else "numeric"

                metrics_out.append({
                    "metric_name": metric_name,
                    "unit":        unit,
                    "chart_type":  _chart_type(unit, data_type, metric_name),
                    "aggregated":  _aggregate_metric(rows, unit),
                })

            indicators_out.append({
                "indicator_id":    ind_id,
                "indicator_name":  ind["name"],
                "requirement_text": ind.get("requirement_text") or "",
                "commentary": {
                    "original":      "",   # LLM 생성 후 채워짐
                    "current":       "",
                    "last_modified": None,
                },
                "metrics": metrics_out,
            })

        sections.append({
            "category_id":   cat_id,
            "category_name": cat["name"],
            "category_code": cat.get("code", ""),
            "indicators":    indicators_out,
        })

    return sections


# ══════════════════════════════════════════════════════════════════════════════
# 4. LLM 코멘터리 생성
# ══════════════════════════════════════════════════════════════════════════════

def _build_data_summary(indicator: dict, year: int) -> str:
    """LLM 프롬프트용 데이터 요약 문자열을 생성합니다."""
    lines: list[str] = []
    for m in indicator["metrics"]:
        if m["chart_type"] == "text":
            continue
        agg = m["aggregated"]
        for site, val in agg["by_site"].items():
            label = "연평균" if agg["is_rate"] else "연간합계"
            lines.append(f"- {m['metric_name']} ({site}): {label} {val} {m['unit']}")
    return "\n".join(lines) if lines else "수치 데이터 없음"


def generate_commentary(indicator: dict, year: int) -> str:
    """
    지표별 ESG 성과를 일반인도 이해할 수 있게 설명하는
    5줄 이내 한국어 코멘터리를 생성합니다.
    """
    if not OPENAI_KEY:
        return "[OpenAI API Key가 설정되지 않았습니다.]"

    try:
        from openai import OpenAI
        oa_client = OpenAI(api_key=OPENAI_KEY)

        data_summary = _build_data_summary(indicator, year)

        prompt = (
            f"당신은 ESG 보고서 전문가입니다.\n"
            f"아래 {year}년도 ESG 지표 데이터를 바탕으로, ESG를 잘 모르는 일반인도 이해할 수 있도록 "
            f"친절하고 쉬운 언어로 5줄 이내의 한국어 성과 설명을 작성하세요.\n"
            f"수치를 직접 인용하되, 긍정적 성과와 개선이 필요한 부분을 균형 있게 서술하세요.\n"
            f"전문 용어보다는 누구나 알 수 있는 쉬운 표현을 우선 사용하세요.\n\n"
            f"### 지표명\n{indicator['indicator_name']}\n\n"
            f"### 지표 설명\n{indicator['requirement_text']}\n\n"
            f"### {year}년 실측 데이터\n{data_summary}"
        )

        response = oa_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        return f"[LLM 생성 실패: {type(e).__name__}: {e}]"


# ══════════════════════════════════════════════════════════════════════════════
# 5. 초안 파일 관리 (저장 / 로드)
# ══════════════════════════════════════════════════════════════════════════════

def _save_draft(draft: dict) -> None:
    with open(DRAFT_PATH, "w", encoding="utf-8") as f:
        json.dump(draft, f, ensure_ascii=False, indent=2, default=str)


def _load_draft() -> dict:
    if not Path(DRAFT_PATH).exists():
        raise FileNotFoundError("초안 파일이 없습니다. 먼저 보고서를 생성하세요.")
    with open(DRAFT_PATH, encoding="utf-8") as f:
        return json.load(f)


# ══════════════════════════════════════════════════════════════════════════════
# 6. 보고서 생성 오케스트레이터
# ══════════════════════════════════════════════════════════════════════════════

def generate_report(year: int) -> dict:
    """
    전체 보고서 생성 파이프라인을 실행합니다.

    Steps:
      1. Supabase 전체 테이블 조회 (선택 연도 기준)
      2. 대/중/소목차 계층 구조 빌드
      3. 중목차(indicators)별 LLM 코멘터리 생성
      4. 직전년도 데이터 조회 및 구조 빌드 (시각화 전용, 코멘터리 없음)
      5. 초안 JSON 파일로 저장
    """
    print(f"\n[1/4] Supabase 데이터 조회 ({year}년)...")
    db = fetch_all_data(year)

    print("[2/4] 보고서 계층 구조 빌드...")
    sections = build_report_structure(db, year)

    total = sum(len(s["indicators"]) for s in sections)
    print(f"[3/4] LLM 코멘터리 생성 (총 {total}개 중목차)...")
    count = 0
    for section in sections:
        for ind in section["indicators"]:
            count += 1
            print(f"  [{count}/{total}] {ind['indicator_name']}")
            commentary = generate_commentary(ind, year)
            ind["commentary"]["original"] = commentary
            ind["commentary"]["current"]  = commentary

    prev_year = year - 1
    print(f"[4/4] 직전년도 데이터 조회 ({prev_year}년)...")
    try:
        prev_db = fetch_all_data(prev_year)
        prev_sections_raw = build_report_structure(prev_db, prev_year)
        # 직전년도는 시각화만 필요하므로 commentary 필드 제거
        prev_sections: list[dict] = []
        for sec in prev_sections_raw:
            prev_sections.append({
                **sec,
                "indicators": [
                    {k: v for k, v in ind.items() if k != "commentary"}
                    for ind in sec["indicators"]
                ],
            })
    except Exception as e:
        print(f"  직전년도 데이터 없음 또는 오류: {e}")
        prev_sections = []

    draft = {
        "draft_id":      str(uuid.uuid4()),
        "year":          year,
        "prev_year":     prev_year,
        "generated_at":  datetime.now().isoformat(timespec="seconds"),
        "version":       1,
        "sections":      sections,
        "prev_sections": prev_sections,
    }

    _save_draft(draft)
    print(f"\n[완료] 초안 저장 → {DRAFT_PATH}")
    return draft


# ══════════════════════════════════════════════════════════════════════════════
# 7. 내보내기 어댑터
#    report_exporter.py가 기대하는 형식으로 초안을 변환합니다.
# ══════════════════════════════════════════════════════════════════════════════

def _to_export_format(draft: dict) -> dict:
    """
    새 초안 형식 → report_exporter.py 호환 형식으로 변환합니다.

    exporter가 기대하는 구조:
        sections[].items[].{title, context.current, commentary.current, data_points[]}
        data_points[].{has_data, dp_name, unit, data_type, rows[]}
        rows[].{reporting_date, site_id, value}
    """
    sections_out: list[dict] = []

    for section in draft["sections"]:
        items_out: list[dict] = []

        for i, ind in enumerate(section["indicators"]):
            dp_list: list[dict] = []

            for m in ind["metrics"]:
                agg   = m["aggregated"]
                rows_ = [
                    {
                        "reporting_date": f"{month}-01",
                        "site_id":        site,
                        "value":          val,
                    }
                    for site, monthly in agg.get("monthly_by_site", {}).items()
                    for month, val in monthly.items()
                ]
                dp_list.append({
                    "has_data":       bool(rows_),
                    "indicator_code": "",
                    "dp_name":        m["metric_name"],
                    "unit":           m["unit"],
                    "data_type":      "numeric" if m["chart_type"] != "text" else "text",
                    "chart_type":     m["chart_type"],
                    "aggregated":     m["aggregated"],
                    "rows":           rows_,
                })

            items_out.append({
                "field_id":   f"c{section['category_id']}_i{i}",
                "title":      ind["indicator_name"],
                "context":    {"current": ind.get("requirement_text", "")},
                "commentary": {"current": ind["commentary"]["current"]},
                "data_points": dp_list,
            })

        sections_out.append({
            "label":  f"[{section['category_code']}] {section['category_name']}",
            "esg_id": section["category_id"],
            "items":  items_out,
        })

    return {
        "draft_id":     draft.get("draft_id", ""),
        "generated_at": draft.get("generated_at", ""),
        "version":      draft.get("version", 1),
        "sections":     sections_out,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 8. FastAPI 엔드포인트
# ══════════════════════════════════════════════════════════════════════════════

# ── 8-1. 보고서 생성 ──────────────────────────────────────────────────────────

@app.post("/api/report/generate")
async def api_generate(year: Optional[int] = Query(default=None)):
    """
    보고서 생성 파이프라인을 실행합니다.

    - year 미지정 시 서버 실행 당해년도 기준
    - Supabase 조회 → 계층 구조 빌드 → LLM 코멘터리 생성 → 초안 저장
    - 소요 시간: 중목차 수 × 약 2~3초 (OpenAI API)
    """
    target_year = year if year is not None else datetime.now().year
    try:
        draft = generate_report(target_year)
        return draft
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보고서 생성 실패: {e}")


# ── 8-2. 초안 조회 ────────────────────────────────────────────────────────────

@app.get("/api/report/draft")
async def api_get_draft():
    """저장된 초안을 반환합니다."""
    try:
        return _load_draft()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 8-3. 코멘터리 수정 (실시간 저장) ──────────────────────────────────────────

class UpdateCommentaryRequest(BaseModel):
    indicator_id: int
    new_value:    str


@app.patch("/api/report/draft/commentary")
async def api_update_commentary(body: UpdateCommentaryRequest):
    """
    특정 중목차(indicator)의 코멘터리를 수정하고 즉시 파일에 저장합니다.
    original 값은 보존되며, current와 last_modified만 갱신됩니다.
    """
    try:
        draft = _load_draft()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    for section in draft["sections"]:
        for ind in section["indicators"]:
            if ind["indicator_id"] == body.indicator_id:
                ind["commentary"]["current"]       = body.new_value
                ind["commentary"]["last_modified"] = datetime.now().isoformat(timespec="seconds")
                draft["version"] += 1
                _save_draft(draft)
                return {"ok": True, "indicator_id": body.indicator_id}

    raise HTTPException(
        status_code=404,
        detail=f"indicator_id={body.indicator_id}를 찾을 수 없습니다."
    )


# ── 8-4. 초안 초기화 ──────────────────────────────────────────────────────────

@app.post("/api/report/reset")
async def api_reset():
    """
    모든 코멘터리를 LLM이 처음 생성한 original 값으로 되돌립니다.
    데이터(metrics)는 변경되지 않습니다.
    """
    try:
        draft = _load_draft()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    for section in draft["sections"]:
        for ind in section["indicators"]:
            ind["commentary"]["current"]       = ind["commentary"]["original"]
            ind["commentary"]["last_modified"] = None

    draft["version"] = 1
    _save_draft(draft)
    return {"ok": True, "message": "초안이 원본으로 초기화되었습니다."}


# ── 8-5. 파일 내보내기 ────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    format: Literal["pdf", "docx", "hwp"] = "pdf"


@app.post("/api/report/export")
async def api_export(body: ExportRequest):
    """
    현재 초안을 지정된 포맷으로 내보냅니다.
    HWP는 LibreOffice 설치가 필요합니다.
    """
    try:
        draft = _load_draft()
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    export_draft = _to_export_format(draft)

    try:
        from report_exporter import export_report, HWPExportError
        file_path = export_report(export_draft, output_dir=EXPORT_DIR, fmt=body.format)
    except Exception as e:
        # HWPExportError 포함 처리
        status = 422 if "HWP" in type(e).__name__ else 500
        raise HTTPException(status_code=status, detail=str(e))

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="파일 생성에 실패했습니다.")

    media_types = {
        "pdf":  "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "hwp":  "application/x-hwp",
    }
    return FileResponse(
        path=file_path,
        media_type=media_types[body.format],
        filename=os.path.basename(file_path),
        headers={"Content-Disposition": f'attachment; filename="{os.path.basename(file_path)}"'},
    )


# ── 8-6. 헬스 체크 ────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    draft_exists = Path(DRAFT_PATH).exists()
    year = None
    if draft_exists:
        try:
            year = _load_draft().get("year")
        except Exception:
            pass
    return {
        "status":       "ok",
        "draft_exists": draft_exists,
        "draft_year":   year,
    }
