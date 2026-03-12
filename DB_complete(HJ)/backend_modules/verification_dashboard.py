"""
verification_dashboard.py
--------------------------
FE 대시보드용 통합 조회 모듈.

주요 함수
---------
- get_verification_dashboard() : 필터 조건에 맞는 검증 현황 데이터 통합 반환
- get_status_summary()         : 사업장별 v_status 집계 (카드/차트용)
- get_outlier_pending_list()   : 소명 대기 중인 이상치 목록 반환

조인 구조 (Python-side 조인, Supabase SDK 한계 보완)
---------
standardized_data (기준)
  └─ outlier_results      (std_id FK, 최신 1건)
  └─ verification_logs    (std_id FK, 최신 1건)
  └─ evidence_usage       (site_id + reporting_date + metric_name 매칭)
  └─ activity_data        (site_id + reporting_date 매칭)
"""

from .database_utils import get_supabase_client


# ── v_status 레이블 매핑 ──────────────────────────────────────────────────────
V_STATUS_LABEL = {
    0: "Pending",
    1: "Normal",
    2: "Outlier",
    3: "Mismatch",
    4: "Unit Error",
    5: "Verified",
}


# ── 메인 함수 ──────────────────────────────────────────────────────────────────

def get_verification_dashboard(
    site_id: str = None,
    start_date: str = None,
    end_date: str = None,
    v_status: int = 1,
    metric_name: str = None,
    limit: int = 200,
) -> list[dict]:
    """
    FE 대시보드에 필요한 검증 현황 데이터를 통합 반환합니다.

    각 standard_usage 레코드에 이상치 탐지 결과, 증빙 검증 로그,
    OCR 증빙값, 생산량 데이터를 병합하여 반환합니다.

    Parameters
    ----------
    site_id : str, optional
        사업장 ID 필터 (예: 'Site A')
    start_date : str, optional
        조회 시작일 (ISO 형식: 'YYYY-MM-DD')
    end_date : str, optional
        조회 종료일 (ISO 형식: 'YYYY-MM-DD')
    v_status : int, optional
        상태 코드 필터 (0~5). None이면 전체 조회
    metric_name : str, optional
        지표 필터 (예: 'electricity', 'lng')
    limit : int, optional
        최대 반환 건수. 기본값 200

    Returns
    -------
    list[dict]
        [
            {
                "id": int,
                "site_id": str,
                "reporting_date": str,
                "metric_name": str,
                "unit": str,
                "value": float,
                "v_status": int,
                "v_status_label": str,
                "production_qty": float | None,
                "intensity": float | None,       # value / production_qty
                # 이상치 정보 (없으면 None)
                "outlier_id": int | None,
                "layer": str | None,
                "severity": str | None,
                "detected_value": float | None,
                "threshold": float | None,
                "ai_diagnosis": str | None,
                # 증빙 검증 정보 (없으면 None)
                "log_id": int | None,
                "gap_value": float | None,
                "gap_percent": float | None,
                "result_code": int | None,
                "diagnosis": str | None,
                # OCR 증빙 정보 (없으면 None)
                "ocr_value": float | None,
                "evidence_file": str | None,
            },
            ...
        ]
    """
    client = get_supabase_client()

    # ── Step 1: standardized_data 조회 (필터 적용) ──────────────────────────────
    query = client.table("standardized_data").select("*").order("reporting_date", desc=True).limit(limit)

    if site_id:
        query = query.eq("source_name", site_id)
    if v_status is not None:
        query = query.eq("v_status", v_status)
    if metric_name:
        query = query.eq("metric_name", metric_name)
    if start_date:
        query = query.gte("reporting_date", start_date)
    if end_date:
        query = query.lte("reporting_date", end_date)

    usage_list = query.execute().data
    if not usage_list:
        return []

    std_ids = [r["id"] for r in usage_list]

    # ── Step 2: 관련 테이블 일괄 조회 (N+1 방지) ────────────────────────────
    # outlier_results: std_id IN (...)
    outlier_map = _build_map_by_std_id(
        client.table("outlier_results")
        .select("*")
        .in_("std_id", std_ids)
        .order("id", desc=True)
        .execute()
        .data,
        key="std_id",
        keep="first",  # 최신 1건만
    )

    # verification_logs: std_id IN (...)
    verif_map = _build_map_by_std_id(
        client.table("verification_logs")
        .select("*")
        .in_("std_id", std_ids)
        .order("log_id", desc=True)
        .execute()
        .data,
        key="std_id",
        keep="first",
    )

    # activity_data: source_name + reporting_date 매칭용 딕셔너리
    site_dates = list({(r["source_name"], r["reporting_date"]) for r in usage_list})
    activity_map: dict[tuple, float] = {}
    for site, date in site_dates:
        act = (
            client.table("activity_data")
            .select("production_qty")
            .eq("site_id", site)
            .eq("reporting_date", date)
            .limit(1)
            .execute()
            .data
        )
        if act:
            activity_map[(site, date)] = float(act[0]["production_qty"])

    # evidence_usage: verification_logs의 evidence_id로 조회
    evidence_ids = [
        v["evidence_id"]
        for v in verif_map.values()
        if v and v.get("evidence_id")
    ]
    evidence_map: dict[int, dict] = {}
    if evidence_ids:
        evid_list = (
            client.table("evidence_usage")
            .select("id, ocr_value, file_name")
            .in_("id", evidence_ids)
            .execute()
            .data
        )
        evidence_map = {e["id"]: e for e in evid_list}

    # ── Step 3: 데이터 병합 ──────────────────────────────────────────────────
    result = []
    for row in usage_list:
        std_id  = row["id"]
        site    = row["source_name"]
        date    = row["reporting_date"]
        val     = float(row["value"]) if row["value"] is not None else None
        status  = int(row["v_status"])

        # 생산량 & 원단위
        prod_qty  = activity_map.get((site, date))
        intensity = round(val / prod_qty, 4) if (val and prod_qty) else None

        # 이상치 정보
        outlier = outlier_map.get(std_id)
        # 증빙 검증 정보
        verif   = verif_map.get(std_id)
        # OCR 증빙 정보
        evid_id  = verif.get("evidence_id") if verif else None
        evidence = evidence_map.get(evid_id) if evid_id else None

        result.append({
            "id":              std_id,
            "source_name":     site,
            "reporting_date":  date,
            "metric_name":     row["metric_name"],
            "unit":            row["unit"],
            "value":           val,
            "v_status":        status,
            "v_status_label":  V_STATUS_LABEL.get(status, "Unknown"),
            "production_qty":  prod_qty,
            "intensity":       intensity,
            # 이상치
            "outlier_id":      outlier["id"]             if outlier else None,
            "layer":           outlier["layer"]           if outlier else None,
            "severity":        outlier["severity"]        if outlier else None,
            "detected_value":  float(outlier["detected_value"]) if outlier and outlier.get("detected_value") is not None else None,
            "threshold":       float(outlier["threshold"])      if outlier and outlier.get("threshold") is not None else None,
            "ai_diagnosis":    outlier["analysis_summary"] if outlier else None,
            # 증빙 검증
            "log_id":          verif["log_id"]            if verif else None,
            "gap_value":       float(verif["gap_value"])  if verif and verif.get("gap_value") is not None else None,
            "gap_percent":     float(verif["gap_percent"]) if verif and verif.get("gap_percent") is not None else None,
            "result_code":     verif["result_code"]       if verif else None,
            "diagnosis":       verif["diagnosis"]         if verif else None,
            # OCR 증빙
            "ocr_value":       float(evidence["ocr_value"]) if evidence and evidence.get("ocr_value") is not None else None,
            "evidence_file":   evidence["file_name"]       if evidence else None,
        })

    return result


