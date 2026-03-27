"""
seed_e2e_data.py
----------------
E2E 테스트용 전체 파이프라인 데이터 준비 스크립트

[수행 작업]
  1. DB 운영 데이터 완전 초기화 (--full)
  2. standardized_data  13개월 × 4개 시나리오 삽입 (v_status=1)
  3. activity_data      2023-01 ~ 2024-01 (14개월) 삽입 (L3용)
  4. threshold_limits   2 사업장 × 2 지표 설정 (L2용)
  5. evidence_usage     시나리오별 ocr_value 삽입 (정합성 검증용)
  6. site_metric_map    OCR 문서 사업장 매핑 삽입 (참고용)

[예상 결과 - 이상치·정합성 검증 실행 후]
  시나리오 A  삼성물산  / 구매_전기_소비량        → v_status = 5 (정상 + 증빙 일치)
  시나리오 B  삼성물산  / 기준 연도 Scope 배출량  → v_status = 4 (L2 이상치 + 증빙 불일치)
  시나리오 C  삼성전자  / 구매_전기_소비량        → v_status = 3 (L1 YoY 이상치 + 증빙 일치)
  시나리오 D  삼성전자  / 기준 연도 Scope 배출량  → v_status = 2 (정상 + 증빙 불일치)
  ※ baseline 12개월(2023-01~12)은 증빙 없음 → 탐지 후 v_status=5 fallback

[실행 방법]
  cd backend_v2
  python -m scripts.seed_e2e_data           # 확인 프롬프트 포함
  python -m scripts.seed_e2e_data --yes     # 자동 확인 (CI/CD용)
"""

import os
import sys
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import get_supabase_client

# ── 재현 가능한 난수 시드 ────────────────────────────────────────────────────
random.seed(42)

# ── 기준 날짜 목록 (2023-01 ~ 2024-01, 총 13개월) ───────────────────────────
DATES_13 = [
    "2023-01-01", "2023-02-01", "2023-03-01", "2023-04-01",
    "2023-05-01", "2023-06-01", "2023-07-01", "2023-08-01",
    "2023-09-01", "2023-10-01", "2023-11-01", "2023-12-01",
    "2024-01-01",
]

SOURCE_TYPE = "계열사"

# ─────────────────────────────────────────────────────────────────────────────
#  시나리오 A: 삼성물산 + 구매_전기_소비량
#  이상치: 없음 (PASS)  /  증빙: 일치  →  v_status = 5
# ─────────────────────────────────────────────────────────────────────────────
# 2023-01~2023-12 실측 전기 소비량 (MWh) - seed_activity_data.py 동일 출처
# 13번째(2024-01): 실측값 사용 → YoY 변화율 ~ +0.8%, Z-Score ~ 0.9 → PASS
SCEN_A_VALUES = {
    "2023-01-01": 7328.942,
    "2023-02-01": 6749.182,
    "2023-03-01": 7147.704,
    "2023-04-01": 7840.044,
    "2023-05-01": 8093.631,
    "2023-06-01": 8356.780,
    "2023-07-01": 9373.149,
    "2023-08-01": 9046.984,
    "2023-09-01": 7837.942,
    "2023-10-01": 7792.052,
    "2023-11-01": 7028.986,
    "2023-12-01": 7990.677,
    "2024-01-01": 7389.037,   # 목표월: YoY +0.8%, Z~0.9 → PASS
}
SCEN_A_UNIT  = "MWh"
SCEN_A_EVID  = 7389.037   # evidence_usage ocr_value = db_value (일치)

# ─────────────────────────────────────────────────────────────────────────────
#  시나리오 B: 삼성물산 + 기준 연도 Scope 1, 2, 3 배출량
#  이상치: L2(임계값 2150 초과)  /  증빙: 불일치  →  v_status = 4
# ─────────────────────────────────────────────────────────────────────────────
# 2023-01~2023-12: 정상 범위 (1000~1450 tCO2e)
# 2024-01: 2300 tCO2e → upper_limit(2150) 초과 → L2 FAIL
SCEN_B_VALUES = {
    "2023-01-01": 1200.0,
    "2023-02-01": 1050.0,
    "2023-03-01": 1180.0,
    "2023-04-01": 1250.0,
    "2023-05-01": 1320.0,
    "2023-06-01": 1380.0,
    "2023-07-01": 1450.0,
    "2023-08-01": 1420.0,
    "2023-09-01": 1300.0,
    "2023-10-01": 1280.0,
    "2023-11-01": 1150.0,
    "2023-12-01": 1310.0,
    "2024-01-01": 2300.0,   # 목표월: L2 초과 (upper_limit=2150) → FAIL
}
SCEN_B_UNIT  = "tCO₂e"
SCEN_B_EVID  = 1950.0     # evidence_usage ocr_value ≠ db_value (불일치)

