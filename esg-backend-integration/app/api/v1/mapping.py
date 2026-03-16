# app/api/v1/mapping.py
from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user
from app.services.mapping_service import MappingService

router = APIRouter()

@router.post("/run")
async def run_mapping(
    source_type: str = None,
    site_id: str = None,
    current_user=Depends(get_current_user),
):
    service = MappingService()
    return await service.run_mapping(
        source_type=source_type,
        site_id=site_id,
    )
