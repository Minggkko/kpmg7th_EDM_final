# app/api/v1/dashboard.py
# EDM 파이프라인 — FE 대시보드용 통합 조회

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional

from app.core.dependencies import get_current_user
from app.services.outlier_pipeline.verification_dashboard import (
    get_verification_dashboard,
    get_status_summary,
    get_outlier_pending_list,
)

router = APIRouter()


# ── 메인 대시보드 조회 ────────────────────────────────────────────────────────

@router.get("")
async def dashboard(
    site_id: Optional[str] = Query(None, description="사업장 ID 필터"),
    start_date: Optional[str] = Query(None, description="시작일 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료일 (YYYY-MM-DD)"),
    v_status: Optional[int] = Query(1, description="v_status 필터 (None=전체)"),
    metric_name: Optional[str] = Query(None, description="지표명 필터"),
    limit: int = Query(200, description="최대 반환 건수"),
    current_user=Depends(get_current_user),
):
    """
    standardized_data 기준 검증 현황 통합 데이터를 반환합니다.
    - 이상치 정보, 증빙 검증 로그, OCR 증빙값, 생산량/원단위 포함
    - 기본값: v_status=1 (정상 데이터만)
    """
    try:
        result = get_verification_dashboard(
            site_id=site_id,
            start_date=start_date,
            end_date=end_date,
            v_status=v_status,
            metric_name=metric_name,
            limit=limit,
        )
        return {"data": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── v_status별 건수 집계 ──────────────────────────────────────────────────────

@router.get("/status-summary")
async def status_summary(
    site_id: Optional[str] = Query(None, description="사업장 ID 필터"),
    current_user=Depends(get_current_user),
):
    """
    v_status별 건수를 집계합니다. (모니터링 카드·차트용)
    예: {0: 10, 1: 45, 2: 3, 3: 1, 4: 0, 5: 20}
    """
    try:
        result = get_status_summary(site_id=site_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 소명 대기 이상치 목록 ─────────────────────────────────────────────────────

@router.get("/outlier-pending")
async def outlier_pending(
    site_id: Optional[str] = Query(None, description="사업장 ID 필터"),
    current_user=Depends(get_current_user),
):
    """
    소명 대기 중인 이상치(v_status=2) 목록을 반환합니다.
    """
    try:
        result = get_outlier_pending_list(site_id=site_id)
        return {"data": result, "total": len(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
