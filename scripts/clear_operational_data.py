"""
clear_operational_data.py
--------------------------
운영 데이터(raw_data, standardized_data 등)를 삭제합니다.
마스터 테이블과 사용자/회사 정보는 유지합니다.

삭제 대상 (FK 역순):
  1. verification_logs
  2. justification_logs
  3. audit_trail
  4. outlier_results
  5. standardized_data
  6. raw_data
  7. raw_ocr_data
  8. evidence_usage
  9. activity_data

유지 대상 (master / user):
  companies, user_profiles, esg_category, master_sites,
  issues, indicators, data, data_points, data_point_synonyms,
  threshold_limits, site_metric_map

실행 방법:
  python -m scripts.clear_operational_data           # 프로덕션 DB
  APP_ENV=test python -m scripts.clear_operational_data  # 테스트 DB
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import get_supabase_client
from app.core.config import get_settings

settings = get_settings()

# ── 삭제 순서 (FK 의존성 역순) ────────────────────────────────────────────────
# ON DELETE CASCADE 가 걸린 테이블도 명시적으로 삭제
TABLES_TO_CLEAR = [
    "verification_logs",   # standardized_data, evidence_usage 참조
    "justification_logs",  # standardized_data, outlier_results 참조
    "audit_trail",         # standardized_data 참조
    "outlier_results",     # standardized_data 참조
    "standardized_data",   # raw_data, data_points 참조
    "raw_data",            # 독립
    "raw_ocr_data",        # 독립
    # evidence_usage / activity_data 는 기본적으로 유지
    # (파이프라인 테스트 시 OCR 증빙 재업로드 없이도 v_status=2 항목 발생 가능하도록)
    # 완전 초기화가 필요하면 아래 FULL_CLEAR=True 로 실행
]

TABLES_TO_CLEAR_FULL = [
    *TABLES_TO_CLEAR,
    "evidence_usage",
    "activity_data",
]

# PK 컬럼명이 id가 아닌 테이블
PK_MAP = {
    "audit_trail"       : "trail_id",
    "activity_data"     : "activity_id",
    "verification_logs" : "log_id",
}


def clear_table(client, table: str) -> int:
    pk = PK_MAP.get(table, "id")
    try:
        res = client.table(table).delete().gte(pk, 0).execute()
        count = len(res.data) if res.data else 0
        print(f"  [{table}] {count}건 삭제 완료")
        return count
    except Exception as e:
        # gte(pk, 0) 실패 시 neq 방식으로 재시도
        try:
            res = client.table(table).delete().neq(pk, -999999).execute()
            count = len(res.data) if res.data else 0
            print(f"  [{table}] {count}건 삭제 완료")
            return count
        except Exception as e2:
            print(f"  [{table}] 삭제 실패: {e2}")
            return 0


def main():
    print("=" * 55)
    print("운영 데이터 삭제 스크립트")
    print("=" * 55)
    print(f"대상 DB : {settings.supabase_url}")
    print(f"APP_ENV : {os.getenv('APP_ENV', 'development')}")
    print()

    full_clear = "--full" in sys.argv
    tables = TABLES_TO_CLEAR_FULL if full_clear else TABLES_TO_CLEAR

    if full_clear:
        print("[모드] 완전 초기화 (evidence_usage, activity_data 포함)")
    else:
        print("[모드] 파이프라인 초기화 (evidence_usage, activity_data 유지)")
        print("       완전 초기화: python -m scripts.clear_operational_data --full")
    print()

    # 안전 확인 (프로덕션은 명시적 확인 요구)
    if os.getenv("APP_ENV") != "test":
        ans = input("[경고] 프로덕션 DB입니다. 정말 삭제하시겠습니까? (yes 입력): ")
        if ans.strip().lower() != "yes":
            print("취소되었습니다.")
            sys.exit(0)
    else:
        ans = input("테스트 DB 운영 데이터를 삭제합니다. 계속하시겠습니까? (yes 입력): ")
        if ans.strip().lower() != "yes":
            print("취소되었습니다.")
            sys.exit(0)

    print()
    client = get_supabase_client()
    total = 0

    for table in tables:
        total += clear_table(client, table)

    print()
    print(f"=== 완료: 총 {total}건 삭제 ===")
    print()
    print("[유지된 테이블]")
    kept = [
        "companies", "user_profiles", "esg_category", "master_sites",
        "issues", "indicators", "data", "data_points",
        "data_point_synonyms", "threshold_limits", "site_metric_map",
    ]
    for t in kept:
        try:
            cnt = len(client.table(t).select("id" if t not in ["master_sites", "threshold_limits", "site_metric_map"] else "site_id").execute().data)
            print(f"  {t}: {cnt}건 유지")
        except Exception:
            print(f"  {t}: 확인 불가")


if __name__ == "__main__":
    main()
