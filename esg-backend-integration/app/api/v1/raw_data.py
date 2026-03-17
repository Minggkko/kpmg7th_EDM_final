# app/api/v1/raw_data.py - 테스트 최소 버전
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import get_settings
from app.services.raw_data_service import RawDataService

router = APIRouter()
settings = get_settings()

ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}

@router.post("/upload")
async def upload_raw_data(
    file: UploadFile = File(...),
):
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 파일 형식: {ext}")

    if "_raw." not in file.filename:
        raise HTTPException(status_code=400, detail="파일명 형식 오류: source_type_source_name_raw.csv")

    file_bytes = await file.read()

    service = RawDataService(

    )

    result = await service.process_upload(
        file_bytes=file_bytes,
        file_name=file.filename,
        uploaded_by=None,
    )

    return result
