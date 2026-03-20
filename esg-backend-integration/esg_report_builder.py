"""
esg_report_builder.py
─────────────────────────────────────────────────────────────────────────────
목적:
    framword.json의 보고서 목차를 기반으로 Supabase 데이터를 조합하여
    ESG 보고서 HTML을 생성합니다.

데이터 파이프라인:
    framword.json (indicator_ids)
        → indicators.id                         (지표 메타)
        → data_points.data_id == indicators.id  (data_point 정의 + unit)
        → standardized_data.data_point_id
              == data_points.id                 (실제 측정값)

출력:
    esg_report_output.html

설계 원칙:
    - DB / API 호출은 시작 시 1회 일괄 수행 (반복 호출 없음)
    - 각 레이어(fetch → build → render)를 명확히 분리
    - 외부 시스템(DB, OpenAI) 오류는 경계에서 처리, 보고서 생성은 계속
    - 단위(unit)는 반드시 data_points 테이블 기준으로 표기
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from typing import Any

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

# ── 설정 ──────────────────────────────────────────────────────────────────────

FRAMEWORK_FILE = "framword.json"
OUTPUT_FILE    = "esg_report_output.html"
OPENAI_MODEL   = "gpt-4o-mini"

# ── 환경 변수 ──────────────────────────────────────────────────────────────────

load_dotenv(".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
OPENAI_KEY   = os.environ.get("OPENAI_API_KEY", "")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. 데이터 fetch 레이어
#    - DB 연결 및 전체 데이터를 한 번에 로드하여 메모리에 캐시합니다.
# ═══════════════════════════════════════════════════════════════════════════════

def _get_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_KEY 환경 변수가 없습니다.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def load_framework() -> dict:
    """framword.json을 읽어 보고서 목차 구조를 반환합니다."""
    with open(FRAMEWORK_FILE, encoding="utf-8") as f:
        return json.load(f)


def fetch_all_db_data() -> tuple[
    dict[int, dict],       # indicators_map      : id → indicator row
    dict[int, list[dict]], # dp_by_indicator     : indicator_id → [data_point rows]
    dict[int, list[dict]], # sd_by_dp_id         : data_point_id → [standardized_data rows]
]:
    """
    Supabase에서 필요한 테이블 3개를 일괄 조회합니다.

    Returns
    -------
    indicators_map : {indicator.id: indicator_row}
    dp_by_indicator : {indicator_id: [data_point_rows]}
        data_points.data_id == indicators.id 로 그룹핑
    sd_by_dp_id : {data_point_id: [standardized_data_rows]}
        standardized_data.data_point_id == data_points.id 로 그룹핑
    """
    client = _get_supabase()

    # indicators: 전체 조회 (issue_id 포함 — _get_active_issue_ids에서 사용)
    ind_rows = client.table("indicators").select(
        "id, name, indicator_code, disclosure_title, issue_id"
    ).execute().data
    indicators_map: dict[int, dict] = {r["id"]: r for r in ind_rows}

    # data_points: embedding 컬럼 제외
    dp_rows = client.table("data_points").select(
        "id, name, unit, data_type, definition, data_id"
    ).execute().data

    # data_points를 indicator_id(data_id) 기준으로 그룹핑
    dp_by_indicator: dict[int, list[dict]] = {}
    for dp in dp_rows:
        ind_id = dp["data_id"]
        if ind_id is None:
            continue
        dp_by_indicator.setdefault(ind_id, []).append(dp)

    # standardized_data: 실측값 전체 조회
    sd_rows = client.table("standardized_data").select(
        "id, data_point_id, site_id, reporting_date, value, unit"
    ).execute().data

    # standardized_data를 data_point_id 기준으로 그룹핑
    sd_by_dp_id: dict[int, list[dict]] = {}
    for sd in sd_rows:
        dp_id = sd["data_point_id"]
        if dp_id is None:
            continue
        sd_by_dp_id.setdefault(dp_id, []).append(sd)

    print(f"  [DB] indicators: {len(indicators_map)}개")
    print(f"  [DB] data_points: {len(dp_rows)}개")
    print(f"  [DB] standardized_data: {len(sd_rows)}개")

    return indicators_map, dp_by_indicator, sd_by_dp_id


# ═══════════════════════════════════════════════════════════════════════════════
# 2. 보고서 데이터 구조 빌드 레이어
#    - JSON 목차와 DB 데이터를 결합하여 section → item → data_point → rows
#      계층 구조의 순수 Python dict를 만듭니다.
#
#  [목차 필터링 로직]
#    standardized_data에 실제로 존재하는 data_point_id를 역추적하여
#    해당 issue_id를 확인하고, 그 issue_id에 속한 모든 목차 항목만 보고서에 포함합니다.
#
#    체인: sd.data_point_id → data_points.data_id (indicator_id)
#          → indicators.issue_id → active_issue_ids
#          → JSON items 중 해당 issue_id 소속 indicator를 포함한 항목만 선택
#
#    선택된 항목 내에서는 issue_id에 속하는 모든 data_point를 표시합니다.
#    (실측값 없는 data_point도 포함, 단 '데이터 없음'으로 명시)
# ═══════════════════════════════════════════════════════════════════════════════

def _sort_sd_rows(rows: list[dict]) -> list[dict]:
    """standardized_data 행을 보고기간 → 사이트 순으로 정렬합니다."""
    return sorted(rows, key=lambda r: (r.get("reporting_date") or "", r.get("site_id") or ""))


def _get_active_issue_ids(
    indicators_map: dict[int, dict],
    dp_by_indicator: dict[int, list[dict]],
    sd_by_dp_id: dict[int, list[dict]],
) -> set[int]:
    """
    standardized_data에 실측값이 존재하는 data_point_id들을 역추적하여
    관련 issue_id 집합을 반환합니다.

    추적 경로:
        sd_by_dp_id (active dp_ids)
          → dp_by_indicator에서 역방향 조회 → indicator_id
          → indicators_map → issue_id
    """
    # dp_id → indicator_id 역방향 매핑 구성
    dp_id_to_indicator_id: dict[int, int] = {
        dp["id"]: ind_id
        for ind_id, dp_list in dp_by_indicator.items()
        for dp in dp_list
    }

    active_issue_ids: set[int] = set()
    for dp_id in sd_by_dp_id:
        ind_id = dp_id_to_indicator_id.get(dp_id)
        if ind_id is None:
            continue
        indicator = indicators_map.get(ind_id)
        if indicator is None:
            continue
        issue_id = indicator.get("issue_id")
        if issue_id is not None:
            active_issue_ids.add(issue_id)

    return active_issue_ids


def build_report_structure(
    framework: dict,
    indicators_map: dict[int, dict],
    dp_by_indicator: dict[int, list[dict]],
    sd_by_dp_id: dict[int, list[dict]],
) -> list[dict]:
    """
    보고서 섹션 리스트를 반환합니다.

    목차 포함 기준:
        standardized_data에 데이터가 있는 issue_id에 속하는 JSON 항목만 포함합니다.
        포함된 항목 내에서는 해당 issue_id 소속 data_point 전체를 표시합니다.

    반환 구조 (중첩 dict):
    [
      {
        "label": "환경(E)",
        "esg_id": 1,
        "items": [
          {
            "title": "에너지 사용량",
            "context": "...",
            "data_points": [
              {
                "dp_name": "도시가스_소비량",
                "unit": "GJ",
                "indicator_code": "103-2-a",
                "has_data": True,
                "rows": [...]          # 빈 리스트면 실측값 없음
              }
            ]
          }
        ]
      }
    ]
    """
    # Step 1: standardized_data 기반 active issue_id 집합 추출
    active_issue_ids = _get_active_issue_ids(indicators_map, dp_by_indicator, sd_by_dp_id)
    print(f"  [Build] active issue_ids: {sorted(active_issue_ids)}")

    # Step 2: indicator_id → issue_id 빠른 조회용 매핑
    ind_id_to_issue_id: dict[int, int] = {
        ind_id: (ind.get("issue_id") or -1)
        for ind_id, ind in indicators_map.items()
    }

    sections = []

    for section in framework["sections"]:
        esg_id    = section.get("esg_id", 0)
        items_out = []

        for item_idx, item in enumerate(section["items"]):
            indicator_ids: list[int] = item.get("indicator_ids", [])

            # 이 항목이 active issue_id에 속하는 indicator를 하나라도 가지는지 확인
            item_issue_ids = {
                ind_id_to_issue_id[ind_id]
                for ind_id in indicator_ids
                if ind_id in ind_id_to_issue_id
            }
            if not (item_issue_ids & active_issue_ids):
                # 활성 issue_id와 겹치지 않으면 이 목차 항목은 제외
                continue

            # Step 3: 항목 내 모든 indicator의 모든 data_point를 수집
            #         실측값 유무와 관계없이 issue_id 소속 data_point 전체 포함
            data_points_out = []
            for ind_id in indicator_ids:
                indicator = indicators_map.get(ind_id)
                dp_list   = dp_by_indicator.get(ind_id, [])

                for dp in dp_list:
                    sd_rows  = sd_by_dp_id.get(dp["id"], [])
                    has_data = bool(sd_rows)

                    data_points_out.append({
                        "dp_id":          dp["id"],
                        "dp_name":        dp["name"],
                        "unit":           dp["unit"] or "-",  # 단위는 data_points 기준
                        "data_type":      dp["data_type"],
                        "indicator_code": indicator["indicator_code"] if indicator else "-",
                        "indicator_name": indicator["name"] if indicator else "-",
                        "has_data":       has_data,
                        "rows":           _sort_sd_rows(sd_rows) if has_data else [],
                    })

            # 실측값 있는 data_point를 앞에, 없는 것을 뒤에 배치
            data_points_out.sort(key=lambda dp: (0 if dp["has_data"] else 1))

            items_out.append({
                "field_id":    f"s{esg_id}_i{item_idx}",
                "title":       item["index"],
                "context":     item["index_context"],
                "data_points": data_points_out,
            })

        # 포함된 항목이 없는 섹션은 보고서에서 제외
        if items_out:
            sections.append({
                "label":  section["label"],
                "esg_id": section["esg_id"],
                "items":  items_out,
            })

    return sections


# ═══════════════════════════════════════════════════════════════════════════════
# 3. AI 코멘터리 레이어
#    - 실측 데이터가 있는 목차 항목별로 OpenAI에 2-3문장 해석을 요청합니다.
#    - API 키 미설정이나 호출 오류 시 fallback 문자열을 반환하며 계속 진행합니다.
# ═══════════════════════════════════════════════════════════════════════════════

def _build_data_summary_for_ai(data_points: list[dict]) -> str:
    """
    data_points 목록을 AI 프롬프트용 텍스트 요약으로 변환합니다.
    최신 6개월 데이터만 사용하여 토큰을 절약합니다.
    """
    lines = []
    for dp in data_points:
        rows = dp["rows"]
        unit = dp["unit"]
        # 최신 6개 row만 사용
        recent = rows[-6:] if len(rows) > 6 else rows
        value_str = ", ".join(
            f"{r['reporting_date'][:7]} {r['site_id']} {r['value']}{unit}"
            for r in recent
            if r.get("value") is not None
        )
        lines.append(f"- {dp['dp_name']} ({unit}): {value_str}")
    return "\n".join(lines)


def generate_ai_commentary(item_title: str, item_context: str, data_points: list[dict]) -> str:
    """
    재무 컨설턴트 관점의 2-3문장 한국어 해석을 생성합니다.

    OpenAI API 키가 없거나 호출 실패 시 fallback 문자열을 반환합니다.

    Parameters
    ----------
    item_title : str   - 목차 항목명
    item_context : str - 목차 항목 설명
    data_points : list - build_report_structure에서 생성된 data_points 목록
    """
    if not OPENAI_KEY:
        return "[OpenAI API Key가 설정되지 않아 ESG 해석을 생성하지 못했습니다.]"

    try:
        from openai import OpenAI
        oa_client = OpenAI(api_key=OPENAI_KEY)

        data_summary = _build_data_summary_for_ai(data_points)

        prompt = (
            f"당신은 ESG 보고서에 관련된 프로페셔널한 컨설턴트입니다.\n"
            f"아래 항목의 실측 데이터를 바탕으로, 데이터에 대해 설명하는 객관적이고 논리적인 2~3문장의 한국어 해석을 작성하세요.\n"
            f"이후 ESG에 대해 잘 알지 못하는 기업의 투자자에게 기업의 성과를 투명하게 설명해주세요. 성과는 긍정과 부정을 모두 포함합니다.\n"
            f"수치를 직접 언급하되, 추가적인 맥락 없이 추측성 표현은 피하십시오.\n\n"
            f"### 항목명\n{item_title}\n\n"
            f"### 항목 설명\n{item_context}\n\n"
            f"### 실측 데이터 요약\n{data_summary}"
        )

        response = oa_client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    except Exception as e:
        # API 오류가 보고서 전체 생성을 막지 않도록 fallback
        return f"[ESG 해석 생성 실패: {type(e).__name__}]"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. HTML 렌더링 레이어
#    - 구조화된 Python dict → HTML 문자열 변환
#    - 프론트엔드 팀이 CSS를 추가할 수 있도록 class/data 속성을 명시합니다.
# ═══════════════════════════════════════════════════════════════════════════════

def _fmt_value(value: Any, data_type: str) -> str:
    """값을 data_type에 따라 포맷합니다."""
    if value is None:
        return "-"
    if data_type == "numeric":
        try:
            num = float(value)
            # 정수면 콤마만, 소수면 소수점 3자리까지
            return f"{num:,.0f}" if num == int(num) else f"{num:,.3f}"
        except (ValueError, TypeError):
            return str(value)
    return str(value)


def _fmt_date(date_str: str | None) -> str:
    """'2023-01-01' → '2023년 01월' 형식으로 변환합니다."""
    if not date_str:
        return "-"
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").strftime("%Y년 %m월")
    except ValueError:
        return date_str[:10]


def render_dp_table(dp: dict) -> str:
    """
    단일 data_point의 standardized_data 행을 HTML 테이블로 렌더링합니다.

    테이블 구조:
      보고기간 | 사이트 | 측정값 ({unit})
    """
    unit      = dp["unit"]
    data_type = dp["data_type"]
    rows      = dp["rows"]

    col_value = f"측정값 ({unit})"

    html = (
        f'<div class="dp-block" data-dp-id="{dp["dp_id"]}">'
        f'<p class="dp-label">'
        f'  <span class="indicator-code">{dp["indicator_code"]}</span>'
        f'  {dp["dp_name"]}'
        f'</p>'
        f'<table class="data-table">'
        f'<thead><tr>'
        f'<th>보고기간</th>'
        f'<th>사이트</th>'
        f'<th>{col_value}</th>'
        f'</tr></thead>'
        f'<tbody>'
    )

    for row in rows:
        date_str = _fmt_date(row.get("reporting_date"))
        site     = row.get("site_id") or "-"
        val_str  = _fmt_value(row.get("value"), data_type)
        html += (
            f'<tr>'
            f'<td>{date_str}</td>'
            f'<td>{site}</td>'
            f'<td class="val-cell">{val_str}</td>'
            f'</tr>'
        )

    html += '</tbody></table></div>'
    return html


def render_item(item: dict, commentary: str) -> str:
    """
    목차 항목 1개를 HTML 블록으로 렌더링합니다.

    구성:
      - 항목 제목 + 컨텍스트 설명
      - data_point 테이블들 (병렬 나열, 실측값 없는 경우 안내 표시)
      - ESG 관점 해석 (AI 코멘터리)
    """
    fid  = item["field_id"]
    html = (
        f'<div class="report-item" data-field-id="{fid}">'
        f'<h3 class="item-title">{item["title"]}</h3>'
        f'<p class="item-context"'
        f'   data-field-id="{fid}" data-field-type="context" data-editable="true">'
        f'{item["context"]}</p>'
    )

    if not item["data_points"]:
        html += '<p class="no-data-notice">[ 연결된 data_point 없음 ]</p>'
    else:
        html += '<div class="dp-tables">'
        for dp in item["data_points"]:
            if dp["has_data"]:
                html += render_dp_table(dp)
            else:
                # 실측값은 없지만 issue_id 소속이므로 항목명은 표시
                html += (
                    f'<div class="dp-block dp-no-data" data-dp-id="{dp["dp_id"]}">'
                    f'<p class="dp-label">'
                    f'  <span class="indicator-code">{dp["indicator_code"]}</span>'
                    f'  {dp["dp_name"]}'
                    f'  <span class="no-data-badge">입력된 데이터가 없습니다.</span>'
                    f'</p>'
                    f'</div>'
                )
        html += '</div>'

    # ESG 관점 해석 박스 (PDF 포맷 참고)
    html += (
        f'<div class="esg-commentary">'
        f'<p class="commentary-label">ESG 관점 해석</p>'
        f'<p class="commentary-text"'
        f'   data-field-id="{fid}" data-field-type="commentary" data-editable="true">'
        f'{commentary}</p>'
        f'</div>'
    )

    html += '</div>'
    return html


def render_section(section: dict, items_html: list[str]) -> str:
    """섹션(총괄편/환경E/사회S/지배구조G) 블록을 렌더링합니다."""
    label  = section["label"]
    html = (
        f'<section class="report-section" data-esg-id="{section["esg_id"]}">'
        f'<h2 class="section-title">{label}</h2>'
    )
    html += "\n".join(items_html)
    html += "</section>"
    return html


def render_full_html(sections_html: list[str], generated_at: str) -> str:
    """전체 HTML 문서를 반환합니다. 스타일은 최소한만 포함합니다."""
    body = "\n".join(sections_html)
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ESG 보고서</title>
<style>
  /* ── 기본 레이아웃 (프론트팀이 교체 예정) ── */
  body {{ font-family: 'Malgun Gothic', sans-serif; margin: 40px; color: #2D3748; }}
  .report-section {{ margin-bottom: 48px; }}
  .section-title {{ font-size: 22px; border-left: 6px solid #2B6CB0; padding-left: 12px; margin-bottom: 20px; }}
  .report-item {{ margin-bottom: 32px; padding: 20px; border: 1px solid #E2E8F0; border-radius: 6px; }}
  .item-title {{ font-size: 17px; margin-bottom: 6px; }}
  .item-context {{ font-size: 13px; color: #718096; border-left: 3px solid #CBD5E0; padding-left: 8px; margin-bottom: 16px; }}
  .dp-tables {{ display: flex; flex-wrap: wrap; gap: 20px; }}
  .dp-block {{ flex: 1; min-width: 280px; }}
  .dp-label {{ font-size: 13px; font-weight: 600; margin-bottom: 6px; }}
  .indicator-code {{ background:#EDF2F7; border-radius:3px; padding:1px 6px; font-size:11px; margin-right:6px; }}
  .data-table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  .data-table th {{ background:#2B6CB0; color:#fff; padding:8px 10px; text-align:left; }}
  .data-table td {{ padding:7px 10px; border-bottom:1px solid #E2E8F0; }}
  .data-table tr:nth-child(even) td {{ background:#F7FAFC; }}
  .val-cell {{ text-align:right; font-variant-numeric:tabular-nums; }}
  .no-data-notice {{ color:#A0AEC0; font-style:italic; font-size:13px; }}
  .dp-no-data {{ opacity:0.55; }}
  .no-data-badge {{ color:#A0AEC0; font-size:11px; font-style:italic; margin-left:8px; }}
  .esg-commentary {{ margin-top:16px; background:#EBF8FF; border:1px solid #BEE3F8; border-radius:4px; padding:12px 16px; }}
  .commentary-label {{ font-size:12px; font-weight:700; color:#2B6CB0; margin-bottom:6px; }}
  .commentary-text {{ font-size:13px; line-height:1.7; color:#2D3748; white-space:pre-line; }}
</style>
</head>
<body>
<h1>ESG 보고서 프레임워크</h1>
<p style="color:#718096;font-size:13px;">생성일시: {generated_at}</p>
{body}
<footer style="margin-top:60px;text-align:center;font-size:12px;color:#A0AEC0;">
  본 보고서는 Supabase standardized_data 기반으로 AI(OpenAI {OPENAI_MODEL})가 ESG 관점 해석을 자동 생성한 문서입니다.
</footer>
</body>
</html>
"""


