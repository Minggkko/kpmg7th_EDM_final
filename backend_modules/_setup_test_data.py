"""
_setup_test_data.py
-------------------
EDM 파이프라인 전체 검증용 초기화 + Mock 데이터 삽입 스크립트.

실행 방법 (kpmg7th_EDM_final/ 디렉토리에서):
    python backend_modules/_setup_test_data.py

실행 시 처리 순서:
  1. 모든 테이블 데이터 전체 삭제 (FK 역순)
  2. 마스터 데이터 삽입 (master_sites / site_metric_map / threshold_limits)
  3. 생산량 데이터 삽입 (activity_data – 26개월)
  4. 표준화 데이터 삽입 (standardized_data – 이력 24개월 v_status=1 + Pending 4건 v_status=0)
  5. OCR 원본 데이터 삽입 (raw_ocr_data – 4건 Pending)

══ 설계된 테스트 케이스 ═══════════════════════════════════════════════════════

  레코드                   의도한 탐지 결과         의도한 검증 결과
  ─────────────────────────────────────────────────────────────────────────
  SITE_A 전기사용량 2026-01  v=0 → Normal(1)         OCR gap 0.09% → Verified(5)
  SITE_A 전기사용량 2026-02  v=0 → Outlier(2) Crit.  소명→Normal  → UnitError(4)
  SITE_B 연료사용량 2026-01  v=0 → Normal(1)         OCR gap 4.3% → Mismatch(3)
  SITE_B 연료사용량 2026-02  v=0 → Outlier(2) Warn.  소명→Normal  → Verified(5)

OCR 수치 설계:
  A001_2026_01.pdf  ocr=1019  db=1020  gap=0.098% < 1%  → Verified
  B001_2026_01.pdf  ocr=488   db=510   gap=4.31%  ≥ 1%  → Mismatch
  A001_2026_02.pdf  ocr=4.8   db=4800  db/1000=4.8=ocr  → UnitError
  B001_2026_02.pdf  ocr=520   db=520   gap=0.0%   < 1%  → Verified

이상치 탐지 수치 근거 (outlier_detection 공식):
  SITE_A 2026-02: value=4800
    window(2025-02~2026-01) mean≈1012, std≈13
    Z = |4800-1012|/13 = 291 > 3.0 → L1 ✓
    YoY(2025-02=1020): |4800-1020|/1020×100 = 370% > 30% → L1 ✓
    L2: 4800 > upper_limit=2000 → Critical ✓
    L3: intensity_dev = |(4800/100)-(1012/100)|/(1012/100)×100 ≈ 374% > 50% ✓

  SITE_B 2026-02: value=520
    window(2025-02~2026-01) mean=503, std≈4.9
    Z = |520-503|/4.9 = 3.47 > 3.0 → L1 ✓
    YoY(2025-02=495): |520-495|/495×100 = 5% < 30% → 미발동
    L2: 520 < upper_limit=600 → 미발동
    L3: intensity_dev ≈ 3.4% < 50% → 미발동
    → Warning ✓
"""

import sys
from pathlib import Path

# backend_modules 를 패키지로 임포트하기 위해 부모 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend_modules.database_utils import get_supabase_client


# ── 삭제 헬퍼 ──────────────────────────────────────────────────────────────────

def _delete_all(client, table: str, pk: str, is_str: bool = False) -> None:
    """테이블 전체 행 삭제 (FK 안전, 실패 시 경고만 출력)."""
    try:
        if is_str:
            # 문자열 PK: 빈 문자열이 아닌 모든 행 삭제 (= 전체)
            client.table(table).delete().neq(pk, "___nonexistent___").execute()
        else:
            client.table(table).delete().gte(pk, 0).execute()
        print(f"  ✅  {table:<22} 삭제 완료")
    except Exception as e:
        # PK 컬럼명이 다를 경우 fallback 시도
        try:
            fallback_pk = "id" if pk != "id" else "trail_id"
            client.table(table).delete().gte(fallback_pk, 0).execute()
            print(f"  ✅  {table:<22} 삭제 완료 (fallback pk={fallback_pk})")
        except Exception as e2:
            print(f"  ⚠️   {table:<22} 삭제 실패 (무시): {e2}")


# ── STEP 1: 전체 초기화 ────────────────────────────────────────────────────────

