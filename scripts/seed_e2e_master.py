"""
seed_e2e_master.py
------------------
E2E 테스트용 마스터 지원 데이터 적재 스크립트

[역할]
  CSV 업로드 전에 실행하여 파이프라인 동작에 필요한
  보조 테이블을 미리 준비합니다.

[적재 대상]
  1. master_sites      - 삼성물산, 삼성전자 (없으면 INSERT)
  2. activity_data     - 2023-01 ~ 2024-01 (L3 원단위 탐지용)
  3. threshold_limits  - 에너지 지표 상한값 (L2 탐지용)
  4. evidence_usage    - OCR 증빙 대체 데이터 (정합성 검증용)
  5. site_metric_map   - 고객번호 -> 사업장 매핑 (OCR 연계용)

[유지 대상] (건드리지 않음)
  raw_data, standardized_data, outlier_results, audit_trail ...

[4개 시나리오 설계]
  시나리오 A  삼성물산 / 구매_전기_소비량 (MWh)   정상 + 증빙 일치   -> v_status=5
  시나리오 B  삼성물산 / 총_연료_소비량   (GJ)    L2 이상치 + 증빙 불일치 -> v_status=4
  시나리오 C  삼성전자 / 구매_전기_소비량 (MWh)   L1 YoY 이상치 + 증빙 일치 -> v_status=3
  시나리오 D  삼성전자 / 총_연료_소비량   (GJ)    정상 + 증빙 불일치  -> v_status=2

[업로드 CSV]
  test_data/계열사_삼성물산_raw.csv  -> source_type=계열사, site_id=삼성물산
  test_data/계열사_삼성전자_raw.csv  -> source_type=계열사, site_id=삼성전자

[실행 방법]
  cd backend_v2
  python -m scripts.seed_e2e_master         # 확인 프롬프트 포함
  python -m scripts.seed_e2e_master --yes   # 자동 실행
"""

import os
import sys
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import get_supabase_client

random.seed(42)

# ── 전기 소비량 (L3 production_qty 역산용) ──────────────────────────────────
_ELEC_CORP = {
    "2023-01-01": 7328.942,  "2023-02-01": 6749.182,  "2023-03-01": 7147.704,
    "2023-04-01": 7840.044,  "2023-05-01": 8093.631,  "2023-06-01": 8356.780,
    "2023-07-01": 9373.149,  "2023-08-01": 9046.984,  "2023-09-01": 7837.942,
    "2023-10-01": 7792.052,  "2023-11-01": 7028.986,  "2023-12-01": 7990.677,
    "2024-01-01": 7389.037,
}
_ELEC_ELEC = {
    "2023-01-01": 9468.640,   "2023-02-01": 8718.370,   "2023-03-01": 9532.639,
    "2023-04-01": 9980.765,   "2023-05-01": 10629.886,  "2023-06-01": 11150.132,
    "2023-07-01": 12298.922,  "2023-08-01": 11431.416,  "2023-09-01": 10724.529,
    "2023-10-01": 9691.912,   "2023-11-01": 9484.746,   "2023-12-01": 10530.877,
    "2024-01-01": 13256.100,  # L1 YoY 이상치 시나리오 (전기값도 동일하게)
}

INTENSITY_CORP = 0.75   # MWh/ton
INTENSITY_ELEC = 1.15   # MWh/ton


def _noise(base: float, rate: float = 0.05) -> float:
    return round(base * (1.0 + random.uniform(-rate, rate)), 2)


# ── threshold_limits ─────────────────────────────────────────────────────────
# 시나리오 B: 삼성물산/총_연료_소비량 2024-01=4800 > 4000 -> L2 FAIL
# 시나리오 D: 삼성전자/총_연료_소비량 2024-01=4350 < 7000 -> L2 PASS
THRESHOLDS = [
    {"site_id": "삼성물산", "metric_name": "구매_전기_소비량", "unit": "MWh",  "upper_limit": 14000.0},
    {"site_id": "삼성물산", "metric_name": "총_연료_소비량",   "unit": "GJ",   "upper_limit": 4000.0},
    {"site_id": "삼성전자", "metric_name": "구매_전기_소비량", "unit": "MWh",  "upper_limit": 18000.0},
    {"site_id": "삼성전자", "metric_name": "총_연료_소비량",   "unit": "GJ",   "upper_limit": 7000.0},
]

