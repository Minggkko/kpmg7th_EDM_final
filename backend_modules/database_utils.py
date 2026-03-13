"""
database_utils.py
-----------------
Supabase 클라이언트 초기화 및 공통 DB 유틸리티 모듈.

모든 backend_modules 파일은 이 모듈을 통해 DB 연결을 획득합니다.
직접 실행 시 연결 상태를 검증합니다.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# .env 파일 탐색: 모듈 디렉토리 → 프로젝트 루트 순으로 확인
_MODULE_DIR = Path(__file__).resolve().parent      # backend_modules/
_ROOT       = _MODULE_DIR.parent                   # kpmg7th_EDM_final/
_ENV_PATHS = [
    _MODULE_DIR / ".env",   # backend_modules/.env (우선 탐색)
    _ROOT       / ".env",   # kpmg7th_EDM_final/.env (fallback)
]

def _load_env() -> None:
    """환경 변수 파일을 탐색하여 로드합니다."""
    for env_path in _ENV_PATHS:
        if env_path.exists():
            load_dotenv(dotenv_path=env_path, override=False)
            return
    # 파일이 없어도 시스템 환경 변수로 동작 가능하므로 경고만 출력
    print("⚠️  .env 파일을 찾지 못했습니다. 시스템 환경 변수를 사용합니다.")


_load_env()

# ── 싱글턴 클라이언트 ──────────────────────────────────────────────────────────
_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    """
    Supabase 클라이언트 싱글턴을 반환합니다.

    최초 호출 시 SUPABASE_URL / SUPABASE_KEY 환경 변수를 읽어 클라이언트를
    생성하고, 이후 호출에서는 동일 인스턴스를 재사용합니다.

    Returns
    -------
    Client
        초기화된 Supabase 클라이언트 인스턴스

    Raises
    ------
    EnvironmentError
        SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않은 경우
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL 또는 SUPABASE_KEY 환경 변수가 설정되지 않았습니다.\n"
            f"탐색한 .env 경로: {[str(p) for p in _ENV_PATHS]}"
        )

    _supabase_client = create_client(url, key)
    return _supabase_client


# ── 공통 헬퍼 함수 ─────────────────────────────────────────────────────────────

def fetch_all(table: str, filters: dict | None = None) -> list[dict]:
    """
    테이블에서 전체(또는 필터 조건에 맞는) 레코드를 반환합니다.

    Parameters
    ----------
    table : str
        조회할 Supabase 테이블 이름
    filters : dict, optional
        {컬럼명: 값} 형태의 동등(eq) 조건 딕셔너리

    Returns
    -------
    list[dict]
        조회된 레코드 목록
    """
    client = get_supabase_client()
    query = client.table(table).select("*")
    if filters:
        for col, val in filters.items():
            query = query.eq(col, val)
    return query.execute().data


def insert_record(table: str, record: dict) -> dict:
    """
    단일 레코드를 테이블에 삽입하고, 삽입된 레코드를 반환합니다.

    Parameters
    ----------
    table : str
        대상 Supabase 테이블 이름
    record : dict
        삽입할 데이터 딕셔너리

    Returns
    -------
    dict
        삽입 후 DB에서 반환된 레코드 (id 포함)
    """
    client = get_supabase_client()
    result = client.table(table).insert(record).execute()
    return result.data[0] if result.data else {}


def update_record(table: str, record_id: int, updates: dict) -> dict:
    """
    id 기준으로 단일 레코드를 업데이트하고, 업데이트된 레코드를 반환합니다.

    Parameters
    ----------
    table : str
        대상 Supabase 테이블 이름
    record_id : int
        업데이트할 레코드의 id (PK)
    updates : dict
        변경할 컬럼과 값의 딕셔너리

    Returns
    -------
    dict
        업데이트 후 DB에서 반환된 레코드
    """
    client = get_supabase_client()
    result = client.table(table).update(updates).eq("id", record_id).execute()
    return result.data[0] if result.data else {}


def fetch_one(table: str, record_id: int) -> dict | None:
    """
    id 기준으로 단일 레코드를 조회합니다.

    Parameters
    ----------
    table : str
        조회할 Supabase 테이블 이름
    record_id : int
        조회할 레코드의 id (PK)

    Returns
    -------
    dict | None
        레코드가 있으면 반환, 없으면 None
    """
    client = get_supabase_client()
    result = client.table(table).select("*").eq("id", record_id).execute()
    return result.data[0] if result.data else None


# ── 연결 검증 (직접 실행 시) ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔌 Supabase 연결 검증 중...")
    try:
        client = get_supabase_client()
        # 가장 가벼운 쿼리로 연결 상태 확인
        test = client.table("master_sites").select("site_id").limit(1).execute()
        print(f"✅ 연결 성공! master_sites 조회 결과: {test.data}")
    except Exception as e:
        print(f"❌ 연결 실패: {e}")
