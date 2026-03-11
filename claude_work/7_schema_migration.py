"""
7_schema_migration.py
---------------------
ESG 데이터 신뢰성 검증 시스템 - DB 스키마 마이그레이션 자동화 스크립트.

실행 방법
---------
  python claude_work/7_schema_migration.py

연결 방식 우선순위
-----------------
  1. .env의 SUPABASE_DB_URL (직접 PostgreSQL 연결) → psycopg2 사용
  2. 없을 경우 → migration_schema_v1.sql 수동 실행 안내 출력

SUPABASE_DB_URL 형식
--------------------
  postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
  (Supabase 대시보드 → Settings → Database → Connection string → URI 복사)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# .env 탐색
_ROOT = Path(__file__).resolve().parent.parent
for env_path in [_ROOT / ".env", _ROOT / "DB_postgresql" / ".env"]:
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        break

# SQL 파일 경로
SQL_FILE = Path(__file__).resolve().parent / "migration_schema_v1.sql"


def _print_manual_instructions():
    """자동 실행 불가 시 수동 실행 방법 출력"""
    print("\n" + "=" * 60)
    print("📋 수동 실행 안내 (Supabase SQL Editor)")
    print("=" * 60)
    print("1. https://supabase.com/dashboard 접속")
    print("2. 프로젝트 선택 → 좌측 메뉴 'SQL Editor' 클릭")
    print("3. 아래 파일 내용 전체 복사 후 붙여넣기 → [Run] 클릭")
    print(f"\n   📄 파일 경로: {SQL_FILE}")
    print("\n4. 실행 후 하단 결과에서 5개 테이블의 column_count 확인")
    print("=" * 60)


def run_migration_psycopg2(db_url: str, sql: str) -> bool:
    """psycopg2를 이용한 직접 PostgreSQL 실행"""
    try:
        import psycopg2
    except ImportError:
        print("⚠️  psycopg2 미설치. 설치 후 재시도: pip install psycopg2-binary")
        return False

    print("🔌 PostgreSQL 직접 연결 중...")
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()

        # SQL을 세미콜론 기준으로 분리하여 순차 실행
        statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]
        total = len(statements)

        print(f"📦 총 {total}개 SQL 구문 실행 시작...\n")
        for i, stmt in enumerate(statements, 1):
            try:
                cur.execute(stmt)
                # 첫 줄을 요약으로 출력
                first_line = stmt.splitlines()[0][:80]
                print(f"  ✅ [{i:02d}/{total}] {first_line}")
            except Exception as e:
                print(f"  ❌ [{i:02d}/{total}] 실패: {e}")
                print(f"      구문: {stmt[:120]}...")

        cur.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ DB 연결 실패: {e}")
        return False


def verify_migration():
    """마이그레이션 결과 검증 (Supabase SDK 활용)"""
    print("\n🔍 마이그레이션 결과 검증 중...")
    try:
        sys.path.insert(0, str(_ROOT))
        from claude_work.backend_modules.database_utils import get_supabase_client
        client = get_supabase_client()

        check_list = {
            "standard_usage":    ["original_value", "updated_by", "updated_at", "correction_reason"],
            "outlier_results":   ["z_score", "yoy_roc", "intensity_deviation", "is_resolved"],
            "verification_logs": ["db_value", "ocr_value", "unit_mismatch", "verified_by", "approved_at"],
            "justification_logs": ["id", "std_id", "user_feedback", "action_taken", "created_by"],
            "audit_trail":       ["trail_id", "std_id", "action", "before_value", "after_value", "performed_by"],
        }

        all_ok = True
        print()
        for table, expected_cols in check_list.items():
            try:
                r = client.table(table).select("*").limit(1).execute()
                actual_cols = list(r.data[0].keys()) if r.data else []

                # SELECT *로 컬럼 목록 확인 (데이터 없으면 다른 방법 시도)
                if not actual_cols:
                    # 빈 테이블이어도 컬럼 확인: 빈 결과에서 컬럼 추출
                    r2 = client.table(table).select(",".join(expected_cols)).limit(1).execute()
                    missing = []
                else:
                    missing = [c for c in expected_cols if c not in actual_cols]

                if missing:
                    print(f"  ⚠️  [{table}] 미생성 컬럼: {missing}")
                    all_ok = False
                else:
                    print(f"  ✅ [{table}] 모든 컬럼 확인")

            except Exception as e:
                print(f"  ❌ [{table}] 접근 실패: {e}")
                all_ok = False

        print()
        if all_ok:
            print("🎉 마이그레이션 완료! 모든 테이블/컬럼이 정상 생성되었습니다.")
        else:
            print("⚠️  일부 항목을 확인하지 못했습니다. SQL을 직접 실행했는지 확인하세요.")

        return all_ok

    except Exception as e:
        print(f"❌ 검증 중 오류: {e}")
        return False


def main():
    print("=" * 60)
    print("🚀 ESG DB 스키마 마이그레이션 v1")
    print("=" * 60)

    # SQL 파일 로드
    if not SQL_FILE.exists():
        print(f"❌ SQL 파일을 찾을 수 없습니다: {SQL_FILE}")
        sys.exit(1)

    sql = SQL_FILE.read_text(encoding="utf-8")
    print(f"📄 SQL 파일 로드 완료: {SQL_FILE.name} ({len(sql)} bytes)\n")

    # 연결 방식 결정
    db_url = os.environ.get("SUPABASE_DB_URL")

    if db_url:
        print("🔑 SUPABASE_DB_URL 감지 → 직접 PostgreSQL 연결로 실행")
        success = run_migration_psycopg2(db_url, sql)
        if not success:
            _print_manual_instructions()
            sys.exit(1)
        # 자동 실행 성공 → 바로 검증
        print("\n" + "-" * 60)
        verify_migration()
    else:
        print("ℹ️  SUPABASE_DB_URL 없음 → Supabase SQL Editor에서 수동 실행 필요\n")
        _print_manual_instructions()
        print("\n💡 TIP: .env에 아래 항목을 추가하면 자동 실행 가능합니다:")
        print("   SUPABASE_DB_URL=postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres")
        print("\n🔍 SQL 실행 후 결과 검증은 아래 명령어로 실행하세요:")
        print("   python claude_work/7_schema_migration.py --verify-only\n")


if __name__ == "__main__":
    if "--verify-only" in sys.argv:
        verify_migration()
    else:
        main()
