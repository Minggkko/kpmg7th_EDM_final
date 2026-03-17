# app/api/v1/finalization.py
# EDM 파이프라인 STEP 5 — 수치 보정 및 최종 확정

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.services.outlier_pipeline.data_finalization import (
    finalize_usage_data,
    revert_finalization,
    get_finalization_history,
)

router = APIRouter()


# ── Request 스키마 ─────────────────────────────────────────────────────────────

class FinalizeRequest(BaseModel):
    corrected_value: float
    reason: str


class RevertRequest(BaseModel):
    reason: str


# ── STEP 5: 수치 보정 + 최종 확정 ────────────────────────────────────────────

@router.post("/{std_id}")
async def finalize(
    std_id: int,
    body: FinalizeRequest,
    current_user=Depends(get_current_user),
):
    """
    standardized_data 레코드를 최종 확정합니다.
    - 기존 value → original_value 백업
    - corrected_value 로 value 덮어쓰기
    - v_status → 5 (Verified)
    - 수치 변경 없이 상태만 확정하려면 현재 value를 corrected_value로 전달
    """
    try:
        result = finalize_usage_data(
            std_id=std_id,
            corrected_value=body.corrected_value,
            user_id=current_user.id,
            reason=body.reason,
        )
        if result["status"] in ("error", "rollback_failed"):
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 확정 취소 (원복) ──────────────────────────────────────────────────────────

@router.post("/{std_id}/revert")
async def revert(
    std_id: int,
    body: RevertRequest,
    current_user=Depends(get_current_user),
):
    """
    최종 확정(v_status=5)을 취소하고 original_value로 복원합니다.
    """
    try:
        result = revert_finalization(
            std_id=std_id,
            user_id=current_user.id,
            reason=body.reason,
        )
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 보정 이력 조회 ─────────────────────────────────────────────────────────────

@router.get("/{std_id}/history")
async def get_history(
    std_id: int,
    current_user=Depends(get_current_user),
):
    """
    특정 레코드의 보정 이력(FINALIZE/REVERT audit_trail)을 반환합니다.
    """
    try:
        result = get_finalization_history(std_id=std_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
