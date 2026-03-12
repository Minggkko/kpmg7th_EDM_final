from app.core.supabase import get_supabase_client
from fastapi import HTTPException


class IssueService:
    def __init__(self):
        self.db = get_supabase_client()
        self.table = "issues"

    def get_all(self) -> list[dict]:
        res = self.db.table(self.table).select("*").order("id").execute()
        return res.data

    def get_by_id(self, issue_id: int) -> dict:
        res = self.db.table(self.table).select("*").eq("id", issue_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
        return res.data

    def create(self, payload: dict) -> dict:
        res = self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    def update(self, issue_id: int, payload: dict) -> dict:
        res = self.db.table(self.table).update(payload).eq("id", issue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Issue {issue_id} not found")
        return res.data[0]

    def delete(self, issue_id: int) -> None:
        self.db.table(self.table).delete().eq("id", issue_id).execute()


class IndicatorService:
    def __init__(self):
        self.db = get_supabase_client()
        self.table = "indicators"

    def get_all(self, issue_id: int | None = None) -> list[dict]:
        query = self.db.table(self.table).select("*").order("id")
        if issue_id:
            query = query.eq("issue_id", issue_id)
        return query.execute().data

    def get_by_id(self, indicator_id: int) -> dict:
        res = (
            self.db.table(self.table)
            .select("*")
            .eq("id", indicator_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Indicator {indicator_id} not found")
        return res.data

    def get_with_data_points(self, indicator_id: int) -> dict:
        """indicator + data_points 함께 조회 (프론트 상세 페이지용)"""
        indicator = self.get_by_id(indicator_id)
        dp_res = (
            self.db.table("data_points")
            .select("*")
            .eq("indicator_id", indicator_id)
            .order("id")
            .execute()
        )
        indicator["data_points"] = dp_res.data
        return indicator

    def create(self, payload: dict) -> dict:
        res = self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    def update(self, indicator_id: int, payload: dict) -> dict:
        res = self.db.table(self.table).update(payload).eq("id", indicator_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Indicator {indicator_id} not found")
        return res.data[0]


class DataPointService:
    def __init__(self):
        self.db = get_supabase_client()
        self.table = "data_points"

    def get_all(self, indicator_id: int | None = None) -> list[dict]:
        query = self.db.table(self.table).select("*").order("id")
        if indicator_id:
            query = query.eq("indicator_id", indicator_id)
        return query.execute().data

    def get_by_id(self, dp_id: int) -> dict:
        res = (
            self.db.table(self.table)
            .select("*")
            .eq("id", dp_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"DataPoint {dp_id} not found")
        return res.data

    def get_with_synonyms(self, dp_id: int) -> dict:
        """data_point + 유의어 함께 조회"""
        dp = self.get_by_id(dp_id)
        syn_res = (
            self.db.table("data_point_synonyms")
            .select("*")
            .eq("data_point_id", dp_id)
            .execute()
        )
        dp["synonyms"] = syn_res.data
        return dp

    def create(self, payload: dict) -> dict:
        res = self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    def update(self, dp_id: int, payload: dict) -> dict:
        res = self.db.table(self.table).update(payload).eq("id", dp_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"DataPoint {dp_id} not found")
        return res.data[0]

    def add_synonym(self, dp_id: int, payload: dict) -> dict:
        payload["data_point_id"] = dp_id
        res = self.db.table("data_point_synonyms").insert(payload).execute()
        return res.data[0]

    def delete_synonym(self, synonym_id: int) -> None:
        self.db.table("data_point_synonyms").delete().eq("id", synonym_id).execute()

    def search_by_name(self, keyword: str) -> list[dict]:
        """data_point 이름으로 검색 (매핑 fallback용)"""
        res = (
            self.db.table(self.table)
            .select("*, indicators(indicator_code, name, disclosure_title)")
            .ilike("name", f"%{keyword}%")
            .limit(10)
            .execute()
        )
        return res.data


class UploadedDataService:
    def __init__(self):
        self.db = get_supabase_client()
        self.table = "uploaded_data"

    def create(self, payload: dict) -> dict:
        res = self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    def get_by_id(self, upload_id: int) -> dict:
        res = (
            self.db.table(self.table)
            .select("*, data_points(name, unit, indicator_id)")
            .eq("id", upload_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Upload {upload_id} not found")
        return res.data

    def update_status(self, upload_id: int, status: str,
                      data_point_id: int | None = None,
                      confidence_score: float | None = None) -> dict:
        payload = {"status": status}
        if data_point_id:
            payload["mapped_data_point_id"] = data_point_id
        if confidence_score is not None:
            payload["confidence_score"] = confidence_score
        res = self.db.table(self.table).update(payload).eq("id", upload_id).execute()
        return res.data[0]

    def get_pending(self) -> list[dict]:
        """매핑 대기 중인 항목 전체 조회"""
        res = (
            self.db.table(self.table)
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .execute()
        )
        return res.data
