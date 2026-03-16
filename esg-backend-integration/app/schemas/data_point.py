from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DataPointBase(BaseModel):
    name: str                               # 총_연료_소비량
    unit: Optional[str] = None             # GJ, MWh, tCO₂e, Text, Yes/No
    data_type: Optional[str] = None        # numeric / text
    data_group: Optional[str] = None       # 총 연료 소비 분류
    definition: Optional[str] = None       # 공식 정의


class DataPointCreate(DataPointBase):
    indicator_id: int


class DataPointResponse(DataPointBase):
    id: int
    indicator_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SynonymCreate(BaseModel):
    term: str
    lang: str = "ko"                       # ko / en
    source: Optional[str] = "internal"    # internal / GRI / ESRS / SASB


class SynonymResponse(SynonymCreate):
    id: int
    data_point_id: int
    created_at: datetime

    class Config:
        from_attributes = True
