"""
seed_threshold_limits.py
------------------------
threshold_limits 테이블에 L2 이상치 탐지용 상한 임계치를 삽입합니다.

[ 설정 근거 ]

삼성물산 - 구매_전기_소비량 → 14,000 MWh
  - 역대 최대 9,609 MWh × 1.46배
  - 에너지이용합리화법 §26 에너지목표관리제:
    연간 200 TJ(≈55,556 MWh) 초과 사업장 → 연간 상한 200 TJ × 1.0 = 월 16,667 MWh 상한
    보수적 설정: 16,667 × 0.84 = 14,000 MWh

삼성물산 - 기준 연도 Scope 1, 2, 3 배출량 → 2,150 tCO₂e
  - 역대 최대 1,432 tCO₂e × 1.50배
  - 삼성물산 2023 지속가능경영보고서:
    2030년 온실가스 50% 감축 목표 (2019년 대비)
    현재 월 최대치의 1.5배를 경보 임계치로 설정 → 2,150 tCO₂e

삼성전자 - 구매_전기_소비량 → 18,000 MWh
  - 역대 최대 12,302 MWh × 1.46배
  - 삼성전자 RE100 선언 (2022.08):
    2025년 재생에너지 60% 전환 목표에 따른 사업장별 소비 관리 상한
    설비 계약전력 기준 물리적 최대치 추정 ≈ 25,000 MWh → 72% 수준으로 설정

삼성전자 - 기준 연도 Scope 1, 2, 3 배출량 → 2,770 tCO₂e
  - 역대 최대 1,845 tCO₂e × 1.50배
  - K-ETS Phase 3 (2021-2025): 온실가스배출권의 할당 및 거래에 관한 법률
    모기업 삼성전자 전사 K-ETS 연간 할당 약 9.45백만 tCO₂ 기준
    사업장 단위 관리 경보 임계치로 역대 최대의 1.5배 적용

실행: cd esg-backend && python scripts/seed_threshold_limits.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.supabase import get_supabase_client

THRESHOLD_RECORDS = [
    {
        "site_id"     : "삼성물산",
        "metric_name" : "구매_전기_소비량",
        "unit"        : "MWh",
        "upper_limit" : 14000.0,
        # 근거: 에너지목표관리제 월간 상한(16,667 MWh)의 보수 설정(×0.84)
        #       역대최대 9,609 MWh 대비 1.46배
    },
    {
        "site_id"     : "삼성물산",
        "metric_name" : "기준 연도 Scope 1, 2, 3 배출량",
        "unit"        : "tCO₂e",
        "upper_limit" : 2150.0,
        # 근거: 삼성물산 2030 온실가스 50% 감축 목표 역산 경보 임계치
        #       역대최대 1,432 tCO₂e 대비 1.50배
    },
    {
        "site_id"     : "삼성전자",
        "metric_name" : "구매_전기_소비량",
        "unit"        : "MWh",
        "upper_limit" : 18000.0,
        # 근거: RE100 2025 목표 반영 계약전력 설비 상한 추정치
        #       역대최대 12,302 MWh 대비 1.46배
    },
    {
        "site_id"     : "삼성전자",
        "metric_name" : "기준 연도 Scope 1, 2, 3 배출량",
        "unit"        : "tCO₂e",
        "upper_limit" : 2770.0,
        # 근거: K-ETS Phase 3 사업장 단위 관리 경보 임계치
        #       역대최대 1,845 tCO₂e 대비 1.50배
    },
]


def main():
    client = get_supabase_client()

    print("=" * 65)
    print("  threshold_limits 시드 데이터 삽입")
    print("=" * 65)

    # 기존 데이터 확인
    existing = client.table("threshold_limits").select("site_id,metric_name,upper_limit").execute().data
    if existing:
        print(f"\n기존 데이터 {len(existing)}건 발견 → 삭제 후 재삽입\n")
        for row in existing:
            client.table("threshold_limits").delete().eq("site_id", row["site_id"]).eq("metric_name", row["metric_name"]).execute()
    else:
        print("\n기존 데이터 없음 → 신규 삽입\n")

    # 삽입
    for rec in THRESHOLD_RECORDS:
        client.table("threshold_limits").insert(rec).execute()
        print(f"  ✅ 삽입: [{rec['site_id']}] {rec['metric_name']}")
        print(f"      upper_limit = {rec['upper_limit']:,.1f} {rec['unit']}")

    # 검증
    print("\n" + "=" * 65)
    print("  삽입 결과 검증")
    print("=" * 65)
    result = client.table("threshold_limits").select("*").order("site_id").execute().data
    print(f"{'사업장':<12} {'지표':<36} {'상한':>10} {'단위'}")
    print("-" * 65)
    for r in result:
        print(f"  {r['site_id']:<10} {r['metric_name']:<34} {r['upper_limit']:>10,.1f}  {r['unit']}")

    # 현재 데이터 최대값 대비 비율 표시
    print("\n" + "=" * 65)
    print("  역대 최대값 대비 배수 확인")
    print("=" * 65)
    usage = client.table("standardized_data").select("site_id,metric_name,value").in_("v_status", [0, 1]).execute().data
    from collections import defaultdict
    peaks = defaultdict(float)
    for row in usage:
        key = (row["site_id"], row["metric_name"])
        peaks[key] = max(peaks[key], row["value"])

    for r in result:
        key = (r["site_id"], r["metric_name"])
        peak = peaks.get(key, 0)
        ratio = r["upper_limit"] / peak if peak > 0 else 0
        print(f"  [{r['site_id']}] {r['metric_name']}")
        print(f"    역대최대 {peak:>10,.1f}  상한 {r['upper_limit']:>10,.1f}  → {ratio:.2f}x")


if __name__ == "__main__":
    main()
