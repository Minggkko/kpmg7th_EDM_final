"""
에너지 관리 이슈 테스트 데이터 삽입 스크립트
- '에너지 관리' 이슈의 data_points를 조회하여 standardized_data에 직접 삽입
- 사업장: 삼성물산, 삼성전자, 현대건설
- 기간: FY 2025 (2025-01 ~ 2025-12)
- v_status=1 (표준화완료)

실행: backend_v2/ 디렉토리에서
    python -m app.scripts.insert_test_energy_data
"""

import sys
import os
import random

# Windows 콘솔 UTF-8 출력 설정
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── 경로 설정 ─────────────────────────────────────────────────────────────────
_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, _BASE)

from app.core.config import get_settings
from supabase import create_client

settings = get_settings()
sb = create_client(settings.supabase_url, settings.supabase_service_key)

SITES = ["삼성물산", "삼성전자", "현대건설"]
FY_YEAR = 2025
SOURCE_TYPE = "계열사"

# 단위별 값 범위 (랜덤 생성용)
UNIT_RANGES = {
    "GJ":      (500,   5000),
    "MWh":     (100,   2000),
    "TJ":      (1,     50),
    "kWh":     (10000, 500000),
    "tCO2eq":  (50,    800),
    "tCO2e":   (50,    800),
    "Nm3":     (1000,  50000),
    "kL":      (100,   3000),
    "m3":      (500,   10000),
    "%":       (0,     100),
    "명":      (10,    500),
    "건":      (0,     50),
    "ton":     (100,   5000),
    "kg":      (1000,  100000),
}

def get_value_range(unit: str):
    u = (unit or "").strip()
    for key, rng in UNIT_RANGES.items():
        if key.lower() == u.lower():
            return rng
    return (10, 1000)  # 기본값


def main():
    print("=" * 60)
    print("에너지 관리 이슈 테스트 데이터 삽입")
    print("=" * 60)

    # 1. '에너지 관리' 이슈 조회
    issues_res = sb.table("issues").select("id, name").ilike("name", "%에너지%").execute()
    if not issues_res.data:
        print("❌ '에너지 관리' 이슈를 찾을 수 없습니다.")
        print("   → issues 테이블의 이슈명을 확인해주세요.")
        # 전체 이슈 목록 출력
        all_issues = sb.table("issues").select("id, name").execute()
        print("\n   현재 이슈 목록:")
        for i in all_issues.data:
            print(f"     [{i['id']}] {i['name']}")
        return

    issue = issues_res.data[0]
    print(f"\n✅ 이슈 발견: [{issue['id']}] {issue['name']}")

    # 2. indicators 조회
    ind_res = sb.table("indicators").select("id, name").eq("issue_id", issue["id"]).execute()
    indicators = ind_res.data or []
    print(f"   지표 수: {len(indicators)}개")

    # 3. data → data_points 조회
    all_datapoints = []
    for ind in indicators:
        data_res = sb.table("data").select("id, name").eq("indicator_id", ind["id"]).execute()
        for d in (data_res.data or []):
            dp_res = sb.table("data_points").select("id, name, unit").eq("data_id", d["id"]).execute()
            for dp in (dp_res.data or []):
                unit = (dp.get("unit") or "").strip()
                if unit.lower() == "text":
                    continue  # text 단위 제외
                all_datapoints.append({
                    "dp_id":   dp["id"],
                    "dp_name": dp["name"],
                    "unit":    unit,
                    "ind":     ind["name"],
                    "data":    d["name"],
                })

    if not all_datapoints:
        print("❌ 유효한 데이터포인트가 없습니다 (text 단위 제외 후)")
        return

    print(f"   데이터포인트 수 (text 제외): {len(all_datapoints)}개")
    print()

    # 4. 데이터 삽입
    rows = []
    months = [f"{m:02d}" for m in range(1, 13)]

    for site in SITES:
        for dp in all_datapoints:
            lo, hi = get_value_range(dp["unit"])
            base_val = random.uniform(lo, hi)
            for mm in months:
                # 월별 약간 변동 (-10% ~ +10%)
                val = round(base_val * random.uniform(0.9, 1.1), 2)
                reporting_date = f"{FY_YEAR}-{mm}-01"
                rows.append({
                    "source_type":                SOURCE_TYPE,
                    "site_id":                    site,
                    "reporting_date":             reporting_date,
                    "metric_name":                dp["dp_name"],
                    "data_point_id":              dp["dp_id"],
                    "value":                      val,
                    "unit":                       dp["unit"],
                    "raw_value_text":             str(val),
                    "original_value":             None,
                    "v_status":                   1,
                    "standardization_confidence": 1.0,
                    "updated_by":                 "system:test_insert",
                })

    print(f"삽입할 행 수: {len(rows)} ({len(SITES)}사업장 × {len(all_datapoints)}데이터포인트 × 12개월)")
    print(f"사업장: {', '.join(SITES)}")
    print()

    # 5. 배치 upsert (unique: source_type, site_id, reporting_date, metric_name)
    BATCH = 100
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        res = sb.table("standardized_data") \
            .upsert(batch, on_conflict="source_type,site_id,reporting_date,metric_name") \
            .execute()
        total += len(res.data)
        print(f"  [{i + len(batch)}/{len(rows)}] 삽입 완료...")

    print()
    print(f"✅ 완료! 총 {total}건 삽입/갱신")
    print()
    print("삽입된 데이터포인트 목록:")
    for dp in all_datapoints:
        print(f"  - [{dp['ind']}] {dp['data']} > {dp['dp_name']} ({dp['unit']})")


if __name__ == "__main__":
    main()
