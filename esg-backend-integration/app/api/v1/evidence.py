# app/api/v1/evidence.py
# EDM 파이프라인 STEP 0·4 — OCR 업로드 / 추출 / 증빙 정합성 검증

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Optional

from app.core.dependencies import get_current_user
from app.services.outlier_pipeline.evidence_extraction import extract_pending_ocr_data
from app.services.outlier_pipeline.evidence_verification import verify_evidence_data
from app.services.outlier_pipeline.ocr_service import process_ocr_upload, ALLOWED_EXTENSIONS

router = APIRouter()


# ── STEP 0-A: 증빙 파일 업로드 + Upstage OCR ─────────────────────────────────

@router.post("/upload-ocr")
async def upload_ocr_file(
    file: UploadFile = File(..., description="청구서 이미지 또는 PDF (jpg/png/pdf 등)"),
    current_user=Depends(get_current_user),
):
    """
    증빙 파일(청구서 이미지·PDF)을 업로드하면:
    1. Upstage Document OCR로 텍스트 추출
    2. GPT-4o로 customer_number / year / month / usage / unit 구조화
    3. raw_ocr_data 테이블에 저장 (processing_status='Pending')

    이후 POST /evidence/extract 를 호출하면 evidence_usage로 연계됩니다.

    지원 형식: jpg, jpeg, png, bmp, tiff, tif, heic, webp, pdf
    """
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식: '{ext}'. 지원: {sorted(ALLOWED_EXTENSIONS)}",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="빈 파일은 업로드할 수 없습니다.")

    user_id = getattr(current_user, "id", None) or str(current_user)

    result = process_ocr_upload(
        file_bytes=file_bytes,
        file_name=file.filename,
        uploaded_by=user_id,
    )

    if result["status"] == "error":
        raise HTTPException(status_code=422, detail=result["message"])

    return result


# ── STEP 0-B: raw_ocr_data(Pending) → evidence_usage 적재 ────────────────────

@router.post("/extract")
async def extract_ocr(
    file_name: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """
    raw_ocr_data(Pending) 를 파싱하여 evidence_usage에 적재합니다.
    - file_name 미입력 시 Pending 전건 처리
    - raw_ocr_data.processing_status → 'Extracted' 갱신
    """
    try:
        result = extract_pending_ocr_data(file_name=file_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── STEP 4: 증빙 정합성 검증 ─────────────────────────────────────────────────

@router.post("/verify")
async def verify_evidence(
    site_id: Optional[str] = None,
    metric_name: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """
    evidence_usage ↔ standardized_data(v_status=1) 를 비교하여 정합성을 검증합니다.

    gap 기준: gap_percent == 0.0 만 일치 처리 (완전 일치).
    v_status 결정은 outlier_results 존재 여부 + 증빙 일치 여부 조합:
      - PASS + 일치   → v_status=5 (자동 확정)
      - PASS + 불일치 → v_status=2
      - FAIL + 일치   → v_status=3
      - FAIL + 불일치 → v_status=4

    ※ detect_outliers() 실행 후 자동 호출되므로 단독 호출은 재검증 시에만 사용.
    """
    try:
        result = verify_evidence_data(
            site_id=site_id,
            metric_name=metric_name,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
