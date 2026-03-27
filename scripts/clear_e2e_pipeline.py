"""
clear_e2e_pipeline.py
---------------------
E2E 테스트 재실행을 위한 파이프라인 데이터 초기화 스크립트

[삭제 대상] (FK 역순)
  verification_logs   - standardized_data 참조
  justification_logs  - standardized_data, outlier_results 참조
  audit_trail         - standardized_data 참조
  outlier_results     - standardized_data 참조
  standardized_data   - raw_data, data_points 참조
  raw_data            - 원본 업로드 데이터
  raw_ocr_data        - OCR 원본 데이터

[유지 대상] (마스터 지원 데이터 -- seed_e2e_master.py 가 관리)
  master_sites, data_points, activity_data,
  threshold_limits, evidence_usage, site_metric_map

[사용 시나리오]
  CSV 재업로드 전 파이프라인을 깨끗하게 리셋

[실행 방법]
  cd backend_v2
  python -m scripts.clear_e2e_pipeline         # 확인 프롬프트
  python -m scripts.clear_e2e_pipeline --yes   # 자동 실행
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.supabase import get_supabase_client

# 삭제 순서 (FK 의존성 역순)
PIPELINE_TABLES = [
    ("verification_logs",  "log_id"),
    ("justification_logs", "id"),
    ("audit_trail",        "trail_id"),
    ("outlier_results",    "id"),
    ("standardized_data",  "id"),
    ("raw_data",           "id"),
    ("raw_ocr_data",       "id"),
]

# 유지 확인용
KEPT_TABLES = [
    ("master_sites",     "site_id"),
    ("activity_data",    "activity_id"),
    ("threshold_limits", "site_id"),
    ("evidence_usage",   "id"),
    ("site_metric_map",  "customer_number"),
]


def _delete_table(client, table: str, pk: str) -> int:
    try:
        res = client.table(table).delete().gte(pk, 0).execute()
        return len(res.data) if res.data else 0
    except Exception:
        pass
    try:
        res = client.table(table).delete().neq(pk, -999999).execute()
        return len(res.data) if res.data else 0
    except Exception as e:
        print(f"  [{table}] 삭제 실패: {e}")
        return 0


def _count_table(client, table: str, pk: str) -> int:
    try:
        res = client.table(table).select(pk).execute()
        return len(res.data) if res.data else 0
    except Exception:
        return -1


def main():
    auto_yes = "--yes" in sys.argv

    print("=" * 60)
    print("  E2E 파이프라인 데이터 초기화")
    print("=" * 60)
    print()
    print("  [삭제 대상]")
    for table, _ in PIPELINE_TABLES:
        print(f"    {table}")
    print()
    print("  [유지 대상]")
    for table, _ in KEPT_TABLES:
        print(f"    {table}")
    print()

    if not auto_yes:
        ans = input("  계속하시겠습니까? (yes 입력): ")
        if ans.strip().lower() != "yes":
            print("취소되었습니다.")
            sys.exit(0)

    client = get_supabase_client()
    total_deleted = 0

    print()
    print("[삭제 진행]")
    for table, pk in PIPELINE_TABLES:
        cnt = _delete_table(client, table, pk)
        print(f"  [{table}] {cnt}건 삭제")
        total_deleted += cnt

    print()
    print(f"  -> 총 {total_deleted}건 삭제 완료")

    print()
    print("[유지 테이블 현황]")
    for table, pk in KEPT_TABLES:
        cnt = _count_table(client, table, pk)
        status = f"{cnt}건" if cnt >= 0 else "확인 불가"
        print(f"  {table:20s}: {status}")

    print()
    print("=" * 60)
    print("  [다음 단계] CSV 업로드")
    print("=" * 60)
    print("  UI: 데이터 업로드 페이지 -> 파일 선택 -> 업로드")
    print("  파일 위치: backend_v2/test_data/")
    print("    1) 계열사_삼성물산_raw.csv")
    print("    2) 계열사_삼성전자_raw.csv")
    print()
    print("  업로드 후: 이상치.정합성 검증 페이지 -> 검증 시작")
    print("=" * 60)


if __name__ == "__main__":
    main()