# ─────────────────────────────────────────────────────────────────────────────
#  시나리오 C: 삼성전자 + 구매_전기_소비량
#  이상치: L1(YoY +40% 급증)  /  증빙: 일치  →  v_status = 3
# ─────────────────────────────────────────────────────────────────────────────
# 2023-01~2023-12: 실측 전기 소비량 (MWh)
# 2024-01: 13255.7 MWh = 2023-01(9468.64) × 1.40 → YoY +40% → L1 FAIL
SCEN_C_VALUES = {
    "2023-01-01": 9468.640,   # YoY 기준점 (2024-01 비교 대상)
    "2023-02-01": 8718.370,
    "2023-03-01": 9532.639,
    "2023-04-01": 9980.765,
    "2023-05-01": 10629.886,
    "2023-06-01": 11150.132,
    "2023-07-01": 12298.922,
    "2023-08-01": 11431.416,
    "2023-09-01": 10724.529,
    "2023-10-01": 9691.912,
    "2023-11-01": 9484.746,
    "2023-12-01": 10530.877,
    "2024-01-01": 13256.1,    # 목표월: YoY +40% → L1 FAIL
}
SCEN_C_UNIT  = "MWh"
SCEN_C_EVID  = 13256.1    # evidence_usage ocr_value = db_value (일치)

# ─────────────────────────────────────────────────────────────────────────────
#  시나리오 D: 삼성전자 + 기준 연도 Scope 1, 2, 3 배출량
#  이상치: 없음 (PASS)  /  증빙: 불일치  →  v_status = 2
# ─────────────────────────────────────────────────────────────────────────────
# 2023-01~2023-12: 정상 범위 (1400~1850 tCO2e)
# 2024-01: 1650 tCO2e → upper_limit(2770) 미초과, YoY ~ -2.9% → PASS
SCEN_D_VALUES = {
    "2023-01-01": 1700.0,
    "2023-02-01": 1530.0,
    "2023-03-01": 1680.0,
    "2023-04-01": 1750.0,
    "2023-05-01": 1820.0,
    "2023-06-01": 1850.0,
    "2023-07-01": 1840.0,
    "2023-08-01": 1810.0,
    "2023-09-01": 1720.0,
    "2023-10-01": 1690.0,
    "2023-11-01": 1600.0,
    "2023-12-01": 1730.0,
    "2024-01-01": 1650.0,   # 목표월: 정상 (YoY ~ -2.9%, L2 미초과) → PASS
}
SCEN_D_UNIT  = "tCO₂e"
SCEN_D_EVID  = 1450.0     # evidence_usage ocr_value ≠ db_value (불일치)

# ── activity_data (L3 원단위 탐지용) ────────────────────────────────────────
# production_qty = 전기 소비량 / 집약도 + ±5% noise
INTENSITY_CORP = 0.75   # MWh/ton - 삼성물산
INTENSITY_ELEC = 1.15   # MWh/ton - 삼성전자

# 삼성전자 2024-01은 L1 이상치 시나리오(전기 급증) → L3도 탐지될 수 있음
# production_qty는 정상 범위로 설정하여 intensity 급증을 일부러 만듦
ACT_SAMSUNG_CORP = {d: v for d, v in SCEN_A_VALUES.items()}   # 삼성물산
ACT_SAMSUNG_ELEC = {d: v for d, v in SCEN_C_VALUES.items()}   # 삼성전자

