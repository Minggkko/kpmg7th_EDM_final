from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DataPointBase(BaseModel):
    name: str                               # 총_연료_소비량
    unit: Optional[str] = None             # GJ, MWh, tCO₂e, Text, Yes/No
    data_type: Optional[str] = None        # numeric / text
    definition: Optional[str] = None       # 공식 정의
    # data_group 컬럼은 data 테이블로 분리됨 (data_id FK 사용)


class DataPointCreate(DataPointBase):
    data_id: int                            # FK → data.id (구: indicator_id 직접 참조)


class DataPointResponse(DataPointBase):
    id: int
    data_id: int
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
