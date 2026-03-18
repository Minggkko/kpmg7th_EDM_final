from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPBearer
from app.schemas.issue import IssueCreate, IssueResponse
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.supabase_service import IssueService
from app.core.dependencies import get_current_user

security = HTTPBearer()

router = APIRouter()


@router.get("", response_model=PaginatedResponse[IssueResponse])
async def get_issues(
    years: list[int] | None = Query(
        None,
        description="이전 연도 필터 (복수 선택 가능). 예: ?years=2023&years=2024 → 2023 또는 2024에 채택된 이슈"
    ),
    search: str | None = Query(None, description="이슈명 키워드 검색"),
    _: dict = Depends(get_current_user),
):
    service = IssueService()
    data = service.get_all(years=years, search=search)
    return PaginatedResponse(data=data, total=len(data))


@router.get("/{issue_id}", response_model=APIResponse[IssueResponse])
async def get_issue(issue_id: int, _: dict = Depends(get_current_user)):
    service = IssueService()
    data = service.get_by_id(issue_id)
    return APIResponse(data=data)


@router.post("", response_model=APIResponse[IssueResponse])
async def create_issue(body: IssueCreate, _: dict = Depends(get_current_user)):
    service = IssueService()
    data = service.create(body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.patch("/{issue_id}", response_model=APIResponse[IssueResponse])
async def update_issue(issue_id: int, body: IssueCreate,
                       _: dict = Depends(get_current_user)):
    service = IssueService()
    data = service.update(issue_id, body.model_dump(exclude_none=True))
    return APIResponse(data=data)


@router.delete("/{issue_id}", response_model=APIResponse[None])
async def delete_issue(issue_id: int, _: dict = Depends(get_current_user)):
    service = IssueService()
    service.delete(issue_id)
    return APIResponse(data=None)
