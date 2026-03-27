# app/api/v1/data.py
from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer
from app.schemas.data import DataCreate, DataResponse, DataDetailResponse
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.supabase_service import DataService
from app.core.dependencies import get_current_user

security = HTTPBearer()
router = APIRouter()


@router.get("", response_model=PaginatedResponse[DataResponse])
async def get_data_list(
    indicator_id: int | None = Query(None, description="지표 ID로 필터링"),
    _: dict = Depends(get_current_user),
):
    """data 목록 조회 (선택적으로 indicator_id로 필터링)"""
    service = DataService()
    data = service.get_all(indicator_id=indicator_id)
    return PaginatedResponse(data=data, total=len(data))


@router.get("/{data_id}", response_model=APIResponse[DataDetailResponse])
async def get_data_detail(
    data_id: int,
    _: dict = Depends(get_current_user),
):
    """data 항목 + 하위 data_points 함께 반환"""
    service = DataService()
    data = service.get_with_data_points(data_id)
    return APIResponse(data=data)


@router.post("", response_model=APIResponse[DataResponse])
async def create_data(
    body: DataCreate,
    _: dict = Depends(get_current_user),
):
    service = DataService()
    data = service.create(body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.patch("/{data_id}", response_model=APIResponse[DataResponse])
async def update_data(
    data_id: int,
    body: DataCreate,
    _: dict = Depends(get_current_user),
):
    service = DataService()
    data = service.update(data_id, body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.delete("/{data_id}", response_model=APIResponse[None])
async def delete_data(
    data_id: int,
    _: dict = Depends(get_current_user),
):
    service = DataService()
    service.delete(data_id)
    return APIResponse(data=None)
