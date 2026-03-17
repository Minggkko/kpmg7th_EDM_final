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

    async def _vector_match(self, metric_col: str) -> dict | None:
        sb = await self._get_supabase()
        embedding = (await self.openai.embeddings.create(
            input=metric_col,
            model="text-embedding-3-small"
        )).data[0].embedding

        res = await sb.rpc("match_data_points", {
            "query_embedding": embedding,
            "match_count": 1
        }).execute()
        results = res.data

        if not results:
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
                        results = [dp_res.data]
            except Exception:
                pass

        return results[0] if results else None

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
            "site_id":                    row["site_id"],
            "reporting_date":             row["reporting_date"],
            "metric_name":                matched["name"],
            "data_point_id":              matched["id"],
            "value":                      converted_value,
            "unit":                       matched["unit"] if unit_ok else row.get("unit"),
            "raw_value_text":             row["raw_value"],
            "original_value":             None,
            "v_status":                   0 if unit_ok else 99,
            "standardization_confidence": confidence,
            "updated_by":                 "system:standardization",
            "raw_data_id":                row.get("id"),
        }

    async def run_mapping(self, source_type=None, site_id=None):
        sb = await self._get_supabase()
        query = sb.table("raw_data").select("*")
        if source_type:
            query = query.eq("source_type", source_type)
        if site_id:
            query = query.eq("site_id", site_id)
        raw_rows = (await query.execute()).data

        success, skipped_parse, skipped_match, unit_error = 0, 0, 0, 0
        seen = set()
        batch = []
        match_cache: dict[str, dict | None] = {}  # ← 캐시 추가

        for row in raw_rows:
            metric_col = row["metric_col"]

            # 캐시에 없을 때만 매칭 수행
            if metric_col not in match_cache:
                matched = await self._exact_match(metric_col)
                if not matched:
                    matched = await self._vector_match(metric_col)
                match_cache[metric_col] = matched  # 결과 저장

            matched = match_cache[metric_col]

            numeric_value = self._parse_value(row["raw_value"])
            if numeric_value is None:
                skipped_parse += 1
                continue

            if not matched:
                skipped_match += 1
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
                "v_status":                   0 if unit_ok else 99,
                "standardization_confidence": confidence,
                "updated_by":                 "system:standardization",
                "raw_data_id":                row.get("id"),
            }

            key = (result["source_type"], result["site_id"], result["reporting_date"], result["metric_name"])
            if key in seen:
                continue
            seen.add(key)

            if result["v_status"] == 99:
                unit_error += 1

            batch.append(result)

            if len(batch) >= 100:
                await sb.table("standardized_data") \
                    .upsert(batch, on_conflict="source_type,site_id,reporting_date,metric_name") \
                    .execute()
                success += len(batch)
                batch = []

        if batch:
            await sb.table("standardized_data") \
                .upsert(batch, on_conflict="source_type,site_id,reporting_date,metric_name") \
                .execute()
            success += len(batch)

        return {
            "message":       "표준화 완료",
            "total":         len(raw_rows),
            "success":       success,
            "skipped_parse": skipped_parse,
            "skipped_match": skipped_match,
            "unit_error":    unit_error,
        }