def reset_all_tables(client) -> None:
    print("\n[STEP 1] 기존 데이터 전체 삭제 (FK 역순)")

    # 결과 테이블 (다른 테이블을 참조하는 쪽부터)
    _delete_all(client, "audit_trail",        "trail_id")
    _delete_all(client, "justification_logs", "id")
    _delete_all(client, "verification_logs",  "log_id")
    _delete_all(client, "outlier_results",    "id")

    # 처리 테이블
    _delete_all(client, "evidence_usage",     "id")
    _delete_all(client, "standardized_data",  "id")
    _delete_all(client, "raw_ocr_data",       "id")

    # 기준 테이블 (activity_data / threshold_limits 는 id 컬럼 없음 → site_id 기준 삭제)
    _delete_all(client, "activity_data",      "site_id", is_str=True)
    _delete_all(client, "threshold_limits",   "site_id", is_str=True)
    _delete_all(client, "site_metric_map",    "customer_number", is_str=True)
    _delete_all(client, "master_sites",       "site_id",         is_str=True)


# ── STEP 2: 마스터 데이터 ──────────────────────────────────────────────────────

def insert_master_data(client) -> None:
    print("\n[STEP 2] 마스터 데이터 삽입")

    # master_sites
    sites = [
        {"site_id": "SITE_A", "site_name": "서울 A 공장"},
        {"site_id": "SITE_B", "site_name": "부산 B 공장"},
    ]
    client.table("master_sites").insert(sites).execute()
    print(f"  ✅  master_sites       {len(sites)}건 삽입")

    # site_metric_map  (customer_number → siteId / metricName / unit 매핑)
    metric_map = [
        {"customer_number": "A001", "site_id": "SITE_A",
         "metric_name": "전기사용량", "unit": "kWh"},
        {"customer_number": "B001", "site_id": "SITE_B",
         "metric_name": "연료사용량", "unit": "Nm3"},
    ]
    client.table("site_metric_map").insert(metric_map).execute()
    print(f"  ✅  site_metric_map    {len(metric_map)}건 삽입")

    # threshold_limits  (L2 물리적 상한)
    thresholds = [
        {"site_id": "SITE_A", "metric_name": "전기사용량",
         "upper_limit": 2000.0, "unit": "kWh"},
        {"site_id": "SITE_B", "metric_name": "연료사용량",
         "upper_limit": 600.0,  "unit": "Nm3"},
    ]
    client.table("threshold_limits").insert(thresholds).execute()
    print(f"  ✅  threshold_limits   {len(thresholds)}건 삽입")


# ── STEP 3: 생산량 데이터 ──────────────────────────────────────────────────────

def insert_activity_data(client) -> None:
    print("\n[STEP 3] 생산량 데이터 삽입 (activity_data – 26개월)")

    # 2024-01 ~ 2025-12 (24개월 이력) + 2026-01, 2026-02 (Pending 대응)
    dates = (
        [f"2024-{m:02d}-01" for m in range(1, 13)]
        + [f"2025-{m:02d}-01" for m in range(1, 13)]
        + ["2026-01-01", "2026-02-01"]
    )
    records = []
    for site_id in ["SITE_A", "SITE_B"]:
        for d in dates:
            records.append({
                "site_id":        site_id,
                "reporting_date": d,
                "production_qty": 100.0,
                "unit":           "ton",
            })

    client.table("activity_data").insert(records).execute()
    print(f"  ✅  activity_data      {len(records)}건 삽입 (사업장×26개월)")


# ── STEP 4: 표준화 데이터 ──────────────────────────────────────────────────────

def insert_standardized_data(client) -> None:
    print("\n[STEP 4] 표준화 데이터 삽입 (standardized_data)")

    dates_hist = (
        [f"2024-{m:02d}-01" for m in range(1, 13)]
        + [f"2025-{m:02d}-01" for m in range(1, 13)]
    )  # 24개월 이력 (이미 처리 완료, v_status=1)

    # ── SITE_A 전기사용량 이력값 (mean≈1010, std≈13)
    #    [0]=2024-01 … [23]=2025-12
    site_a_hist = [
        980,  1010, 1020,  990, 1005, 1015,
        1030,  995, 1025, 1010,  985, 1000,  # 2024
        1005, 1020, 1010,  995, 1015, 1025,
        1030, 1000, 1020, 1010,  990, 1005,  # 2025
    ]

    # ── SITE_B 연료사용량 이력값 (mean≈502, std≈5)
    #    rolling window(2025-02~2026-01) mean=503, std≈4.9
    #    → 2026-02=520 시 Z=3.47 > 3.0 (L1 Warning 목표)
    site_b_hist = [
        490,  385,  500,  495,  505,  510,
        508,  495,  502,  498,  507,  505,  # 2024
        500,  495,  505,  498,  510,  508,
        503,  497,  505,  502,  498,  505,  # 2025
    ]

    hist_records = []
    for i, d in enumerate(dates_hist):
        hist_records.append({
            "site_id": "SITE_A", "metric_name": "전기사용량",
            "reporting_date": d, "value": float(site_a_hist[i]),
            "unit": "kWh", "v_status": 1,
        })
        hist_records.append({
            "site_id": "SITE_B", "metric_name": "연료사용량",
            "reporting_date": d, "value": float(site_b_hist[i]),
            "unit": "Nm3", "v_status": 1,
        })

    # ── Pending 레코드 (v_status=0) ← 파이프라인 처리 대상
    pending_records = [
        # 2026-01: 모두 Normal 예측
        {"site_id": "SITE_A", "metric_name": "전기사용량",
         "reporting_date": "2026-01-01", "value": 1020.0,
         "unit": "kWh", "v_status": 0},
        {"site_id": "SITE_B", "metric_name": "연료사용량",
         "reporting_date": "2026-01-01", "value": 510.0,
         "unit": "Nm3", "v_status": 0},

        # 2026-02: 이상치 예측
        # SITE_A: Z=291, YoY=370%, L2>2000, L3=374% → Critical Outlier
        {"site_id": "SITE_A", "metric_name": "전기사용량",
         "reporting_date": "2026-02-01", "value": 4800.0,
         "unit": "kWh", "v_status": 0},
        # SITE_B: Z=3.47 > 3.0 (L1만 해당) → Warning Outlier
        {"site_id": "SITE_B", "metric_name": "연료사용량",
         "reporting_date": "2026-02-01", "value": 520.0,
         "unit": "Nm3", "v_status": 0},
    ]

    client.table("standardized_data").insert(hist_records).execute()
    client.table("standardized_data").insert(pending_records).execute()
    total = len(hist_records) + len(pending_records)
    print(f"  ✅  standardized_data  {total}건 삽입")
    print(f"      └ 이력 {len(hist_records)}건 (v_status=1) + Pending {len(pending_records)}건 (v_status=0)")


