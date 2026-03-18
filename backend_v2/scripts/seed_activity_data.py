"""
seed_activity_data.py
---------------------
activity_data 초기 데이터 삽입 스크립트

[설계 근거]
- GRI 302-3 에너지 집약도 = 구매 전기 소비량(MWh) / 생산량(ton)
- K-ETS 벤치마크 / 국내 온실가스 집약도 기준 (고시 제2023-1호)
  · 전자 제조업 전기 집약도: 1.0~1.5 MWh/ton
  · 건설·무역업 전기 집약도: 0.6~0.9 MWh/ton
  · 제조업 평균 CO₂ 집약도: 0.10~0.20 tCO₂e/ton

[production_qty 산출 방법]
- 삼성물산(건설/무역): 전기 집약도 기준 0.75 MWh/ton 가정
  → production_qty = 전기 소비량 실적 / 0.75
  · 이 값에 ±5% 독립 노이즈를 추가해 현실적인 intensity 분산 구현
  · 2023-01 기준 약 9,771 ton, 연간 약 110,000~130,000 ton

- 삼성전자(전자 제조): 전기 집약도 기준 1.15 MWh/ton 가정
  → production_qty = 전기 소비량 실적 / 1.15
  · 2023-01 기준 약 8,234 ton, 연간 약 110,000~130,000 ton

[이상치 탐지 관점]
- L3 정상 범위: intensity_dev < 50% (L3_INTENSITY_THRESHOLD)
- production_qty를 전기 소비량과 상관관계 있게 설정 → 정상 데이터는 L3 미탐지
- activity_data를 투입해야 L3 레이어가 활성화됨

실행: cd esg-backend && python scripts/seed_activity_data.py
"""

import sys
import os
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.supabase import get_supabase_client

# ── 전기 소비량 실측값 (standardized_data 기준) ───────────────────────────────
# 삼성물산 구매_전기_소비량 (MWh) — 2023-01 ~ 2024-12
ELEC_SAMSUNG_CORP = {
    "2023-01-01": 7328.942,  "2023-02-01": 6749.182,  "2023-03-01": 7147.704,
    "2023-04-01": 7840.044,  "2023-05-01": 8093.631,  "2023-06-01": 8356.780,
    "2023-07-01": 9373.149,  "2023-08-01": 9046.984,  "2023-09-01": 7837.942,
    "2023-10-01": 7792.052,  "2023-11-01": 7028.986,  "2023-12-01": 7990.677,
    "2024-01-01": 7389.037,  "2024-02-01": 7081.114,  "2024-03-01": 7688.573,
    "2024-04-01": 8043.072,  "2024-05-01": 8425.255,  "2024-06-01": 9065.746,
    "2024-07-01": 9609.343,  "2024-08-01": 9267.446,  "2024-09-01": 8602.654,
    "2024-10-01": 7819.810,  "2024-11-01": 7448.270,  "2024-12-01": 8619.241,
}

# 삼성전자 구매_전기_소비량 (MWh) — 2023-01 ~ 2024-12
ELEC_SAMSUNG_ELEC = {
    "2023-01-01": 9468.640,   "2023-02-01": 8718.370,   "2023-03-01": 9532.639,
    "2023-04-01": 9980.765,   "2023-05-01": 10629.886,  "2023-06-01": 11150.132,
    "2023-07-01": 12298.922,  "2023-08-01": 11431.416,  "2023-09-01": 10724.529,
    "2023-10-01": 9691.912,   "2023-11-01": 9484.746,   "2023-12-01": 10530.877,
    "2024-01-01": 9576.793,   "2024-02-01": 9455.252,   "2024-03-01": 9672.901,
    "2024-04-01": 10299.051,  "2024-05-01": 10668.619,  "2024-06-01": 11235.403,
    "2024-07-01": 12179.675,  "2024-08-01": 12302.691,  "2024-09-01": 10737.492,
    "2024-10-01": 10105.783,  "2024-11-01": 9994.948,   "2024-12-01": 11080.940,
}

# ── 집약도 기준 (GRI 302-3 / K-ETS 벤치마크) ────────────────────────────────
INTENSITY_CORP  = 0.75   # MWh/ton  — 삼성물산 (건설/무역)
INTENSITY_ELEC  = 1.15   # MWh/ton  — 삼성전자 (전자 제조)
NOISE_RATE      = 0.05   # ±5% 랜덤 노이즈 (현실적 분산)

