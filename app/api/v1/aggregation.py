"""
aggregation.py
──────────────
v_status=5 (최종 확정) 데이터 집계 엔드포인트

GET /aggregation/summary  → 전체 요약 (총 확정 건수, 연도별, 사이트별, ESG 카테고리별)
GET /aggregation/details  → 지표별 합계 (연도·사이트 필터 가능)
GET /aggregation/years    → 집계 가능한 연도 목록
"""

from fastapi import APIRouter, Query
from typing import Optional
from app.core.supabase import get_supabase_client

router = APIRouter()

# ── ESG 카테고리 키워드 분류 ───────────────────────────────────────────────────
_ESG_KEYWORDS = {
    "환경 (E)": [
        "온실가스", "탄소", "carbon", "co2", "emission",
        "electricity", "에너지", "energy", "전기", "전력",
        "lng", "gas", "coal", "물", "water", "용수",
        "폐기물", "waste", "소비",
    ],
    "사회 (S)": [
        "임직원", "employee", "safety", "안전", "재해",
        "injury", "여성", "women", "사회", "social", "채용", "인원",
    ],
    "지배구조 (G)": [
        "이사회", "board", "윤리", "ethics", "governance", "지배구조",
    ],
}


def _classify_esg(metric_name: str) -> str:
    if not metric_name:
        return "환경 (E)"
    lower = metric_name.lower()
    for cat, keywords in _ESG_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return cat
    return "환경 (E)"


# ── 공통 쿼리 ─────────────────────────────────────────────────────────────────
def _fetch_confirmed(client, site_id: Optional[str] = None):
    q = (
        client.table("standardized_data")
        .select("id, site_id, reporting_date, metric_name, value, unit")
        .eq("v_status", 5)
    )
    if site_id:
        q = q.eq("site_id", site_id)
    return q.execute().data or []


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/years")
def get_aggregation_years():
    """집계 가능한 연도 목록 (v_status=5 기준, 최신 순)"""
    client = get_supabase_client()
    res = (
        client.table("standardized_data")
        .select("reporting_date")
        .eq("v_status", 5)
        .execute()
    )
    years = sorted(
        {r["reporting_date"][:4] for r in (res.data or []) if r.get("reporting_date")},
        reverse=True,
    )
    return {"years": years}


@router.get("/summary")
def get_aggregation_summary(site_id: Optional[str] = Query(None)):
    """v_status=5 확정 데이터 집계 요약"""
    client = get_supabase_client()
    items = _fetch_confirmed(client, site_id)

    by_year: dict[str, int] = {}
    by_site: dict[str, int] = {}
    by_category: dict[str, int] = {}

    for item in items:
        year = (item.get("reporting_date") or "")[:4] or "미상"
        site = item.get("site_id") or "미상"
        cat  = _classify_esg(item.get("metric_name", ""))

        by_year[year]     = by_year.get(year, 0) + 1
        by_site[site]     = by_site.get(site, 0) + 1
        by_category[cat]  = by_category.get(cat, 0) + 1

    return {
        "total_confirmed": len(items),
        "by_year": [
            {"year": k, "count": v}
            for k, v in sorted(by_year.items(), reverse=True)
        ],
        "by_site": [
            {"site_id": k, "count": v}
            for k, v in sorted(by_site.items())
        ],
        "by_category": [
            {"category": k, "count": v}
            for k, v in by_category.items()
        ],
    }


@router.get("/details")
def get_aggregation_details(
    site_id: Optional[str] = Query(None),
    year:    Optional[str] = Query(None),
):
    """v_status=5 확정 데이터 지표별 합계 + 전년 비교 (연도·사이트 필터 가능)"""
    client = get_supabase_client()
    all_items = _fetch_confirmed(client, site_id)

    def _aggregate(items):
        agg: dict[tuple, dict] = {}
        for item in items:
            key = (item.get("metric_name") or "", item.get("unit") or "")
            if key not in agg:
                agg[key] = {
                    "metric_name":  item.get("metric_name"),
                    "unit":         item.get("unit"),
                    "esg_category": _classify_esg(item.get("metric_name", "")),
                    "total_value":  0.0,
                    "count":        0,
                    "sites":        set(),
                }
            agg[key]["total_value"] += item.get("value") or 0
            agg[key]["count"]       += 1
            agg[key]["sites"].add(item.get("site_id") or "미상")
        return agg

    # 당해 연도 집계
    cur_items = [i for i in all_items if (i.get("reporting_date") or "")[:4] == year] if year else all_items
    cur_agg = _aggregate(cur_items)

    # 전년도 집계 (year 지정 시에만)
    prev_agg = {}
    if year:
        prev_year = str(int(year) - 1)
        prev_items = [i for i in all_items if (i.get("reporting_date") or "")[:4] == prev_year]
        prev_agg = _aggregate(prev_items)

    _cat_order = {"환경 (E)": 0, "사회 (S)": 1, "지배구조 (G)": 2}
    result = []
    for key, d in cur_agg.items():
        prev = prev_agg.get(key)
        prev_val = round(prev["total_value"], 4) if prev else None
        cur_val  = round(d["total_value"], 4)
        yoy_pct  = None
        if prev_val is not None and prev_val != 0:
            yoy_pct = round((cur_val - prev_val) / abs(prev_val) * 100, 1)

        result.append({
            "metric_name":  d["metric_name"],
            "unit":         d["unit"],
            "esg_category": d["esg_category"],
            "total_value":  cur_val,
            "prev_value":   prev_val,
            "yoy_pct":      yoy_pct,
            "count":        d["count"],
            "site_count":   len(d["sites"]),
        })

    result.sort(key=lambda x: (_cat_order.get(x["esg_category"], 9), x["metric_name"] or ""))
    return {"data": result, "total": len(result)}
