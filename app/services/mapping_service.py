# app/services/mapping_service.py

from openai import AsyncOpenAI
from supabase import acreate_client
from app.core.config import get_settings
from typing import Any
# mapping_service.py, raw_data_service.py 상단 수정

from supabase.client import AsyncClient  # ← 여기서 import

settings = get_settings()

UNIT_CONVERSION: dict[tuple[str, str], float] = {
    ("kwh",    "mwh"):    1 / 1000,
    ("mwh",    "kwh"):    1000,
    ("gj",     "mwh"):    1 / 3.6,
    ("mwh",    "gj"):     3.6,
    ("gj",     "kwh"):    1000 / 3.6,
    ("kwh",    "gj"):     3.6 / 1000,
    ("tj",     "gj"):     1000,
    ("gj",     "tj"):     1 / 1000,
    ("nm3",    "m3"):     1.0,
    ("m3",     "nm3"):    1.0,
    ("l",      "kl"):     1 / 1000,
    ("kl",     "l"):      1000,
    ("m3",     "kl"):     1.0,
    ("kl",     "m3"):     1.0,
    ("kg",     "ton"):    1 / 1000,
    ("ton",    "kg"):     1000,
    ("tco2e",  "tco2e"):  1.0,
    ("tco2",   "tco2e"):  1.0,
    ("ktco2e", "tco2e"):  1000,
    ("tco2e",  "ktco2e"): 1 / 1000,
}

def convert_unit(value: float, from_unit: str, to_unit: str) -> tuple[float, bool]:
    fu = from_unit.lower().replace(" ", "").replace("₂", "2")
    tu = to_unit.lower().replace(" ", "").replace("₂", "2")
    if fu == tu:
        return value, True
    factor = UNIT_CONVERSION.get((fu, tu))
    if factor is not None:
        return round(value * factor, 6), True
    return value, False


