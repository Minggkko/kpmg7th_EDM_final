from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional


class IndicatorBase(BaseModel):
    name: str
    indicator_code: Optional[str] = None        # 103-1-a
    standard_version: Optional[str] = None      # GRI 103: Energy 2025
    effective_date: Optional[date] = None       # 2027-01-01
    disclosure_title: Optional[str] = None      # Disclosure 103-1 Energy...
    requirement_text: Optional[str] = None      # The organization shall: ...
    frameworks: Optional[list[str]] = None      # ["GRI 103: Energy 2025"]


class IndicatorCreate(IndicatorBase):
    issue_id: int


class IndicatorResponse(IndicatorBase):
    id: int
    issue_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class IndicatorDetailResponse(IndicatorResponse):
    data_points: list[dict] = []
    