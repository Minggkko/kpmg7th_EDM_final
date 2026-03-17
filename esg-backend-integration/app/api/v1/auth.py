from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from fastapi import Depends
from supabase import create_client

router = APIRouter()
settings = get_settings()

def get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_key)

# ── Request 스키마 ──────────────────────────────────────────

class SignupRequest(BaseModel):
    username: str
    password: str
    display_name: str
    work_email: EmailStr
    company_id: int

    @field_validator('password')
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError('비밀번호는 최소 6자 이상이어야 합니다.')
        return v

class LoginRequest(BaseModel):
    username: str
    password: str

# ── 아이디 중복확인 ──────────────────────────────────────────

@router.get("/check-username/{username}")
async def check_username(username: str):
    supabase = get_supabase()
    result = supabase.table('user_profiles') \
        .select('id') \
        .eq('username', username) \
        .execute()
    return {"available": len(result.data) == 0}

# ── 회사 검색 ────────────────────────────────────────────────

@router.get("/companies")
async def search_companies(q: str = ""):
    supabase = get_supabase()
    query = supabase.table('companies').select('id, name, email_domain')
    if q:
        query = query.ilike('name', f'%{q}%')
    result = query.execute()
    return result.data

# ── 회원가입 ─────────────────────────────────────────────────

@router.post("/signup")
async def signup(req: SignupRequest):
    supabase = get_supabase()

    # 1. 아이디 중복 확인
    dup = supabase.table('user_profiles') \
        .select('id').eq('username', req.username).execute()
    if dup.data:
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")

    # 2. 회사 이메일 도메인 검증
    company = supabase.table('companies') \
        .select('email_domain') \
        .eq('id', req.company_id) \
        .single().execute().data
    if not company:
        raise HTTPException(status_code=404, detail="존재하지 않는 회사입니다.")

    email_domain = req.work_email.split('@')[-1]
    if email_domain != company['email_domain']:
        raise HTTPException(
            status_code=400,
            detail=f"회사 이메일 도메인이 일치하지 않습니다. ({company['email_domain']} 필요)"
        )

    # 3. Supabase Auth 계정 생성 후 이메일 즉시 인증 처리
    try:
        signup_res = supabase.auth.sign_up({
            "email": req.work_email,
            "password": req.password,
        })
        supabase.auth.admin.update_user_by_id(signup_res.user.id, {
            "email_confirm": True
        })
        user_id = signup_res.user.id
        actual_email = req.work_email  # ← 버그 수정
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"계정 생성 실패: {str(e)}")

    # 4. user_profiles 저장
    supabase.table('user_profiles').insert({
        "id": user_id,
        "username": req.username,
        "display_name": req.display_name,
        "company_id": req.company_id,
        "work_email": actual_email,
    }).execute()

    return {
        "message": "회원가입 성공",
        "user_id": user_id,
        "username": req.username,
    }

# ── 로그인 ───────────────────────────────────────────────────

@router.post("/login")
async def login(req: LoginRequest):
    supabase = get_supabase()

    profile = supabase.table('user_profiles') \
        .select('work_email, id') \
        .eq('username', req.username) \
        .single().execute().data
    if not profile:
        raise HTTPException(status_code=404, detail="존재하지 않는 아이디입니다.")

    try:
        auth_res = supabase.auth.sign_in_with_password({
            "email": profile['work_email'],
            "password": req.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"로그인 실패: {str(e)}")

    return {
        "access_token": auth_res.session.access_token,
        "refresh_token": auth_res.session.refresh_token,
        "user_id": auth_res.user.id,
        "username": req.username,
    }

# ── 내 정보 조회 ─────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
    supabase = get_supabase()
    profile = supabase.table('user_profiles') \
        .select('username, display_name, work_email, company_id') \
        .eq('id', current_user.id) \
        .single().execute().data
    if not profile:
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없습니다.")
    return profile

# ── 로그아웃 ─────────────────────────────────────────────────

@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    supabase = get_supabase()
    supabase.auth.sign_out()
    return {"message": "로그아웃 성공"}