# ── threshold_limits (L2 절대값 탐지용) ─────────────────────────────────────
THRESHOLD_RECORDS = [
    # 삼성물산 전기: 역대최대(9609) × 1.46 ~ 14,000 - 정상 범위는 이하
    {"site_id": "삼성물산", "metric_name": "구매_전기_소비량",               "unit": "MWh",   "upper_limit": 14000.0},
    # 삼성물산 배출: upper_limit=2150 → 시나리오 B(2300) 초과 → L2 탐지
    {"site_id": "삼성물산", "metric_name": "기준 연도 Scope 1, 2, 3 배출량", "unit": "tCO₂e", "upper_limit": 2150.0},
    # 삼성전자 전기: upper_limit=18000 → 시나리오 C(13256) 미초과 → L2 미탐지, L1만
    {"site_id": "삼성전자", "metric_name": "구매_전기_소비량",               "unit": "MWh",   "upper_limit": 18000.0},
    # 삼성전자 배출: upper_limit=2770 → 시나리오 D(1650) 미초과 → PASS
    {"site_id": "삼성전자", "metric_name": "기준 연도 Scope 1, 2, 3 배출량", "unit": "tCO₂e", "upper_limit": 2770.0},
]

# ── site_metric_map (OCR 문서 사업장 매핑용) ─────────────────────────────────
SITE_METRIC_MAP_RECORDS = [
    {"customer_number": "CORP-ELEC-001",  "site_id": "삼성물산", "metric_name": "구매_전기_소비량",               "unit": "MWh",   "description": "삼성물산 전기 사용량 계량기 고객번호"},
    {"customer_number": "CORP-CO2-001",   "site_id": "삼성물산", "metric_name": "기준 연도 Scope 1, 2, 3 배출량", "unit": "tCO₂e", "description": "삼성물산 온실가스 배출량 리포트"},
    {"customer_number": "ELEC-ELEC-001",  "site_id": "삼성전자", "metric_name": "구매_전기_소비량",               "unit": "MWh",   "description": "삼성전자 전기 사용량 계량기 고객번호"},
    {"customer_number": "ELEC-CO2-001",   "site_id": "삼성전자", "metric_name": "기준 연도 Scope 1, 2, 3 배출량", "unit": "tCO₂e", "description": "삼성전자 온실가스 배출량 리포트"},
]


# ─────────────────────────────────────────────────────────────────────────────
#  헬퍼 함수
# ─────────────────────────────────────────────────────────────────────────────

def _noise(base: float, rate: float = 0.05) -> float:
    """±rate 노이즈 추가."""
    return round(base * (1.0 + random.uniform(-rate, rate)), 2)


def _clear_pipeline(client):
    """운영 데이터 완전 초기화 (evidence_usage, activity_data 포함)."""
    tables = [
        ("verification_logs", "log_id"),
        ("justification_logs", "id"),
        ("audit_trail",        "trail_id"),
        ("outlier_results",    "id"),
        ("standardized_data",  "id"),
        ("raw_data",           "id"),
        ("raw_ocr_data",       "id"),
        ("evidence_usage",     "id"),
        ("activity_data",      "activity_id"),
    ]
    print("\n[STEP 0] 운영 데이터 초기화 중...")
    total = 0
    for table, pk in tables:
        try:
            res = client.table(table).delete().gte(pk, 0).execute()
            cnt = len(res.data) if res.data else 0
        except Exception:
            try:
                res = client.table(table).delete().neq(pk, -999999).execute()
                cnt = len(res.data) if res.data else 0
            except Exception as e:
                print(f"  [{table}] 삭제 실패: {e}")
                cnt = 0
        print(f"  [{table}] {cnt}건 삭제")
        total += cnt
    print(f"  → 총 {total}건 삭제 완료")


def _ensure_sites(client):
    """master_sites에 삼성물산, 삼성전자가 없으면 삽입."""
    print("\n[STEP 1] master_sites 확인...")
    existing = {r["site_id"] for r in client.table("master_sites").select("site_id").execute().data}
    to_insert = []
    for site_id, site_name in [("삼성물산", "삼성물산 주식회사"), ("삼성전자", "삼성전자 주식회사")]:
        if site_id not in existing:
            to_insert.append({"site_id": site_id, "site_name": site_name})
    if to_insert:
        client.table("master_sites").insert(to_insert).execute()
        for r in to_insert:
            print(f"  INSERT: {r['site_id']}")
    else:
        print("  이미 존재 - 삽입 생략")
    return {"삼성물산", "삼성전자"}


