from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.core.supabase import get_supabase_client

router = APIRouter()


@router.get("")
async def get_sites(_: dict = Depends(get_current_user)):
    """master_sites 테이블에서 전체 사업장 목록 반환"""
    try:
        client = get_supabase_client()
        res = client.table("master_sites").select("site_id").order("site_id").execute()
        sites = [r["site_id"] for r in (res.data or []) if r.get("site_id")]
        return {"data": sites, "total": len(sites)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
