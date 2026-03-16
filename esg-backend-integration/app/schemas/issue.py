from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class IssueBase(BaseModel):
    name: str
    description: Optional[str] = None


class IssueCreate(IssueBase):
    pass


class IssueResponse(IssueBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
