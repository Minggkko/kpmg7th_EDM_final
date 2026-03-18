from fastapi import APIRouter, Depends, Query
from app.schemas.indicator import IndicatorCreate, IndicatorResponse
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.supabase_service import IndicatorService
from app.core.dependencies import get_current_user
from fastapi.security import HTTPBearer

security = HTTPBearer()  # ← 이 줄 추가
router = APIRouter()


@router.get("", response_model=PaginatedResponse[IndicatorResponse])
async def get_indicators(
    issue_id: int | None = Query(None, description="이슈 ID로 필터링"),
    _: dict = Depends(get_current_user)
):
    service = IndicatorService()
    data = service.get_all(issue_id=issue_id)
    return PaginatedResponse(data=data, total=len(data))


@router.get("/{indicator_id}", response_model=APIResponse[dict])
async def get_indicator_detail(
    indicator_id: int,
    _: dict = Depends(get_current_user)
):
    """indicator → data → data_points 계층 구조로 반환 (프론트 상세 페이지용)"""
    service = IndicatorService()
    data = service.get_with_data(indicator_id)
    return APIResponse(data=data)


@router.post("", response_model=APIResponse[IndicatorResponse])
async def create_indicator(body: IndicatorCreate,
                           _: dict = Depends(get_current_user)):
    service = IndicatorService()
    data = service.create(body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.patch("/{indicator_id}", response_model=APIResponse[IndicatorResponse])
async def update_indicator(indicator_id: int, body: IndicatorCreate,
                           _: dict = Depends(get_current_user)):
    service = IndicatorService()
    data = service.update(indicator_id, body.model_dump(exclude_none=True))
    return APIResponse(data=data)