# ── STEP 5: OCR 원본 데이터 ────────────────────────────────────────────────────

def insert_raw_ocr_data(client) -> None:
    print("\n[STEP 5] OCR 원본 데이터 삽입 (raw_ocr_data – 4건 Pending)")

    ocr_records = [
        # A001_2026_01: ocr=1019, db=1020 → gap=0.098% → Verified(5)
        {
            "file_name": "A001_2026_01.pdf",
            "raw_content": {
                "customer_number": "A001",
                "year": "2026", "month": "1",
                "usage": 1019, "unit": "kWh",
            },
            "processing_status": "Pending",
        },
        # B001_2026_01: ocr=488, db=510 → gap=4.31% → Mismatch(3)
        {
            "file_name": "B001_2026_01.pdf",
            "raw_content": {
                "customer_number": "B001",
                "year": "2026", "month": "1",
                "usage": 488, "unit": "Nm3",
            },
            "processing_status": "Pending",
        },
        # A001_2026_02: ocr=4.8, db=4800 → db/1000=4.8=ocr → UnitError(4)
        {
            "file_name": "A001_2026_02.pdf",
            "raw_content": {
                "customer_number": "A001",
                "year": "2026", "month": "2",
                "usage": 4.8, "unit": "kWh",
            },
            "processing_status": "Pending",
        },
        # B001_2026_02: ocr=520, db=520 → gap=0% → Verified(5)
        {
            "file_name": "B001_2026_02.pdf",
            "raw_content": {
                "customer_number": "B001",
                "year": "2026", "month": "2",
                "usage": 520, "unit": "Nm3",
            },
            "processing_status": "Pending",
        },
    ]

    client.table("raw_ocr_data").insert(ocr_records).execute()
    print(f"  ✅  raw_ocr_data       {len(ocr_records)}건 삽입")
    print()
    print("  ┌──────────────────────┬──────────────┬──────────────────────────┐")
    print("  │ 파일명               │ OCR 값       │ 예상 검증 결과            │")
    print("  ├──────────────────────┼──────────────┼──────────────────────────┤")
    print("  │ A001_2026_01.pdf     │ 1019 kWh     │ gap 0.098% → Verified(5) │")
    print("  │ B001_2026_01.pdf     │ 488  Nm3     │ gap 4.31%  → Mismatch(3) │")
    print("  │ A001_2026_02.pdf     │ 4.8  kWh     │ db/1000=4.8 → UnitErr(4) │")
    print("  │ B001_2026_02.pdf     │ 520  Nm3     │ gap 0.0%   → Verified(5) │")
    print("  └──────────────────────┴──────────────┴──────────────────────────┘")


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("=" * 62)
    print("  EDM 파이프라인 테스트 데이터 초기화 + Mock 데이터 삽입")
    print("=" * 62)

    client = get_supabase_client()

    reset_all_tables(client)
    insert_master_data(client)
    insert_activity_data(client)
    insert_standardized_data(client)
    insert_raw_ocr_data(client)

    print("\n" + "=" * 62)
    print("  ✅  Mock 데이터 준비 완료!")
    print()
    print("  다음 단계:")
    print("    python backend_modules/_run_e2e_validation.py")
    print("=" * 62)


if __name__ == "__main__":
    main()
