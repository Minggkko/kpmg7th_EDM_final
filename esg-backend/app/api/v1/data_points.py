from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer
from app.schemas.data_point import (
    DataPointCreate, DataPointResponse,
    SynonymCreate, SynonymResponse
)
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.supabase_service import DataPointService
from app.core.auth import get_current_user

security = HTTPBearer() 
router = APIRouter()


@router.get("", response_model=PaginatedResponse[DataPointResponse])
async def get_data_points(
    indicator_id: int | None = Query(None, description="지표 ID로 필터링"),
    search: str | None = Query(None, description="이름 키워드 검색"),
    _: dict = Depends(get_current_user)
):
    service = DataPointService()
    if search:
        data = service.search_by_name(search)
    else:
        data = service.get_all(indicator_id=indicator_id)
    return PaginatedResponse(data=data, total=len(data))


@router.get("/{dp_id}", response_model=APIResponse[dict])
async def get_data_point_detail(dp_id: int, _: dict = Depends(get_current_user)):
    """data_point + 유의어 목록 함께 반환"""
    service = DataPointService()
    data = service.get_with_synonyms(dp_id)
    return APIResponse(data=data)


@router.post("", response_model=APIResponse[DataPointResponse])
async def create_data_point(body: DataPointCreate,
                            _: dict = Depends(get_current_user)):
    service = DataPointService()
    data = service.create(body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.patch("/{dp_id}", response_model=APIResponse[DataPointResponse])
async def update_data_point(dp_id: int, body: DataPointCreate,
                            _: dict = Depends(get_current_user)):
    service = DataPointService()
    data = service.update(dp_id, body.model_dump(exclude_none=True))
    return APIResponse(data=data)


# ── 유의어 관리 ──────────────────────────────

@router.post("/{dp_id}/synonyms", response_model=APIResponse[SynonymResponse])
async def add_synonym(dp_id: int, body: SynonymCreate,
                      _: dict = Depends(get_current_user)):
    """유의어 추가"""
    service = DataPointService()
    data = service.add_synonym(dp_id, body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.delete("/{dp_id}/synonyms/{synonym_id}", response_model=APIResponse[None])
async def delete_synonym(dp_id: int, synonym_id: int,
                         _: dict = Depends(get_current_user)):
    """유의어 삭제"""
    service = DataPointService()
    service.delete_synonym(synonym_id)
    return APIResponse(data=None)
