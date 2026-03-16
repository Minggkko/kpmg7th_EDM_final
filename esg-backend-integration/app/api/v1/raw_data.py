# app/api/v1/raw_data.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.supabase import get_supabase_client
from app.services.raw_data_service import RawDataService

router = APIRouter()
settings = get_settings()

ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}


@router.get("/")
async def list_raw_data(
    source_type: str = None,
    site_id: str = None,
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    """raw_data 목록 조회 (최신순, 기본 20건)"""
    sb = get_supabase_client()
    query = sb.table("raw_data").select("*").order("created_at", desc=True).limit(limit)
    if source_type:
        query = query.eq("source_type", source_type)
    if site_id:
        query = query.eq("site_id", site_id)
    res = query.execute()
    return {"count": len(res.data), "data": res.data}

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

    file_bytes = await file.read()
    user_id = getattr(current_user, "id", None) or str(current_user)

    service = RawDataService()

    result = await service.process_upload(
        file_bytes=file_bytes,
        file_name=file.filename,
        uploaded_by=user_id,
    )

    return result
