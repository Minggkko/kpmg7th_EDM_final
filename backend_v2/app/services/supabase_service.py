from app.core.supabase import get_supabase_client
from fastapi import HTTPException


class IssueService:
    def __init__(self):
        self.db = get_supabase_client()
        self.table = "issues"

    def get_all(self, years: list[int] | None = None, search: str | None = None) -> list[dict]:
        """
        years: 복수 연도 필터 (OR 조건) — previous_years에 해당 연도를 하나라도 포함한 이슈
        search: 이슈명 키워드 검색
        """
        query = self.db.table(self.table).select("*").order("id")
        if search:
            query = query.ilike("name", f"%{search}%")
        if years:
            # PostgreSQL: previous_years && ARRAY[2023,2024] (overlap — 하나라도 포함)
            # supabase-py의 overlaps 연산자 사용
            query = query.overlaps("previous_years", years)
        return query.execute().data

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

    def get_with_data(self, indicator_id: int) -> dict:
        """indicator → data → data_points 계층 조회 (프론트 상세 페이지용)"""
        indicator = self.get_by_id(indicator_id)
        data_res = (
            self.db.table("data")
            .select("*")
            .eq("indicator_id", indicator_id)
            .order("id")
            .execute()
        )
        data_list = []
        for data_item in data_res.data:
            dp_res = (
                self.db.table("data_points")
                .select("*")
                .eq("data_id", data_item["id"])
                .order("id")
                .execute()
            )
            data_item["data_points"] = dp_res.data
            data_list.append(data_item)
        indicator["data"] = data_list
        return indicator

    def create(self, payload: dict) -> dict:
        res = self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    def update(self, indicator_id: int, payload: dict) -> dict:
        res = self.db.table(self.table).update(payload).eq("id", indicator_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Indicator {indicator_id} not found")
        return res.data[0]


class DataService:
    """data 테이블 CRUD (indicators ↔ data_points 중간 레이어)"""

    def __init__(self):
        self.db = get_supabase_client()
        self.table = "data"

    def get_all(self, indicator_id: int | None = None) -> list[dict]:
        query = self.db.table(self.table).select("*").order("id")
        if indicator_id:
            query = query.eq("indicator_id", indicator_id)
        return query.execute().data

    def get_by_id(self, data_id: int) -> dict:
        res = (
            self.db.table(self.table)
            .select("*")
            .eq("id", data_id)
            .single()
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Data {data_id} not found")
        return res.data

    def get_with_data_points(self, data_id: int) -> dict:
        """data 항목 + 하위 data_points 함께 조회"""
        item = self.get_by_id(data_id)
        dp_res = (
            self.db.table("data_points")
            .select("*")
            .eq("data_id", data_id)
            .order("id")
            .execute()
        )
        item["data_points"] = dp_res.data
        return item

    def create(self, payload: dict) -> dict:
        res = self.db.table(self.table).insert(payload).execute()
        return res.data[0]

    def update(self, data_id: int, payload: dict) -> dict:
        res = self.db.table(self.table).update(payload).eq("id", data_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Data {data_id} not found")
        return res.data[0]

    def delete(self, data_id: int) -> None:
        self.db.table(self.table).delete().eq("id", data_id).execute()


class DataPointService:
    def __init__(self):
        self.db = get_supabase_client()
        self.table = "data_points"

    def get_all(self, data_id: int | None = None) -> list[dict]:
        """data_id로 필터링 (data 테이블의 하위 data_points)"""
        query = self.db.table(self.table).select("*").order("id")
        if data_id:
            query = query.eq("data_id", data_id)
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
            .select("*, data(name, indicator_id, indicators(indicator_code, name))")
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
