"""
database_utils.py
-----------------
EDM 파이프라인용 DB 유틸리티 모듈.

Supabase 클라이언트는 app.core.supabase.get_supabase_client()에 위임합니다.
fetch_all / insert_record / update_record / fetch_one 헬퍼만 이 모듈에 유지합니다.
"""

from supabase import Client
from app.core.supabase import get_supabase_client


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
