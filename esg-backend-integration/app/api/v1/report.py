# app/api/v1/report.py
# 보고서 생성 / 편집 / 내보내기

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.dependencies import get_current_user

# ── 보고서 관련 모듈 (프로젝트 루트에 위치) ──────────────────────────────────
try:
    from esg_report_builder import generate_report as _run_generate
    from report_editor      import load_draft, update_field, save_draft_file
    from report_exporter    import export_report
except ImportError:
    # 모듈이 없을 경우 더미로 대체 (개발 환경)
    _run_generate    = None
    load_draft       = None
    update_field     = None
    save_draft_file  = None
    export_report    = None

router = APIRouter()

DRAFT_PATH = "esg_report_output_draft.json"
EXPORT_DIR = "exports"


# ── Request 스키마 ─────────────────────────────────────────────────────────────

class UpdateFieldRequest(BaseModel):
    field_id:   str
    field_type: Literal["context", "commentary"]
    new_value:  str


class ExportRequest(BaseModel):
    draft_id: str | None = None
    format:   Literal["pdf", "docx", "hwp"] = "docx"


# ── 1. 보고서 생성 ─────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate(current_user=Depends(get_current_user)):
    """
    Supabase DB + GPT-4o-mini 로 보고서 초안을 생성합니다.
    - framword.json 목차 기반
    - standardized_data 실측값 조회
    - 항목별 AI 해설 자동 생성
    소요 시간: 항목 수 × 약 2~3초
    """
    if _run_generate is None:
        raise HTTPException(status_code=503, detail="보고서 생성 모듈이 설치되지 않았습니다.")

    try:
        _run_generate()
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


# ── 2. 초안 조회 ───────────────────────────────────────────────────────────────

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


# ── 3. 필드 수정 ───────────────────────────────────────────────────────────────

@router.patch("/draft/field")
async def patch_field(body: UpdateFieldRequest, current_user=Depends(get_current_user)):
    """초안 내 특정 필드(context / commentary)를 수정하고 저장합니다."""
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


# ── 4. 파일 내보내기 ──────────────────────────────────────────────────────────

@router.post("/export")
async def export(body: ExportRequest, current_user=Depends(get_current_user)):
    """
    보고서를 지정된 포맷으로 내보냅니다.
    format: "pdf" | "docx" | "hwp"
    """
    if export_report is None:
        raise HTTPException(status_code=503, detail="내보내기 모듈이 설치되지 않았습니다.")

    if not Path(DRAFT_PATH).exists():
        raise HTTPException(status_code=404, detail="초안 파일이 없습니다.")

    try:
        draft     = load_draft(DRAFT_PATH)
        file_path = export_report(draft, output_dir=EXPORT_DIR, fmt=body.format)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"내보내기 실패: {e}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="파일 생성에 실패했습니다.")

    media_types = {
        "pdf":  "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "hwp":  "application/x-hwp",
    }

    return FileResponse(
        path=file_path,
        media_type=media_types.get(body.format, "application/octet-stream"),
        filename=os.path.basename(file_path),
        headers={"Content-Disposition": f'attachment; filename="{os.path.basename(file_path)}"'},
    )