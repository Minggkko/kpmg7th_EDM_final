from fastapi import APIRouter, Depends
from app.schemas.issue import IssueCreate, IssueResponse
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.supabase_service import IssueService
from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("", response_model=PaginatedResponse[IssueResponse])
async def get_issues(_: dict = Depends(get_current_user)):
    service = IssueService()
    data = service.get_all()
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