def _get_data_point_ids(client, metric_names: list[str]) -> dict[str, int]:
    """metric_name → data_point id 매핑 반환. 없으면 오류 출력 후 None."""
    print("\n[STEP 2] data_points FK 확인...")
    rows = client.table("data_points").select("id, name").in_("name", metric_names).execute().data
    mapping = {r["name"]: r["id"] for r in rows}
    for name in metric_names:
        if name in mapping:
            print(f"  OK  [{mapping[name]}] {name}")
        else:
            print(f"  !! MISSING: '{name}' - data_points 테이블에 없음")
    return mapping


def _insert_standardized_data(client, dp_map: dict):
    """4개 시나리오의 standardized_data 삽입."""
    print("\n[STEP 3] standardized_data 삽입 (4 시나리오 × 13개월 = 52건)...")

    scenarios = [
        ("삼성물산", "구매_전기_소비량",               SCEN_A_UNIT, SCEN_A_VALUES, "A"),
        ("삼성물산", "기준 연도 Scope 1, 2, 3 배출량", SCEN_B_UNIT, SCEN_B_VALUES, "B"),
        ("삼성전자", "구매_전기_소비량",               SCEN_C_UNIT, SCEN_C_VALUES, "C"),
        ("삼성전자", "기준 연도 Scope 1, 2, 3 배출량", SCEN_D_UNIT, SCEN_D_VALUES, "D"),
    ]

    rows = []
    for site_id, metric_name, unit, values, label in scenarios:
        dp_id = dp_map.get(metric_name)
        if dp_id is None:
            print(f"  !! 시나리오 {label} 건너뜀 - data_point_id 없음")
            continue
        for date, val in values.items():
            rows.append({
                "source_type"   : SOURCE_TYPE,
                "site_id"       : site_id,
                "reporting_date": date,
                "metric_name"   : metric_name,
                "data_point_id" : dp_id,
                "value"         : val,
                "unit"          : unit,
                "v_status"      : 1,
                "raw_value_text": str(val),
            })

    # 배치 삽입 (unique constraint 주의: source_type, site_id, reporting_date, metric_name)
    BATCH = 50
    inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        try:
            res = client.table("standardized_data").upsert(
                batch,
                on_conflict="source_type,site_id,reporting_date,metric_name"
            ).execute()
            inserted += len(res.data)
        except Exception as e:
            print(f"  배치 오류 (offset={i}): {e}")

    print(f"  {inserted}건 삽입 완료")

    # 기대 이상치 요약 출력
    print("\n  [이상치 탐지 예상]")
    print("  시나리오 A (삼성물산/전기, 2024-01=7389): YoY +0.8%, Z~0.9 → PASS")
    print("  시나리오 B (삼성물산/배출, 2024-01=2300): L2(>2150) FAIL")
    print("  시나리오 C (삼성전자/전기, 2024-01=13256): YoY +40% → L1 FAIL")
    print("  시나리오 D (삼성전자/배출, 2024-01=1650): YoY -2.9%, L2 미초과 → PASS")


def _insert_activity_data(client):
    """activity_data 삽입 (L3 원단위 탐지용)."""
    print("\n[STEP 4] activity_data 삽입 (L3용)...")

    rows = []
    # 삼성물산: 전기 소비량 / 0.75 집약도 기준 production_qty
    for date, elec in ACT_SAMSUNG_CORP.items():
        rows.append({
            "site_id"        : "삼성물산",
            "reporting_date" : date,
            "production_qty" : _noise(elec / INTENSITY_CORP),
            "unit"           : "Ton",
        })
    # 삼성전자: 정상 집약도 유지 (2024-01은 전기 급증하지만 생산량은 정상)
    # → intensity = 전기/생산 이 급증 → L3 탐지 가능
    for date, elec in ACT_SAMSUNG_ELEC.items():
        if date == "2024-01-01":
            # 생산량은 과거 평균 수준 유지 → intensity 급등
            avg_elec = sum(v for d, v in ACT_SAMSUNG_ELEC.items() if d != "2024-01-01") / 12
            rows.append({
                "site_id"        : "삼성전자",
                "reporting_date" : date,
                "production_qty" : _noise(avg_elec / INTENSITY_ELEC),
                "unit"           : "Ton",
            })
        else:
            rows.append({
                "site_id"        : "삼성전자",
                "reporting_date" : date,
                "production_qty" : _noise(elec / INTENSITY_ELEC),
                "unit"           : "Ton",
            })

    try:
        res = client.table("activity_data").insert(rows).execute()
        print(f"  {len(res.data)}건 삽입 완료")
    except Exception as e:
        print(f"  삽입 오류: {e}")


