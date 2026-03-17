from fastapi import HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends
from supabase import create_client
from app.core.config import get_settings

settings = get_settings()
security = HTTPBearer()

def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials  # Bearer 뒤의 토큰만 자동 추출
    supabase = get_supabase()
    
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