random.seed(42)  # 재현 가능성 고정


def compute_production(elec_mwh: float, intensity: float) -> float:
    """
    전기 소비량과 집약도 기준으로 production_qty를 역산합니다.
    ±NOISE_RATE 노이즈를 추가해 intensity가 약간씩 변동하도록 합니다.
    """
    base = elec_mwh / intensity
    noise = 1.0 + random.uniform(-NOISE_RATE, NOISE_RATE)
    return round(base * noise, 2)


def main():
    client = get_supabase_client()

    # ── STEP 1: master_sites 확인 및 삽입 ────────────────────────────────────
    print("▶ master_sites 확인 중...")
    existing = client.table("master_sites").select("site_id").execute().data
    existing_ids = {r["site_id"] for r in existing}

    sites_to_insert = []
    if "삼성물산" not in existing_ids:
        sites_to_insert.append({"site_id": "삼성물산", "site_name": "삼성물산 주식회사"})
    if "삼성전자" not in existing_ids:
        sites_to_insert.append({"site_id": "삼성전자", "site_name": "삼성전자 주식회사"})

    if sites_to_insert:
        client.table("master_sites").insert(sites_to_insert).execute()
        for s in sites_to_insert:
            print(f"  ✅ master_sites INSERT: {s['site_id']}")
    else:
        print("  ℹ️  master_sites 이미 존재 — 삽입 생략")

    # ── STEP 2: 기존 activity_data 확인 ──────────────────────────────────────
    print("\n▶ 기존 activity_data 확인 중...")
    existing_act = client.table("activity_data").select("site_id, reporting_date").execute().data
    existing_keys = {(r["site_id"], r["reporting_date"]) for r in existing_act}
    print(f"  기존 건수: {len(existing_keys)}건")

    # ── STEP 3: production_qty 계산 및 삽입 ──────────────────────────────────
    print("\n▶ activity_data 삽입 중...")

    rows = []

    # 삼성물산
    for date, elec in ELEC_SAMSUNG_CORP.items():
        key = ("삼성물산", date)
        if key in existing_keys:
            continue
        rows.append({
            "site_id":        "삼성물산",
            "reporting_date": date,
            "production_qty": compute_production(elec, INTENSITY_CORP),
            "unit":           "Ton",
        })

    # 삼성전자
    for date, elec in ELEC_SAMSUNG_ELEC.items():
        key = ("삼성전자", date)
        if key in existing_keys:
            continue
        rows.append({
            "site_id":        "삼성전자",
            "reporting_date": date,
            "production_qty": compute_production(elec, INTENSITY_ELEC),
            "unit":           "Ton",
        })

    if not rows:
        print("  ℹ️  삽입할 데이터 없음 (이미 모두 존재)")
    else:
        result = client.table("activity_data").insert(rows).execute()
        print(f"  ✅ {len(result.data)}건 삽입 완료")

        # 검증 출력
        print("\n▶ 삽입된 데이터 집약도 검증 (GRI 302-3 기준)")
        print(f"  {'site_id':<10} {'date':<12} {'prod(ton)':>10} {'elec(MWh)':>10} {'intensity':>12}")
        print(f"  {'-'*58}")

        corp_rows = [(d, e) for d, e in ELEC_SAMSUNG_CORP.items()]
        elec_rows = [(d, e) for d, e in ELEC_SAMSUNG_ELEC.items()]

        for inserted in result.data[:6]:
            site = inserted["site_id"]
            date = inserted["reporting_date"]
            prod = inserted["production_qty"]
            # 원본 전기 소비량 매칭
            elec_map = ELEC_SAMSUNG_CORP if site == "삼성물산" else ELEC_SAMSUNG_ELEC
            # reporting_date가 date 타입으로 반환될 수 있으므로 앞 10자리 사용
            date_key = str(date)[:10] + "-01" if len(str(date)) == 7 else str(date)
            elec = elec_map.get(date_key, elec_map.get(str(date)[:10], 0))
            intensity = round(elec / prod, 4) if prod > 0 else 0
            print(f"  {site:<10} {str(date):<12} {prod:>10,.1f} {elec:>10,.1f} {intensity:>11.4f} MWh/ton")

    print("\n✅ seed_activity_data 완료")
    print("\n[다음 단계]")
    print("  python test_outlier_pipeline.py  ← 이상치 탐지 실행")


if __name__ == "__main__":
    main()