# ═══════════════════════════════════════════════════════════════════════════════
# 5. 메인 오케스트레이터
# ═══════════════════════════════════════════════════════════════════════════════

def generate_report(output_path: str = OUTPUT_FILE) -> None:
    """
    보고서 전체 생성 파이프라인을 실행합니다.

    Steps:
      1. framword.json 로드
      2. Supabase 3개 테이블 일괄 조회
      3. 섹션-아이템-data_point 계층 구조 빌드
      4. 각 아이템별 HTML 렌더링 + AI 코멘터리 생성
      5. HTML 파일 저장
    """
    print("[1/5] 프레임워크 JSON 로드...")
    framework = load_framework()

    print("[2/5] Supabase 데이터 조회...")
    indicators_map, dp_by_indicator, sd_by_dp_id = fetch_all_db_data()

    print("[3/5] 보고서 구조 빌드...")
    sections = build_report_structure(
        framework, indicators_map, dp_by_indicator, sd_by_dp_id
    )

    print("[4/5] HTML 렌더링 + AI 코멘터리 생성...")
    sections_html = []
    total_items    = sum(len(s["items"]) for s in sections)
    item_count     = 0

    for section in sections:
        items_html = []

        for item in section["items"]:
            item_count += 1

            # AI 코멘터리: 실측값이 있는 data_point가 하나라도 있는 항목만 생성
            dps_with_data = [dp for dp in item["data_points"] if dp["has_data"]]
            if dps_with_data:
                print(f"  [{item_count}/{total_items}] AI 코멘터리 생성: {item['title']}")
                commentary = generate_ai_commentary(
                    item["title"],
                    item["context"],
                    dps_with_data,
                )
            else:
                commentary = "[해당 항목에 연결된 실측 데이터가 없습니다.]"

            # commentary를 item에 저장 → 초안 JSON에서 편집 가능하도록
            item["commentary"] = commentary
            items_html.append(render_item(item, commentary))

        sections_html.append(render_section(section, items_html))

    print("[5/5] HTML + 초안 JSON 저장...")
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    html = render_full_html(sections_html, generated_at)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    # 편집 가능한 초안 JSON 저장 (output 파일명에서 확장자만 변경)
    draft_path = output_path.rsplit(".", 1)[0] + "_draft.json"
    from report_editor import save_draft
    save_draft(sections, draft_path)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n[완료] 보고서 저장: {output_path} ({size_kb:.1f} KB)")
    print(f"[완료] 초안 JSON 저장: {draft_path}")


# ── 직접 실행 ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    output = sys.argv[1] if len(sys.argv) > 1 else OUTPUT_FILE
    generate_report(output_path=output)
