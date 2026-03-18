# app/api/v1/mapping.py
from fastapi import APIRouter
from app.services.mapping_service import MappingService

router = APIRouter()

@router.post("/run")
async def run_mapping(
    source_type: str = None,
    source_name: str = None,
):
    service = MappingService()
    return await service.run_mapping(
        source_type=source_type,
        source_name=source_name,
    )

@router.get("/grouped")
async def get_grouped_standardized():
    """issues → indicators → data_group → data_points 계층 구조로 반환"""
    service = MappingService()
    return await service.get_grouped_standardized()