# ── 집계 함수 ──────────────────────────────────────────────────────────────────

def get_status_summary(site_id: str = None) -> list[dict]:
    """
    사업장별 v_status 집계를 반환합니다 (대시보드 요약 카드용).

    Parameters
    ----------
    site_id : str, optional
        특정 사업장만 집계. None이면 전체

    Returns
    -------
    list[dict]
        [
            {
                "site_id": str,
                "v_status": int,
                "v_status_label": str,
                "count": int
            },
            ...
        ]
    """
    client = get_supabase_client()

    query = client.table("standardized_data").select("source_name, v_status")
    if site_id:
        query = query.eq("source_name", site_id)
    rows = query.execute().data

    # Python-side 집계
    counts: dict[tuple, int] = {}
    for r in rows:
        key = (r["source_name"], int(r["v_status"]))
        counts[key] = counts.get(key, 0) + 1

    return [
        {
            "site_id":       k[0],
            "v_status":      k[1],
            "v_status_label": V_STATUS_LABEL.get(k[1], "Unknown"),
            "count":         v,
        }
        for k, v in sorted(counts.items())
    ]


def get_outlier_pending_list(site_id: str = None) -> list[dict]:
    """
    소명 대기 중인 이상치(v_status=2) 목록을 AI 진단 정보와 함께 반환합니다.

    Parameters
    ----------
    site_id : str, optional
        특정 사업장만 조회. None이면 전체

    Returns
    -------
    list[dict]
        get_verification_dashboard() 결과와 동일한 구조, v_status=2 필터
    """
    return get_verification_dashboard(site_id=site_id, v_status=2)


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _build_map_by_std_id(
    rows: list[dict],
    key: str,
    keep: str = "first",
) -> dict[int, dict]:
    """
    레코드 리스트를 key 컬럼 기준 딕셔너리로 변환합니다.
    keep='first'이면 중복 std_id 중 첫 번째(최신)만 유지합니다.
    """
    result: dict[int, dict] = {}
    for row in rows:
        k = row[key]
        if keep == "first" and k in result:
            continue
        result[k] = row
    return result


# ── 연결 검증 (직접 실행 시) ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔍 verification_dashboard 동작 검증 중...\n")
    try:
        # 1. 전체 현황 요약
        print("📊 [1] v_status 집계:")
        summary = get_status_summary()
        for s in summary:
            print(f"   {s['site_id']} | {s['v_status_label']:12s} | {s['count']}건")

        # 2. Site A 대시보드 데이터 (최근 3건)
        print("\n📋 [2] Site A 대시보드 샘플 (최근 3건):")
        dashboard = get_verification_dashboard(site_id="Site A", limit=3)
        for d in dashboard:
            print(
                f"   id={d['id']} | {d['reporting_date']} | {d['metric_name']:12s} | "
                f"value={d['value']} | {d['v_status_label']:10s} | "
                f"severity={d['severity']} | gap%={d['gap_percent']}"
            )

        # 3. 소명 대기 목록
        print(f"\n⚠️  [3] 소명 대기(Outlier) 건수: {len(get_outlier_pending_list())}건")

        print("\n✅ 검증 완료!")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
