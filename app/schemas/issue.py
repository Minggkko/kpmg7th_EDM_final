from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class IssueBase(BaseModel):
    name: str
    description: Optional[str] = None
    esg_category_id: Optional[int] = None
    # 과거 연도에 채택된 이력 (integer[] in PostgreSQL)
    # 예: [2023, 2025] → 2023년, 2025년에 채택되었던 이슈
    previous_years: Optional[list[int]] = None


class IssueCreate(IssueBase):
    pass


class IssueResponse(IssueBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