# ── evidence_usage (2024-01 목표월만) ────────────────────────────────────────
TARGET_DATE = "2024-01-01"
EVIDENCES = [
    # A: 전기 소비 일치 (gap=0) -> PASS + match -> v_status=5
    {"site_id": "삼성물산", "reporting_date": TARGET_DATE,
     "metric_name": "구매_전기_소비량", "unit": "MWh",
     "ocr_value": 7389.037, "file_name": "corp_elec_2024-01_A.pdf"},
    # B: 연료 소비 불일치 (db=4800, ocr=3500) -> FAIL + mismatch -> v_status=4
    {"site_id": "삼성물산", "reporting_date": TARGET_DATE,
     "metric_name": "총_연료_소비량", "unit": "GJ",
     "ocr_value": 3500.0, "file_name": "corp_fuel_2024-01_B.pdf"},
    # C: 전기 소비 일치 (gap=0) -> FAIL + match -> v_status=3
    {"site_id": "삼성전자", "reporting_date": TARGET_DATE,
     "metric_name": "구매_전기_소비량", "unit": "MWh",
     "ocr_value": 13256.100, "file_name": "elec_elec_2024-01_C.pdf"},
    # D: 연료 소비 불일치 (db=4350, ocr=3800) -> PASS + mismatch -> v_status=2
    {"site_id": "삼성전자", "reporting_date": TARGET_DATE,
     "metric_name": "총_연료_소비량", "unit": "GJ",
     "ocr_value": 3800.0, "file_name": "elec_fuel_2024-01_D.pdf"},
]

# ── site_metric_map (OCR 문서 -> 사업장 매핑) ────────────────────────────────
SITE_METRIC_MAPS = [
    {"customer_number": "CORP-ELEC-001", "site_id": "삼성물산",
     "metric_name": "구매_전기_소비량", "unit": "MWh",
     "description": "삼성물산 전기 사용량 고객번호"},
    {"customer_number": "CORP-FUEL-001", "site_id": "삼성물산",
     "metric_name": "총_연료_소비량", "unit": "GJ",
     "description": "삼성물산 연료 소비량 리포트"},
    {"customer_number": "ELEC-ELEC-001", "site_id": "삼성전자",
     "metric_name": "구매_전기_소비량", "unit": "MWh",
     "description": "삼성전자 전기 사용량 고객번호"},
    {"customer_number": "ELEC-FUEL-001", "site_id": "삼성전자",
     "metric_name": "총_연료_소비량", "unit": "GJ",
     "description": "삼성전자 연료 소비량 리포트"},
]


def _step_master_sites(client):
    print("\n[STEP 1] master_sites 확인...")
    existing = {r["site_id"] for r in client.table("master_sites").select("site_id").execute().data}
    to_insert = [
        {"site_id": "삼성물산", "site_name": "삼성물산 주식회사"},
        {"site_id": "삼성전자", "site_name": "삼성전자 주식회사"},
    ]
    added = [r for r in to_insert if r["site_id"] not in existing]
    if added:
        client.table("master_sites").insert(added).execute()
        for r in added:
            print(f"  INSERT: {r['site_id']}")
    else:
        print("  이미 존재 - 삽입 생략")


def _step_activity_data(client):
    print("\n[STEP 2] activity_data 적재 (L3 원단위용)...")
    # 기존 전체 삭제
    try:
        client.table("activity_data").delete().gte("activity_id", 0).execute()
    except Exception:
        client.table("activity_data").delete().neq("activity_id", -1).execute()

    rows = []
    for date, elec in _ELEC_CORP.items():
        rows.append({
            "site_id":        "삼성물산",
            "reporting_date": date,
            "production_qty": _noise(elec / INTENSITY_CORP),
            "unit":           "Ton",
        })
    for date, elec in _ELEC_ELEC.items():
        if date == "2024-01-01":
            # 삼성전자 2024-01: 생산량은 정상 범위 유지 -> intensity 급증 (L3도 탐지 가능)
            avg_elec = sum(v for d, v in _ELEC_ELEC.items() if d != "2024-01-01") / 12
            rows.append({
                "site_id":        "삼성전자",
                "reporting_date": date,
                "production_qty": _noise(avg_elec / INTENSITY_ELEC),
                "unit":           "Ton",
            })
        else:
            rows.append({
                "site_id":        "삼성전자",
                "reporting_date": date,
                "production_qty": _noise(elec / INTENSITY_ELEC),
                "unit":           "Ton",
            })

    res = client.table("activity_data").insert(rows).execute()
    print(f"  {len(res.data)}건 삽입 완료 (삼성물산 13건 + 삼성전자 13건)")


def _step_threshold_limits(client):
    print("\n[STEP 3] threshold_limits 설정 (L2 상한값)...")
    for rec in THRESHOLDS:
        client.table("threshold_limits").delete()\
            .eq("site_id", rec["site_id"])\
            .eq("metric_name", rec["metric_name"])\
            .execute()
        client.table("threshold_limits").insert(rec).execute()
        print(f"  [{rec['site_id']}] {rec['metric_name']:25s} upper_limit={rec['upper_limit']:>8,.1f} {rec['unit']}")