class MappingService:
    def __init__(self):
        self.openai = AsyncOpenAI(api_key=settings.openai_api_key)
        self._supabase_url = settings.supabase_url
        self._supabase_key = settings.supabase_service_key
        self._supabase: AsyncClient | None = None

    async def _get_supabase(self) -> AsyncClient:
        if self._supabase is None:
            self._supabase = await acreate_client(self._supabase_url, self._supabase_key)
        return self._supabase

    def _parse_value(self, raw_value: str) -> float | None:
        try:
            return float(raw_value.replace(",", "").replace(" ", ""))
        except (ValueError, AttributeError):
            return None

    async def _exact_match(self, metric_col: str) -> dict | None:
        sb = await self._get_supabase()
        res = await sb.table("data_points") \
            .select("id, name, unit") \
            .eq("name", metric_col) \
            .limit(1).execute()
        return res.data[0] if res.data else None

    # data_points embedding 캐시 (프로세스 재시작 전까지 유지)
    _dp_cache: list[dict] | None = None

    @staticmethod
    def _parse_embedding(emb) -> list[float] | None:
        """Supabase vector 컬럼은 문자열 '[0.1,0.2,...]'로 반환될 수 있음 → float list로 변환"""
        if emb is None:
            return None
        if isinstance(emb, str):
            import json
            try:
                emb = json.loads(emb)
            except Exception:
                return None
        if isinstance(emb, list) and len(emb) > 0:
            return [float(v) for v in emb]
        return None

    async def _load_dp_cache(self) -> list[dict]:
        """data_points (id, name, unit, embedding) 한 번만 로드"""
        if MappingService._dp_cache is not None:
            return MappingService._dp_cache
        sb = await self._get_supabase()
        res = await sb.table("data_points").select("id, name, unit, embedding").execute()
        parsed = []
        for r in (res.data or []):
            emb = self._parse_embedding(r.get("embedding"))
            if emb:
                r["embedding"] = emb
                parsed.append(r)
        MappingService._dp_cache = parsed
        print(f"[INFO] data_points 캐시 로드: {len(parsed)}건")
        return MappingService._dp_cache

    @staticmethod
    def _cosine_sim(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        na  = sum(x * x for x in a) ** 0.5
        nb  = sum(x * x for x in b) ** 0.5
        return dot / (na * nb) if na and nb else 0.0

    async def _synonym_exact_match(self, metric_col: str) -> dict | None:
        """data_point_synonyms.term 완전일치 → data_points 반환"""
        sb = await self._get_supabase()
        res = await sb.table("data_point_synonyms") \
            .select("data_point_id") \
            .eq("term", metric_col) \
            .limit(1).execute()
        if not res.data:
            return None
        dp_id = res.data[0]["data_point_id"]
        dp_res = await sb.table("data_points") \
            .select("id, name, unit") \
            .eq("id", dp_id).single().execute()
        return dp_res.data if dp_res.data else None

    async def _vector_match(self, metric_col: str) -> dict | None:
        """
        match_data_points RPC가 data_group 컬럼 버그로 동작 불가 → Python 코사인 계산으로 대체
        match_data_point_synonyms RPC는 정상 → 그대로 유지
        """
        sb = await self._get_supabase()

        # 1. OpenAI 임베딩 생성
        embedding = (await self.openai.embeddings.create(
            input=metric_col,
            model="text-embedding-3-small"
        )).data[0].embedding

        # 2. data_points embedding 유사도 (match_data_points RPC 대체 - Python 계산)
        try:
            dp_candidates = await self._load_dp_cache()
            best_dp, best_dp_sim = None, -1.0
            for dp in dp_candidates:
                sim = self._cosine_sim(embedding, dp["embedding"])
                if sim > best_dp_sim:
                    best_dp_sim = sim
                    best_dp = dp
            if best_dp and best_dp_sim >= settings.confidence_threshold:
                return {"id": best_dp["id"], "name": best_dp["name"], "unit": best_dp["unit"], "similarity": best_dp_sim}
        except Exception as e:
            print(f"[WARNING] data_points 유사도 계산 실패: {e}")

        # 3. match_data_point_synonyms RPC (정상 동작 확인됨)
        try:
            syn_res = await sb.rpc("match_data_point_synonyms", {
                "query_embedding": embedding,
                "match_count": 1
            }).execute()
            if syn_res.data:
                dp_res = await sb.table("data_points") \
                    .select("id, name, unit") \
                    .eq("id", syn_res.data[0]["data_point_id"]) \
                    .single().execute()
                if dp_res.data:
                    dp_res.data["similarity"] = syn_res.data[0].get("similarity", 0.0)
                    return dp_res.data
        except Exception as e:
            print(f"[WARNING] match_data_point_synonyms 실패: {e}")

        return None

    async def _standardize_row(self, row: dict) -> dict | None:
        numeric_value = self._parse_value(row["raw_value"])
        if numeric_value is None:
            return None

        matched = await self._exact_match(row["metric_col"])
        confidence = 1.0

        if not matched:
            matched = await self._vector_match(row["metric_col"])
            confidence = matched.get("similarity", 0.0) if matched else 0.0

        if not matched:
            return None

        converted_value, unit_ok = convert_unit(
            numeric_value,
            row.get("unit") or "",
            matched["unit"]
        )

        return {
            "source_type":                row["source_type"],
            "site_id":                    row["site_id"],   # DB 컬럼명 site_id
            "reporting_date":             row["reporting_date"],
            "metric_name":                matched["name"],
            "data_point_id":              matched["id"],
            "value":                      converted_value,
            "unit":                       matched["unit"] if unit_ok else row.get("unit"),
            "raw_value_text":             row["raw_value"],
            "original_value":             None,
            "v_status":                   1 if unit_ok else 99,
            "standardization_confidence": confidence,
            "updated_by":                 "system:standardization",
        }

    async def run_mapping(self, source_type=None, source_name=None):
        sb = await self._get_supabase()
        # standardized_status=0 인 미처리 레코드만 대상
        query = sb.table("raw_data").select("*").eq("standardized_status", 0)
        if source_type:
            query = query.eq("source_type", source_type)
        if source_name:
            query = query.eq("site_id", source_name)
        raw_rows = (await query.execute()).data

        # ── 기존 standardized_data에서 v_status > 1 인 레코드 보호 목록 구성 ──────
        # upsert 시 이미 검증/확정된 레코드의 v_status가 1로 초기화되는 것을 방지
        protected_query = sb.table("standardized_data") \
            .select("source_type,site_id,reporting_date,metric_name,v_status") \
            .gt("v_status", 1)
        if source_type:
            protected_query = protected_query.eq("source_type", source_type)
        if source_name:
            protected_query = protected_query.eq("site_id", source_name)
        protected_rows = (await protected_query.execute()).data
        protected_v_status: dict[tuple, int] = {
            (r["source_type"], r["site_id"], r["reporting_date"], r["metric_name"]): r["v_status"]
            for r in protected_rows
        }

        success, skipped_parse, skipped_match, unit_error = 0, 0, 0, 0
        seen = set()
        batch = []
        batch_raw_ids = []          # 배치에 담긴 raw_data id 목록
        failed_ids: list[int] = []  # parse/match 실패한 raw_data id 목록
        match_cache: dict[str, dict | None] = {}

        for row in raw_rows:
            metric_col = row["metric_col"]
            raw_id     = row["id"]

            # 캐시에 없을 때만 매칭 수행
            if metric_col not in match_cache:
                matched = await self._exact_match(metric_col)          # ① data_points 완전일치
                if not matched:
                    matched = await self._synonym_exact_match(metric_col)  # ② synonym 완전일치
                if not matched:
                    matched = await self._vector_match(metric_col)     # ③ embedding 유사도
                match_cache[metric_col] = matched

            matched = match_cache[metric_col]

            numeric_value = self._parse_value(row["raw_value"])
            if numeric_value is None:
                skipped_parse += 1
                failed_ids.append(raw_id)
                continue

            if not matched:
                skipped_match += 1
                failed_ids.append(raw_id)
                continue

            confidence = 1.0 if matched.get("similarity") is None else matched.get("similarity", 0.0)
            converted_value, unit_ok = convert_unit(
                numeric_value,
                row.get("unit") or "",
                matched["unit"]
            )

            result = {
                "source_type":                row["source_type"],
                "site_id":                    row["site_id"],
                "reporting_date":             row["reporting_date"],
                "metric_name":                matched["name"],
                "data_point_id":              matched["id"],
                "value":                      converted_value,
                "unit":                       matched["unit"] if unit_ok else row.get("unit"),
                "raw_value_text":             row["raw_value"],
                "original_value":             None,
                "v_status":                   1 if unit_ok else 99,
                "standardization_confidence": confidence,
                "updated_by":                 "system:standardization",
            }

            key = (result["source_type"], result["site_id"], result["reporting_date"], result["metric_name"])
            if key in seen:
                # 중복 키 → 이 raw_data는 성공으로 처리
                batch_raw_ids.append(raw_id)
                continue
            seen.add(key)

            # 이미 검증/확정된 레코드는 v_status 보존
            if key in protected_v_status:
                result["v_status"] = protected_v_status[key]

            if result["v_status"] == 99:
                unit_error += 1

            batch.append(result)
            batch_raw_ids.append(raw_id)

            if len(batch) >= 100:
                await sb.table("standardized_data") \
                    .upsert(batch, on_conflict="source_type,site_id,reporting_date,metric_name") \
                    .execute()
                success += len(batch)
                # 성공한 raw_data → standardized_status=1
                await sb.table("raw_data") \
                    .update({"standardized_status": 1}) \
                    .in_("id", batch_raw_ids) \
                    .execute()
                batch = []
                batch_raw_ids = []

        if batch:
            await sb.table("standardized_data") \
                .upsert(batch, on_conflict="source_type,site_id,reporting_date,metric_name") \
                .execute()
            success += len(batch)
            await sb.table("raw_data") \
                .update({"standardized_status": 1}) \
                .in_("id", batch_raw_ids) \
                .execute()

        # 실패한 raw_data → standardized_status=2
        if failed_ids:
            await sb.table("raw_data") \
                .update({"standardized_status": 2}) \
                .in_("id", failed_ids) \
                .execute()

        return {
            "message":       "표준화 완료",
            "total":         len(raw_rows),
            "success":       success,
            "skipped_parse": skipped_parse,
            "skipped_match": skipped_match,
            "unit_error":    unit_error,
        }

    async def get_grouped_standardized(self) -> list[dict]:
        """issues → indicators → data → data_points + 최신 standardized 값을 계층 구조로 반환"""
        sb = await self._get_supabase()

        issues_res = await sb.table("issues").select("id, name").order("id").execute()
        indicators_res = await sb.table("indicators").select("id, issue_id, name").order("id").execute()
        data_res = await sb.table("data").select("id, indicator_id, name").order("id").execute()
        dp_res = await sb.table("data_points").select("id, data_id, name, unit").order("id").execute()
        std_res = await sb.table("standardized_data") \
            .select("data_point_id, value, unit, reporting_date, site_id") \
            .order("reporting_date", desc=True) \
            .execute()

        # 최신 standardized 값 index (data_point_id → first seen = latest)
        std_by_dp: dict[int, dict] = {}
        for row in std_res.data:
            dp_id = row["data_point_id"]
            if dp_id not in std_by_dp:
                std_by_dp[dp_id] = row

        result = []
        for issue in issues_res.data:
            indicators_for_issue = [i for i in indicators_res.data if i["issue_id"] == issue["id"]]
            indicator_list = []
            for indicator in indicators_for_issue:
                # indicator에 속한 data 항목들 (data_group 역할)
                data_for_indicator = [d for d in data_res.data if d["indicator_id"] == indicator["id"]]
                data_list = []
                for data_item in data_for_indicator:
                    # data 항목에 속한 data_points
                    dps = [d for d in dp_res.data if d.get("data_id") == data_item["id"]]
                    dp_list = []
                    for dp in dps:
                        std = std_by_dp.get(dp["id"])
                        dp_list.append({
                            "id":             dp["id"],
                            "name":           dp["name"],
                            "unit":           dp["unit"],
                            "value":          str(std["value"]) if std and std.get("value") is not None else None,
                            "reporting_date": std["reporting_date"] if std else None,
                            "source_name":    std["site_id"] if std else None,
                        })
                    data_list.append({
                        "id":          data_item["id"],
                        "name":        data_item["name"],
                        "data_points": dp_list,
                    })
                indicator_list.append({
                    "id":   indicator["id"],
                    "name": indicator["name"],
                    "data": data_list,
                })
            result.append({
                "id":         issue["id"],
                "name":       issue["name"],
                "indicators": indicator_list,
            })
        return result