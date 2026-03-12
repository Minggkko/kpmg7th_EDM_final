"""
evidence_extraction.py
----------------------
OCR 증빙 자료 추출 모듈.

6_standard_evidence_check.ipynb 의 앞단 로직을 프로덕션 모듈로 전환합니다.
raw_ocr_data(processing_status="Pending") 를 읽어 파싱한 뒤
evidence_usage 테이블에 적재하고, raw_ocr_data 를 "Extracted" 로 갱신합니다.

v_status 변경 없음 (DB vs OCR 비교는 evidence_verification.py 에서 수행)

처리 흐름
---------
raw_ocr_data (Pending)
    → raw_content 파싱 (customer_number, year, month, usage, unit)
    → site_metric_map 에서 site_id / metric_name 매핑
    → evidence_usage INSERT
    → raw_ocr_data.processing_status = "Extracted"
"""

import json
import logging

from .database_utils import get_supabase_client

logger = logging.getLogger(__name__)

# raw_content 에서 기대하는 필수 필드
_REQUIRED_FIELDS = {"customer_number", "year", "month", "usage"}


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _parse_raw_content(raw_content) -> dict | None:
    """
    raw_content 를 dict 로 변환하고 필수 필드를 검증합니다.

    Parameters
    ----------
    raw_content : dict | str
        Supabase JSONB 컬럼 값 (dict) 또는 JSON 문자열

    Returns
    -------
    dict | None
        파싱 성공 시 dict, 실패 시 None
    """
    if isinstance(raw_content, dict):
        parsed = raw_content
    else:
        try:
            parsed = json.loads(raw_content)
        except (json.JSONDecodeError, TypeError):
            return None

    missing = _REQUIRED_FIELDS - set(parsed.keys())
    if missing:
        logger.warning(f"[evidence_extraction] raw_content 필드 누락: {missing}")
        return None

    return parsed


def _build_reporting_date(year: str, month: str) -> str:
    """'YYYY'-'MM' → 'YYYY-MM-01' 형식으로 변환합니다."""
    return f"{year}-{int(month):02d}-01"


# ── 메인 함수 ─────────────────────────────────────────────────────────────────

def extract_pending_ocr_data(file_name: str = None) -> dict:
    """
    raw_ocr_data(Pending) 를 파싱하여 evidence_usage 에 적재합니다.

    Parameters
    ----------
    file_name : str, optional
        특정 파일만 처리. None 이면 Pending 전건 처리.

    Returns
    -------
    dict
        {
            "status"  : "success" | "error",
            "data"    : [적재된 evidence_usage 목록],
            "message" : str,
            "count"   : int
        }
    """
    try:
        client = get_supabase_client()

        # ── STEP 1: site_metric_map 캐시 로드 ─────────────────────────────
        map_rows = client.table("site_metric_map").select("*").execute().data
        # customer_number → {site_id, metric_name, unit} 으로 인덱싱
        metric_map: dict[str, dict] = {
            r["customer_number"]: r for r in map_rows
        }
        if not metric_map:
            return {
                "status" : "error",
                "data"   : [],
                "message": "site_metric_map 이 비어있습니다.",
                "count"  : 0,
            }

        # ── STEP 2: Pending OCR 데이터 조회 ───────────────────────────────
        query = (
            client.table("raw_ocr_data")
            .select("*")
            .eq("processing_status", "Pending")
        )
        if file_name:
            query = query.eq("file_name", file_name)

        pending_rows = query.execute().data

        if not pending_rows:
            return {
                "status" : "success",
                "data"   : [],
                "message": "처리할 Pending OCR 데이터가 없습니다.",
                "count"  : 0,
            }

        logger.info(f"[evidence_extraction] Pending 대상: {len(pending_rows)}건")

        # ── STEP 3: 건별 파싱 및 적재 ─────────────────────────────────────
        results       = []
        skipped_count = 0

        for row in pending_rows:
            r_id        = row["id"]
            f_name      = row["file_name"]
            raw_content = row["raw_content"]

            # raw_content 파싱
            parsed = _parse_raw_content(raw_content)
            if not parsed:
                logger.warning(
                    f"[evidence_extraction] raw_content 파싱 실패 id={r_id} file={f_name}"
                )
                skipped_count += 1
                continue

            customer_no      = str(parsed["customer_number"])
            reporting_date   = _build_reporting_date(
                str(parsed["year"]), str(parsed["month"])
            )
            ocr_val          = float(parsed["usage"])
            raw_unit         = parsed.get("unit", "")

            # site_metric_map 매핑
            mapping = metric_map.get(customer_no)
            if not mapping:
                logger.warning(
                    f"[evidence_extraction] customer_number '{customer_no}' 매핑 없음 "
                    f"id={r_id} file={f_name} → 스킵"
                )
                skipped_count += 1
                continue

            site_id     = mapping["site_id"]
            metric_name = mapping["metric_name"]
            # 단위: raw_content 의 unit 이 있으면 우선 사용, 없으면 map 의 unit
            unit = raw_unit if raw_unit else mapping["unit"]

            # evidence_usage INSERT
            evidence_record = {
                "site_id"       : site_id,
                "reporting_date": reporting_date,
                "metric_name"   : metric_name,
                "unit"          : unit,
                "ocr_value"     : float(ocr_val),
                "file_name"     : f_name,
            }
            try:
                ev_res     = client.table("evidence_usage").insert(evidence_record).execute()
                evidence_id = ev_res.data[0]["id"] if ev_res.data else None
            except Exception as e:
                logger.error(
                    f"[evidence_extraction] evidence_usage INSERT 실패 "
                    f"id={r_id} file={f_name}: {e}"
                )
                skipped_count += 1
                continue

            # raw_ocr_data 상태 → "Extracted"
            try:
                client.table("raw_ocr_data").update(
                    {"processing_status": "Extracted"}
                ).eq("id", r_id).execute()
            except Exception as e:
                logger.warning(
                    f"[evidence_extraction] raw_ocr_data 상태 갱신 실패 id={r_id}: {e}"
                )

            results.append({
                "raw_ocr_id"    : r_id,
                "evidence_id"   : evidence_id,
                "site_id"       : site_id,
                "metric_name"   : metric_name,
                "reporting_date": reporting_date,
                "ocr_value"     : float(ocr_val),
                "unit"          : unit,
                "file_name"     : f_name,
            })
            logger.info(
                f"[evidence_extraction] 적재 완료: {site_id}/{metric_name}/"
                f"{reporting_date} = {ocr_val} {unit} (file={f_name})"
            )

        count = len(results)
        logger.info(
            f"[evidence_extraction] 완료: {count}건 적재, {skipped_count}건 스킵"
        )

        return {
            "status" : "success",
            "data"   : results,
            "message": (
                f"{count}건 evidence_usage 적재 완료 (스킵: {skipped_count}건)"
            ),
            "count"  : count,
        }

    except Exception as e:
        logger.error(f"[evidence_extraction] 실행 오류: {e}")
        return {
            "status" : "error",
            "data"   : [],
            "message": str(e),
            "count"  : 0,
        }


if __name__ == "__main__":
    import json as _json

    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    result = extract_pending_ocr_data()
    print(_json.dumps(result, ensure_ascii=False, indent=2))
