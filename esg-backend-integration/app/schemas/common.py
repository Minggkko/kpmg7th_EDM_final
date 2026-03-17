from pydantic import BaseModel
from typing import TypeVar, Generic, Optional

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """
    프론트와 합의한 공통 응답 포맷
    {
        "success": true,
        "data": { ... },
        "error": null
    }
    """
    success: bool = True
    data: Optional[T] = None
    error: Optional[str] = None


class PaginatedResponse(BaseModel, Generic[T]):
    """페이지네이션 응답"""
    success: bool = True
    data: list[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    error: Optional[str] = None
