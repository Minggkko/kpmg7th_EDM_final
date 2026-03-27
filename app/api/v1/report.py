# app/api/v1/report.py
# ESG 보고서 생성·편집·내보내기 라우터

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.services.report_pipeline.esg_report_builder import generate_report as _run_generate
from app.services.report_pipeline.report_editor import load_draft, update_field, save_draft_file
from app.services.report_pipeline.report_exporter import export_report, ExportFormat, HWPExportError

router = APIRouter()

# ── 파일 경로 상수 ─────────────────────────────────────────────────────────────
_SERVICE_DIR = Path(__file__).parent.parent.parent / "services" / "report_pipeline"
DRAFT_PATH   = str(_SERVICE_DIR / "esg_report_output_draft.json")
EXPORT_DIR   = str(_SERVICE_DIR / "exports")
HTML_PATH    = str(_SERVICE_DIR / "esg_report_output.html")


# ── Request 스키마 ─────────────────────────────────────────────────────────────

class UpdateFieldRequest(BaseModel):
    field_id:   str
    field_type: Literal["context", "commentary"]
    new_value:  str


class ExportRequest(BaseModel):
    draft_id: str | None = None
    format:   Literal["pdf", "docx", "hwp"] = "pdf"


# ══════════════════════════════════════════════════════════════════════════════
# 1. 보고서 생성
#    POST /report/generate
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/generate")
async def generate(current_user=Depends(get_current_user)):
    """
    보고서 생성 파이프라인 실행 후 초안 데이터를 반환합니다.

    - Supabase DB 3개 테이블 조회
    - framword.json 목차 필터링 + 구조 빌드
    - OpenAI GPT-4o-mini 항목별 ESG 해설 생성
    - esg_report_output_draft.json 저장

    소요 시간: 항목 수 × 약 2~3초 (OpenAI API)
    """
    try:
        _run_generate(output_path=HTML_PATH)
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보고서 생성 실패: {e}")

    if not Path(DRAFT_PATH).exists():
        raise HTTPException(status_code=500, detail="초안 파일이 생성되지 않았습니다.")

    try:
        return load_draft(DRAFT_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"초안 로드 실패: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 2. 초안 로드
#    GET /report/draft
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/draft")
async def get_draft(current_user=Depends(get_current_user)):
    """저장된 보고서 초안을 반환합니다."""
    if not Path(DRAFT_PATH).exists():
        raise HTTPException(
            status_code=404,
            detail="초안 파일이 없습니다. 먼저 보고서를 생성하세요."
        )
    try:
        return load_draft(DRAFT_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ══════════════════════════════════════════════════════════════════════════════
# 3. 필드 수정
#    PATCH /report/draft/field
# ══════════════════════════════════════════════════════════════════════════════

@router.patch("/draft/field")
async def patch_field(
    body: UpdateFieldRequest,
    current_user=Depends(get_current_user),
):
    """
    초안 내 특정 필드를 수정하고 파일에 저장합니다.

    field_type: "context" 또는 "commentary"
    """
    if not Path(DRAFT_PATH).exists():
        raise HTTPException(status_code=404, detail="초안 파일이 없습니다.")

    try:
        draft = load_draft(DRAFT_PATH)
        draft = update_field(draft, body.field_id, body.field_type, body.new_value)
        save_draft_file(draft, DRAFT_PATH)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True, "field_id": body.field_id, "field_type": body.field_type}


# ══════════════════════════════════════════════════════════════════════════════
# 4. 보고서 내보내기
#    POST /report/export
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/export")
async def export(
    body: ExportRequest,
    current_user=Depends(get_current_user),
):
    """
    보고서를 지정된 포맷으로 내보내고 파일을 다운로드합니다.

    format: "pdf" | "docx" | "hwp"
    HWP는 LibreOffice 설치 필요.
    """
    if not Path(DRAFT_PATH).exists():
        raise HTTPException(status_code=404, detail="초안 파일이 없습니다.")

    try:
        draft = load_draft(DRAFT_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"초안 로드 실패: {e}")

    try:
        file_path = export_report(draft, output_dir=EXPORT_DIR, fmt=body.format)
    except HWPExportError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"내보내기 실패: {e}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="파일 생성에 실패했습니다.")

    media_types = {
        "pdf":  "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "hwp":  "application/x-hwp",
    }
    media_type = media_types.get(body.format, "application/octet-stream")
    filename   = os.path.basename(file_path)

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
