from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.schemas.data_point import DataPointResponse


# ── 요청 ──────────────────────────────────────

class MappingRequest(BaseModel):
    """자회사/EHS에서 올라온 데이터를 매핑 요청"""
    source_type: str                        # EHS / 자회사
    source_name: str                        # 시스템 또는 회사명
    extracted_values: dict                  # {"항목명": "값", ...}


class BulkMappingRequest(BaseModel):
    """여러 항목 한꺼번에 매핑 요청"""
    source_type: str
    source_name: str
    items: list[dict] = Field(..., min_length=1)


# ── 응답 ──────────────────────────────────────

class MappingResultItem(BaseModel):
    """단일 항목 매핑 결과"""
    input_key: str                          # 원본 항목명
    input_value: Optional[str] = None      # 원본 값
    matched_data_point: Optional[DataPointResponse] = None
    confidence_score: float = 0.0          # 0.0 ~ 1.0
    status: str = "pending"                # pending / matched / review / rejected
    reason: Optional[str] = None           # LLM 매핑 근거


class MappingResponse(BaseModel):
    """매핑 응답 전체"""
    upload_id: int                          # uploaded_data.id
    source_type: str
    source_name: str
    total: int
    matched: int
    review_required: int
    results: list[MappingResultItem]
    created_at: datetime


class MappingStatusUpdate(BaseModel):
    """사람이 매핑 결과 수동 확정/거절"""
    status: str                             # matched / rejected
    data_point_id: Optional[int] = None    # 수동으로 지정할 data_point