def _step_evidence_usage(client):
    print("\n[STEP 4] evidence_usage 적재 (OCR 증빙 대체)...")
    # verification_logs 가 evidence_usage.id 를 FK 참조 -> 먼저 삭제
    try:
        client.table("verification_logs").delete().gte("log_id", 0).execute()
    except Exception:
        try:
            client.table("verification_logs").delete().neq("log_id", -1).execute()
        except Exception:
            pass
    # 기존 전체 삭제
    try:
        client.table("evidence_usage").delete().gte("id", 0).execute()
    except Exception:
        client.table("evidence_usage").delete().neq("id", -1).execute()

    res = client.table("evidence_usage").insert(EVIDENCES).execute()
    print(f"  {len(res.data)}건 삽입 완료")
    print()
    print(f"  {'시나리오':<4} {'사업장':<8} {'지표':<25} {'db_value':>10}  {'ocr_value':>10}  {'결과'}")
    print(f"  {'-'*80}")
    data_vals = {
        ("삼성물산", "구매_전기_소비량"): 7389.037,
        ("삼성물산", "총_연료_소비량"):   4800.0,
        ("삼성전자", "구매_전기_소비량"): 13256.1,
        ("삼성전자", "총_연료_소비량"):   4350.0,
    }
    labels = ["A", "B", "C", "D"]
    for i, ev in enumerate(EVIDENCES):
        db_val = data_vals.get((ev["site_id"], ev["metric_name"]), 0)
        gap    = abs(db_val - ev["ocr_value"])
        match  = "일치" if gap < 1.0 else f"불일치 (gap={gap:.1f})"
        print(f"  {labels[i]:<4} {ev['site_id']:<8} {ev['metric_name']:<25} {db_val:>10,.3f}  {ev['ocr_value']:>10,.3f}  {match}")


def _step_site_metric_map(client):
    print("\n[STEP 5] site_metric_map 적재 (OCR 문서 사업장 매핑)...")
    for rec in SITE_METRIC_MAPS:
        try:
            client.table("site_metric_map").upsert(rec, on_conflict="customer_number").execute()
        except Exception as e:
            print(f"  [{rec['customer_number']}] 오류: {e}")
    print(f"  {len(SITE_METRIC_MAPS)}건 완료")


def _print_next_steps():
    print()
    print("=" * 65)
    print("  [다음 단계] CSV 업로드 진행")
    print("=" * 65)
    print()
    print("  1. 파이프라인 데이터 초기화 (필요시):")
    print("       python -m scripts.clear_e2e_pipeline --yes")
    print()
    print("  2. CSV 파일 업로드 (UI 또는 curl):")
    print("       파일: test_data/계열사_삼성물산_raw.csv")
    print("       파일: test_data/계열사_삼성전자_raw.csv")
    print()
    print("  3. 표준화 데이터 확인 (표준화 데이터 조회 페이지)")
    print()
    print("  4. 이상치.정합성 검증 실행 (이상치.정합성 검증 페이지)")
    print()
    print("  [기대 결과]")
    print("    시나리오 A - 삼성물산/전기   -> v_status=5 (정상+증빙일치)")
    print("    시나리오 B - 삼성물산/연료   -> v_status=4 (L2 이상치+불일치)")
    print("    시나리오 C - 삼성전자/전기   -> v_status=3 (L1 YoY 이상치+일치)")
    print("    시나리오 D - 삼성전자/연료   -> v_status=2 (정상+증빙불일치)")
    print("    baseline 12개월 (전 시나리오) -> v_status=5 (fallback)")
    print("=" * 65)


def main():
    auto_yes = "--yes" in sys.argv

    print("=" * 65)
    print("  E2E 마스터 지원 데이터 적재")
    print("=" * 65)
    print()
    print("  적재 대상: activity_data, threshold_limits,")
    print("             evidence_usage, site_metric_map")
    print("  유지 대상: raw_data, standardized_data 등 파이프라인 데이터")
    print()

    if not auto_yes:
        ans = input("  계속하시겠습니까? (yes 입력): ")
        if ans.strip().lower() != "yes":
            print("취소되었습니다.")
            sys.exit(0)

    client = get_supabase_client()

    _step_master_sites(client)
    _step_activity_data(client)
    _step_threshold_limits(client)
    _step_evidence_usage(client)
    _step_site_metric_map(client)
    _print_next_steps()


if __name__ == "__main__":
    main()