def _upsert_threshold_limits(client):
    """threshold_limits 설정."""
    print("\n[STEP 5] threshold_limits 설정...")
    for rec in THRESHOLD_RECORDS:
        # 기존 삭제 후 재삽입
        client.table("threshold_limits").delete()\
            .eq("site_id", rec["site_id"])\
            .eq("metric_name", rec["metric_name"])\
            .execute()
        client.table("threshold_limits").insert(rec).execute()
        print(f"  [{rec['site_id']}] {rec['metric_name']} upper_limit={rec['upper_limit']:,.1f} {rec['unit']}")


def _insert_evidence_usage(client):
    """evidence_usage 삽입 (시나리오별 최종 목표월 2024-01 only)."""
    print("\n[STEP 6] evidence_usage 삽입 (4건 - 시나리오별 2024-01)...")

    TARGET_DATE = "2024-01-01"
    evidence_rows = [
        # A: 일치 (db_value = ocr_value)
        {
            "site_id"       : "삼성물산",
            "reporting_date": TARGET_DATE,
            "metric_name"   : "구매_전기_소비량",
            "unit"          : SCEN_A_UNIT,
            "ocr_value"     : SCEN_A_EVID,
            "file_name"     : "scen_A_corp_elec_2024-01.pdf",
        },
        # B: 불일치 (db_value=2300, ocr_value=1950)
        {
            "site_id"       : "삼성물산",
            "reporting_date": TARGET_DATE,
            "metric_name"   : "기준 연도 Scope 1, 2, 3 배출량",
            "unit"          : SCEN_B_UNIT,
            "ocr_value"     : SCEN_B_EVID,
            "file_name"     : "scen_B_corp_co2_2024-01.pdf",
        },
        # C: 일치 (db_value = ocr_value)
        {
            "site_id"       : "삼성전자",
            "reporting_date": TARGET_DATE,
            "metric_name"   : "구매_전기_소비량",
            "unit"          : SCEN_C_UNIT,
            "ocr_value"     : SCEN_C_EVID,
            "file_name"     : "scen_C_elec_elec_2024-01.pdf",
        },
        # D: 불일치 (db_value=1650, ocr_value=1450)
        {
            "site_id"       : "삼성전자",
            "reporting_date": TARGET_DATE,
            "metric_name"   : "기준 연도 Scope 1, 2, 3 배출량",
            "unit"          : SCEN_D_UNIT,
            "ocr_value"     : SCEN_D_EVID,
            "file_name"     : "scen_D_elec_co2_2024-01.pdf",
        },
    ]

    try:
        res = client.table("evidence_usage").insert(evidence_rows).execute()
        print(f"  {len(res.data)}건 삽입 완료")
    except Exception as e:
        print(f"  삽입 오류: {e}")

    print("\n  [증빙 정합성 예상]")
    print(f"  A: db=7389.037  ocr={SCEN_A_EVID}  → 일치 (gap=0)")
    print(f"  B: db=2300.0    ocr={SCEN_B_EVID}  → 불일치 (gap={2300.0 - SCEN_B_EVID:.1f})")
    print(f"  C: db=13256.1   ocr={SCEN_C_EVID}  → 일치 (gap=0)")
    print(f"  D: db=1650.0    ocr={SCEN_D_EVID}  → 불일치 (gap={1650.0 - SCEN_D_EVID:.1f})")


def _insert_site_metric_map(client):
    """site_metric_map 삽입 (OCR 문서 → 사업장 매핑용)."""
    print("\n[STEP 7] site_metric_map 삽입...")
    inserted = 0
    for rec in SITE_METRIC_MAP_RECORDS:
        try:
            client.table("site_metric_map").upsert(
                rec, on_conflict="customer_number"
            ).execute()
            inserted += 1
        except Exception as e:
            print(f"  [{rec['customer_number']}] 오류: {e}")
    print(f"  {inserted}건 삽입 완료")


