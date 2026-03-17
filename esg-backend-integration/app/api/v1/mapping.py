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
