from supabase import create_client, Client
from app.core.config import get_settings
from functools import lru_cache

settings = get_settings()


@lru_cache()
def get_supabase_client() -> Client:
    """
    service_role key 사용 → RLS 우회 가능 (서버 내부 로직용)
    프론트에서는 절대 사용 금지
    """
    return create_client(settings.supabase_url, settings.supabase_service_key)
