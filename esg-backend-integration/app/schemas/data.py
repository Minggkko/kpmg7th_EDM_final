from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DataBase(BaseModel):
    name: str                               # 예: 총 연료 소비 분류
    description: Optional[str] = None      # 그룹 설명 (선택)


class DataCreate(DataBase):
    indicator_id: int                       # 어떤 indicator에 속하는지


class DataResponse(DataBase):
    id: int
    indicator_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DataDetailResponse(DataResponse):
    """indicator 상세 조회 시 하위 data_points 포함"""
    data_points: list[dict] = []
