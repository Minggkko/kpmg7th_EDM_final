# app/api/v1/outliers.py
# EDM 파이프라인 STEP 1·2·3 — 이상치 탐지 / AI 진단 / 소명 처리

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies import get_current_user
from app.services.outlier_pipeline.outlier_detection import detect_outliers
from app.services.outlier_pipeline.outlier_llm import analyze_outlier_with_llm
from app.services.outlier_pipeline.outlier_management import update_outlier_justification, get_outlier_detail

router = APIRouter()


# ── Request 스키마 ─────────────────────────────────────────────────────────────

class JustifyRequest(BaseModel):
    user_feedback: str
    action_taken: str
    justification_type: str = "user_input"
    outlier_id: Optional[int] = None


# ── STEP 1: 이상치 탐지 실행 ──────────────────────────────────────────────────

@router.post("/detect")
async def run_outlier_detection(
    site_id: Optional[str] = None,
    metric_name: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """
    v_status=0(Pending) 레코드에 대해 L1/L2/L3 이상치 탐지를 실행합니다.
    - site_id, metric_name 미입력 시 전체 대상 처리
    """
    try:
        result = detect_outliers(site_id=site_id, metric_name=metric_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── STEP 2: AI 진단 실행 ──────────────────────────────────────────────────────

@router.post("/analyze")
async def run_llm_analysis(
    outlier_id: Optional[int] = None,
    current_user=Depends(get_current_user),
):
    """
    analysis_summary가 NULL인 outlier_results에 GPT-4o 진단 보고서를 생성합니다.
    - outlier_id 미입력 시 미처리 전건 처리
    """
    try:
        result = analyze_outlier_with_llm(outlier_id=outlier_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── STEP 3: 소명 제출 ─────────────────────────────────────────────────────────

@router.post("/{std_id}/justify")
async def submit_justification(
    std_id: int,
    body: JustifyRequest,
    current_user=Depends(get_current_user),
):
    """
    이상치(v_status=2)에 대해 소명을 제출합니다.
    - action_taken='정상' 입력 시 v_status 2→1로 전환
    """
    try:
        result = update_outlier_justification(
            std_id=std_id,
            user_feedback=body.user_feedback,
            action_taken=body.action_taken,
            created_by=current_user.id,
            justification_type=body.justification_type,
            outlier_id=body.outlier_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 이상치 상세 조회 ──────────────────────────────────────────────────────────

@router.get("/{std_id}")
async def get_outlier_info(
    std_id: int,
    current_user=Depends(get_current_user),
):
    """
    특정 표준화 데이터의 이상치 탐지 결과 + 소명 이력을 반환합니다.
    """
    try:
        result = get_outlier_detail(std_id=std_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