def _print_summary(client):
    """삽입 결과 요약 출력."""
    print("\n" + "=" * 65)
    print("  [최종 확인] DB 상태")
    print("=" * 65)

    sd = client.table("standardized_data").select("v_status, site_id, metric_name").execute().data
    from collections import Counter
    dist = dict(Counter(r["v_status"] for r in sd))
    combos = len(set((r["site_id"], r["metric_name"]) for r in sd))
    print(f"  standardized_data : {len(sd)}건  v_status분포={dist}  조합={combos}개")

    ev = client.table("evidence_usage").select("id").execute().data
    print(f"  evidence_usage    : {len(ev)}건")

    tl = client.table("threshold_limits").select("site_id, metric_name, upper_limit").execute().data
    print(f"  threshold_limits  : {len(tl)}건")
    for r in tl:
        print(f"    [{r['site_id']}] {r['metric_name']} → {r['upper_limit']:,.1f}")

    act = client.table("activity_data").select("activity_id").execute().data
    print(f"  activity_data     : {len(act)}건")

    smm = client.table("site_metric_map").select("customer_number").execute().data
    print(f"  site_metric_map   : {len(smm)}건")

    print("\n" + "=" * 65)
    print("  [다음 단계]")
    print("  1. UI: 이상치·정합성 검증 페이지 접속 → '검증 시작' 버튼 클릭")
    print("  2. 또는 curl: POST /api/v1/outliers/detect")
    print("  3. 기대 결과:")
    print("       시나리오 A (삼성물산/전기)   → v_status = 5")
    print("       시나리오 B (삼성물산/배출)   → v_status = 4  ← L2 이상치 + 증빙 불일치")
    print("       시나리오 C (삼성전자/전기)   → v_status = 3  ← L1 YoY 이상치 + 증빙 일치")
    print("       시나리오 D (삼성전자/배출)   → v_status = 2  ← 증빙 불일치")
    print("       baseline 12개월 (전 시나리오) → v_status = 5  (fallback)")
    print("=" * 65)


# ─────────────────────────────────────────────────────────────────────────────
#  메인
# ─────────────────────────────────────────────────────────────────────────────

def main():
    auto_yes = "--yes" in sys.argv

    print("=" * 65)
    print("  E2E 테스트 데이터 준비 스크립트")
    print("=" * 65)
    print()
    print("  [주의] 이 스크립트는 운영 데이터를 완전 초기화합니다.")
    print("         (verification_logs, outlier_results, standardized_data,")
    print("          raw_data, evidence_usage, activity_data 등)")
    print()

    if not auto_yes:
        ans = input("  계속하시겠습니까? (yes 입력): ")
        if ans.strip().lower() != "yes":
            print("취소되었습니다.")
            sys.exit(0)

    client = get_supabase_client()

    # STEP 0: 초기화
    _clear_pipeline(client)

    # STEP 1: master_sites 확인
    _ensure_sites(client)

    # STEP 2: data_points FK 확인
    metric_names = [
        "구매_전기_소비량",
        "기준 연도 Scope 1, 2, 3 배출량",
    ]
    dp_map = _get_data_point_ids(client, metric_names)

    missing = [m for m in metric_names if m not in dp_map]
    if missing:
        print(f"\n[오류] data_points에 존재하지 않는 지표: {missing}")
        print("  → DB에 해당 data_points 레코드를 먼저 삽입해야 합니다.")
        print("  → SQL: INSERT INTO data_points (name, unit) VALUES ('지표명', '단위');")
        sys.exit(1)

    # STEP 3: standardized_data 삽입
    _insert_standardized_data(client, dp_map)

    # STEP 4: activity_data 삽입
    _insert_activity_data(client)

    # STEP 5: threshold_limits 설정
    _upsert_threshold_limits(client)

    # STEP 6: evidence_usage 삽입
    _insert_evidence_usage(client)

    # STEP 7: site_metric_map 삽입
    _insert_site_metric_map(client)

    # 최종 요약
    _print_summary(client)


if __name__ == "__main__":
    main()
