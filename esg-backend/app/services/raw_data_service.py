# app/services/raw_data_service.py

import re
import pandas as pd
from supabase import acreate_client
from typing import Optional
from app.core.config import get_settings

from supabase.client import AsyncClient  # ← 여기서 import

settings = get_settings()


def parse_metric_col(col: str) -> tuple[str, Optional[str]]:
    match = re.match(r"^(.+?)\s*\((.+?)\)$", col.strip())
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return col.strip(), None


def parse_file_name(file_name: str) -> tuple[str, str]:
    stem = file_name.replace(".csv", "").replace(".xlsx", "").replace(".xls", "")
    parts = stem.split("_")
    if len(parts) >= 2:
        return parts[0], parts[1]
    raise ValueError(f"파일명 형식 오류: {file_name} (형식: source_type_site_id_raw.csv)")


class RawDataService:
    def __init__(self):
        self._supabase_url = settings.supabase_url
        self._supabase_key = settings.supabase_service_key
        self._supabase: AsyncClient | None = None

    async def _get_supabase(self) -> AsyncClient:
        if self._supabase is None:
            self._supabase = await acreate_client(self._supabase_url, self._supabase_key)
        return self._supabase

    async def process_upload(
        self,
        file_bytes: bytes,
        file_name: str,
        uploaded_by: str,
    ) -> dict:
        # 1. 파일명 파싱
        source_type, site_id = parse_file_name(file_name)

        # 2. 파일 읽기
        ext = file_name.rsplit(".", 1)[-1].lower()
        import io
        if ext == "csv":
            df = pd.read_csv(io.BytesIO(file_bytes))
        elif ext in ("xlsx", "xls"):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            raise ValueError(f"지원하지 않는 파일 형식: {ext}")

        if "date" not in df.columns:
            raise ValueError("파일에 'date' 컬럼이 없습니다.")

        # 3. wide → long melt
        df_long = df.melt(id_vars=["date"], var_name="metric_raw", value_name="raw_value")

        # 4. metric_col / unit 분리
        df_long[["metric_col", "unit"]] = df_long["metric_raw"].apply(
            lambda x: pd.Series(parse_metric_col(x))
        )

        # 5. NaN 제거 + TEXT 변환
        df_long = df_long.dropna(subset=["raw_value"])
        df_long["raw_value"] = df_long["raw_value"].astype(str)
        df_long["reporting_date"] = pd.to_datetime(df_long["date"]).dt.strftime("%Y-%m-%d")

        # 6. raw_data INSERT
        sb = await self._get_supabase()
        rows = []
        for _, row in df_long.iterrows():
            rows.append({
                "source_type":    source_type,
                "site_id":    site_id,
                "reporting_date": row["reporting_date"],
                "metric_col":     row["metric_col"],
                "raw_value":      row["raw_value"],
                "unit":           row["unit"],
                "source_file":    file_name,
                "uploaded_by":    uploaded_by,
            })

        BATCH = 100
        inserted = 0
        for i in range(0, len(rows), BATCH):
            res = await sb.table("raw_data").insert(rows[i:i + BATCH]).execute()
            inserted += len(res.data)

        # 7. 표준화 자동 실행
        from app.services.mapping_service import MappingService
        mapping_service = MappingService()
        mapping_result = await mapping_service.run_mapping(
            source_type=source_type,
            site_id=site_id,
        )

        return {
            "message":        "업로드 및 표준화 완료",
            "source_type":    source_type,
            "site_id":    site_id,
            "source_file":    file_name,
            "row_count":      inserted,
            "mapping_result": mapping_result,
        }
