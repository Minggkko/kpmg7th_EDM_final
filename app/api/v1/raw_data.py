# app/api/v1/raw_data.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.config import get_settings
from app.core.dependencies import get_current_user, get_supabase
from app.services.raw_data_service import RawDataService

router = APIRouter()
settings = get_settings()

ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}

@router.post("/upload")
async def upload_raw_data(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 파일 형식: {ext}")

    if "_raw." not in file.filename:
        raise HTTPException(status_code=400, detail="파일명 형식 오류: source_type_source_name_raw.csv")

    # user_profiles에서 username 조회 (.single() 대신 limit(1) 사용 → 레코드 없어도 안전)
    supabase = get_supabase()
    try:
        profile_res = supabase.table("user_profiles").select("username").eq("id", str(current_user.id)).limit(1).execute()
        uploaded_by = profile_res.data[0]["username"] if profile_res.data else str(current_user.id)
    except Exception:
        uploaded_by = str(current_user.id)

    file_bytes = await file.read()

    service = RawDataService()

    result = await service.process_upload(
        file_bytes=file_bytes,
        file_name=file.filename,
        uploaded_by=uploaded_by,
    )

    return result
