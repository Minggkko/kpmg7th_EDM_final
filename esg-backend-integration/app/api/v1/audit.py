# app/api/v1/audit.py
# EDM 파이프라인 공통 — 감사 추적(Audit Trail) 조회

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.dependencies import get_current_user
from app.services.outlier_pipeline.audit_trail import get_audit_history, get_audit_logs, get_action_summary

router = APIRouter()


# ── 전체 감사 로그 조회 ───────────────────────────────────────────────────────

@router.get("")
async def audit_logs(
    site_id: Optional[str] = Query(None, description="사업장 ID 필터"),
    action: Optional[str] = Query(None, description="액션 코드 (DETECT/VERIFY/FINALIZE 등)"),
    performed_by: Optional[str] = Query(None, description="수행자 ID 필터"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    limit: int = Query(100, description="최대 반환 건수"),
    current_user=Depends(get_current_user),
):
    """
    전체 감사 로그를 필터 조건에 맞춰 최신순으로 반환합니다.
    """
    try:
        result = get_audit_logs(
            site_id=site_id,
            action=action,
            performed_by=performed_by,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
        )
        return {"data": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 액션 유형별 집계 ── /summary는 /{std_id} 보다 반드시 앞에 위치해야 함 ────

@router.get("/summary")
async def action_summary(
    site_id: Optional[str] = Query(None, description="사업장 ID 필터"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    current_user=Depends(get_current_user),
):
    """
    액션 유형별 발생 건수를 집계합니다. (모니터링 차트용)
    예: [{"action": "DETECT", "action_label": "이상치 탐지", "count": 12}, ...]
    """
    try:
        result = get_action_summary(
            site_id=site_id,
            start_date=start_date,
            end_date=end_date,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 특정 레코드 변경 이력 ── 가변 경로이므로 고정 경로(/summary) 뒤에 위치 ──

@router.get("/{std_id}")
async def audit_history(
    std_id: int,
    current_user=Depends(get_current_user),
):
    """
    특정 standardized_data 레코드의 전체 변경 이력을 최신순으로 반환합니다.
    """
    try:
        result = get_audit_history(std_id=std_id)
        return {"data": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
