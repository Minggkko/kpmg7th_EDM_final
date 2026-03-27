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
    esg_report_output.html + esg_report_output_draft.json

설계 원칙:
    - DB / API 호출은 시작 시 1회 일괄 수행 (반복 호출 없음)
    - 각 레이어(fetch → build → render)를 명확히 분리
    - 외부 시스템(DB, OpenAI) 오류는 경계에서 처리, 보고서 생성은 계속
    - 단위(unit)는 반드시 data_points 테이블 기준으로 표기
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from supabase import create_client, Client

from app.core.config import get_settings

# ── 상수 ──────────────────────────────────────────────────────────────────────

_SERVICE_DIR   = Path(__file__).parent
FRAMEWORK_FILE = str(_SERVICE_DIR / "framword.json")
OUTPUT_FILE    = str(_SERVICE_DIR / "esg_report_output.html")
OPENAI_MODEL   = "gpt-4o-mini"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. 데이터 fetch 레이어
# ═══════════════════════════════════════════════════════════════════════════════

def _get_supabase() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_anon_key)


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
    """
    client = _get_supabase()

    # indicators: 전체 조회
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
    """
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
    """
    active_issue_ids = _get_active_issue_ids(indicators_map, dp_by_indicator, sd_by_dp_id)
    print(f"  [Build] active issue_ids: {sorted(active_issue_ids)}")

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

            item_issue_ids = {
                ind_id_to_issue_id[ind_id]
                for ind_id in indicator_ids
                if ind_id in ind_id_to_issue_id
            }
            if not (item_issue_ids & active_issue_ids):
                continue

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
                        "unit":           dp["unit"] or "-",
                        "data_type":      dp["data_type"],
                        "indicator_code": indicator["indicator_code"] if indicator else "-",
                        "indicator_name": indicator["name"] if indicator else "-",
                        "has_data":       has_data,
                        "rows":           _sort_sd_rows(sd_rows) if has_data else [],
                    })

            data_points_out.sort(key=lambda dp: (0 if dp["has_data"] else 1))

            items_out.append({
                "field_id":    f"s{esg_id}_i{item_idx}",
                "title":       item["index"],
                "context":     item["index_context"],
                "data_points": data_points_out,
            })

        if items_out:
            sections.append({
                "label":  section["label"],
                "esg_id": section["esg_id"],
                "items":  items_out,
            })

    return sections


# ═══════════════════════════════════════════════════════════════════════════════
# 3. AI 코멘터리 레이어
# ═══════════════════════════════════════════════════════════════════════════════

def _build_data_summary_for_ai(data_points: list[dict]) -> str:
    """data_points 목록을 AI 프롬프트용 텍스트 요약으로 변환합니다."""
    lines = []
    for dp in data_points:
        rows = dp["rows"]
        unit = dp["unit"]
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
    """
    settings = get_settings()
    openai_key = settings.openai_api_key

    if not openai_key:
        return "[OpenAI API Key가 설정되지 않아 ESG 해석을 생성하지 못했습니다.]"

    try:
        from openai import OpenAI
        oa_client = OpenAI(api_key=openai_key)

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
        return f"[ESG 해석 생성 실패: {type(e).__name__}]"


# ═══════════════════════════════════════════════════════════════════════════════
# 4. 메인 오케스트레이터
# ═══════════════════════════════════════════════════════════════════════════════

def generate_report(output_path: str = OUTPUT_FILE) -> None:
    """
    보고서 전체 생성 파이프라인을 실행합니다.

    Steps:
      1. framword.json 로드
      2. Supabase 3개 테이블 일괄 조회
      3. 섹션-아이템-data_point 계층 구조 빌드
      4. 각 아이템별 HTML 렌더링 + AI 코멘터리 생성
      5. HTML + 초안 JSON 저장
    """
    print("[1/5] 프레임워크 JSON 로드...")
    framework = load_framework()

    print("[2/5] Supabase 데이터 조회...")
    indicators_map, dp_by_indicator, sd_by_dp_id = fetch_all_db_data()

    print("[3/5] 보고서 구조 빌드...")
    sections = build_report_structure(
        framework, indicators_map, dp_by_indicator, sd_by_dp_id
    )

    print("[4/5] AI 코멘터리 생성...")
    total_items = sum(len(s["items"]) for s in sections)
    item_count  = 0

    for section in sections:
        for item in section["items"]:
            item_count += 1
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
            item["commentary"] = commentary

    print("[5/5] 초안 JSON 저장...")
    draft_path = output_path.rsplit(".", 1)[0] + "_draft.json"

    from app.services.report_pipeline.report_editor import save_draft
    save_draft(sections, draft_path)

    size_str = ""
    try:
        size_kb = os.path.getsize(draft_path) / 1024
        size_str = f" ({size_kb:.1f} KB)"
    except Exception:
        pass

    print(f"\n[완료] 초안 JSON 저장: {draft_path}{size_str}")
