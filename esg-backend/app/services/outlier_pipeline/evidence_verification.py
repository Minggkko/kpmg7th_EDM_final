"""
evidence_verification.py
------------------------
OCR 증빙 자료 정합성 검증 모듈.

6_standard_evidence_check.ipynb 의 뒷단 로직을 프로덕션 모듈로 전환합니다.
evidence_usage 와 standardized_data 를 비교하여 gap_percent 를 계산하고
자동 verification_logs 에 기록하며 v_status 를 자동 전이시킵니다.

v_status 전이 규칙 (Rule 3)
----------------------------
unit_mismatch (1000배 오차)  → 4 (Unit Error)
gap_percent >= 1%             → 3 (Mismatch)
gap_percent  < 1%             → 5 (Verified)

처리 흐름
---------
evidence_usage (미검증)
    ↔ standardized_data (site_id + metric_name + reporting_date)
    → gap_value / gap_percent 계산
    → result_code / unit_mismatch 판정
    → verification_logs INSERT
    → standardized_data.v_status UPDATE (1 → 3 / 4 / 5)
    → raw_ocr_data.processing_status = "Success"
    → audit_trail 기록
"""

import logging

from .audit_trail import AuditAction, log_action
from .database_utils import get_supabase_client

logger = logging.getLogger(__name__)


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _calc_gap(db_val: float, ocr_val: float) -> tuple[float, float]:
    """gap_value / gap_percent 를 계산합니다."""
    gap_value   = float(db_val - ocr_val)
    gap_percent = float(abs(gap_value) / db_val * 100) if db_val != 0 else 0.0
    return gap_value, gap_percent


def _is_unit_mismatch(db_val: float, ocr_val: float) -> bool:
    """1000배 단위 오기입(kWh ↔ MWh, Nm3 ↔ kNm3 등) 여부를 판정합니다."""
    return (
        abs(db_val * 1000 - ocr_val) < 1.0
        or abs(db_val / 1000 - ocr_val) < 1.0
    )


def _determine_v_status(gap_percent: float, unit_mismatch: bool) -> tuple[int, str]:
    """
    v_status 와 diagnosis 문자열을 반환합니다 (Rule 3).

    Returns
    -------
    (new_v_status, diagnosis)
    """
    if unit_mismatch:
        return 4, "단위 기입 오류 (1000배 오차 감지)"
    if gap_percent >= 1.0:
        return 3, f"수치 불일치 (오차: {gap_percent:.2f}%)"
    return 5, "정합성 확인 완료"


# ── 메인 함수 ─────────────────────────────────────────────────────────────────

def verify_evidence_data(
    site_id: str = None,
    metric_name: str = None,
    gap_percent_threshold: float = 1.0,
) -> dict:
    """
    evidence_usage 와 standardized_data 를 비교하여 정합성을 검증합니다.

    아직 verification_logs 에 없는 evidence_usage 레코드를 대상으로
    - verification_logs INSERT
    - standardized_data.v_status UPDATE (v_status=1 인 경우만)
    - raw_ocr_data.processing_status = "Success"
    - audit_trail 기록
    을 수행합니다.

    Parameters
    ----------
    site_id : str, optional
        특정 사업장만 처리. None 이면 전체.
    metric_name : str, optional
        특정 지표만 처리. None 이면 전체.
    gap_percent_threshold : float
        불일치 판정 기준(%). 기본 1.0%.

    Returns
    -------
    dict
        {
            "status"  : "success" | "error",
            "data"    : [검증 결과 목록],
            "message" : str,
            "count"   : int
        }
    """
    try:
        client = get_supabase_client()

        # ── STEP 1: evidence_usage 전체 로드 ──────────────────────────────
        ev_query = client.table("evidence_usage").select("*")
        if site_id:
            ev_query = ev_query.eq("site_id", site_id)
        if metric_name:
            ev_query = ev_query.eq("metric_name", metric_name)
        all_evidence = ev_query.execute().data

        if not all_evidence:
            return {
                "status" : "success",
                "data"   : [],
                "message": "evidence_usage 데이터가 없습니다.",
                "count"  : 0,
            }

        # ── STEP 2: result_code=5(최종 확인)인 evidence_id만 스킵 (3/4는 재검증 허용) ──
        verified_ids_rows = (
            client.table("verification_logs")
            .select("evidence_id, result_code")
            .execute()
            .data
        )
        already_final: set[int] = {
            r["evidence_id"] for r in verified_ids_rows
            if r.get("evidence_id") and r.get("result_code") == 5
        }

        # result_code=5가 아닌 evidence_id는 재검증 허용 (3→5, 4→5 경로)
        pending_evidence = [
            r for r in all_evidence if r["id"] not in already_final
        ]

        if not pending_evidence:
            return {
                "status" : "success",
                "data"   : [],
                "message": "검증할 새로운 evidence_usage 데이터가 없습니다.",
                "count"  : 0,
            }

        logger.info(f"[evidence_verification] 검증 대상: {len(pending_evidence)}건")

        # ── STEP 3: standardized_data 전체 캐시 (Python-side 매칭용, v_status=1/3/4 대상) ──
        std_rows = (
            client.table("standardized_data")
            .select("*")
            .in_("v_status", [1, 3, 4])
            .execute()
            .data
        )
        # (site_id, metric_name, reporting_date) → record 인덱싱
        std_index: dict[tuple, dict] = {
            (r["site_id"], r["metric_name"], r["reporting_date"]): r
            for r in std_rows
        }

        # ── STEP 4: raw_ocr_data file_name → id 인덱스 (Extracted 상태용) ─
        ocr_rows    = client.table("raw_ocr_data").select("id, file_name, processing_status").execute().data
        ocr_by_file: dict[str, dict] = {r["file_name"]: r for r in ocr_rows}

        # ── STEP 5: 건별 검증 루프 ────────────────────────────────────────
        results      = []
        skip_count   = 0

        for ev in pending_evidence:
            ev_id          = ev["id"]
            ev_site        = ev["site_id"]
            ev_metric      = ev["metric_name"]
            ev_date        = ev["reporting_date"]
            ocr_val        = float(ev["ocr_value"])
            ev_file        = ev.get("file_name", "")

            # standardized_data 매칭
            std_record = std_index.get((ev_site, ev_metric, ev_date))
            if not std_record:
                logger.warning(
                    f"[evidence_verification] standardized_data 매칭 없음 "
                    f"{ev_site}/{ev_metric}/{ev_date} → 스킵"
                )
                skip_count += 1
                continue

            std_id   = int(std_record["id"])
            db_val   = float(std_record["value"])
            cur_vstatus = int(std_record.get("v_status", 0))

            # gap 계산
            gap_value, gap_percent = _calc_gap(db_val, ocr_val)
            unit_mismatch          = _is_unit_mismatch(db_val, ocr_val)

            # v_status 판정 (gap_percent_threshold 파라미터 반영)
            if unit_mismatch:
                new_v_status = 4
                diagnosis    = "단위 기입 오류 (1000배 오차 감지)"
            elif gap_percent >= gap_percent_threshold:
                new_v_status = 3
                diagnosis    = f"수치 불일치 (오차: {gap_percent:.2f}%)"
            else:
                new_v_status = 5
                diagnosis    = "정합성 확인 완료"

            # ── verification_logs INSERT ──────────────────────────────────
            log_record = {
                "std_id"      : std_id,
                "evidence_id" : ev_id,
                "gap_value"   : float(gap_value),
                "gap_percent" : float(gap_percent),
                "result_code" : new_v_status,
                "db_value"    : float(db_val),
                "ocr_value"   : float(ocr_val),
                "unit_mismatch": unit_mismatch,
                "diagnosis"   : diagnosis,
            }
            try:
                client.table("verification_logs").insert(log_record).execute()
            except Exception as e:
                logger.error(
                    f"[evidence_verification] verification_logs INSERT 실패 "
                    f"ev_id={ev_id}: {e}"
                )
                skip_count += 1
                continue

            # ── v_status UPDATE (v_status=1/3/4 인 경우 전이, 이상치=2는 유지) ──────────
            if cur_vstatus in (1, 3, 4):
                try:
                    client.table("standardized_data").update(
                        {"v_status": new_v_status}
                    ).eq("id", std_id).execute()
                except Exception as e:
                    logger.error(
                        f"[evidence_verification] v_status 업데이트 실패 "
                        f"std_id={std_id}: {e}"
                    )

            # ── raw_ocr_data.processing_status = "Success" ────────────────
            ocr_rec = ocr_by_file.get(ev_file)
            if ocr_rec and ocr_rec.get("processing_status") == "Extracted":
                try:
                    client.table("raw_ocr_data").update(
                        {"processing_status": "Success"}
                    ).eq("id", ocr_rec["id"]).execute()
                except Exception as e:
                    logger.warning(
                        f"[evidence_verification] raw_ocr_data Success 갱신 실패 "
                        f"file={ev_file}: {e}"
                    )

            # ── audit_trail 기록 (Rule 2) ─────────────────────────────────
            try:
                log_action(
                    std_id=std_id,
                    action=AuditAction.VERIFY,
                    performed_by="system",
                    reason=(
                        f"gap:{gap_percent:.2f}%, "
                        f"result_code:{new_v_status}, "
                        f"unit_mismatch:{unit_mismatch}"
                    ),
                    before_status=cur_vstatus if cur_vstatus in (1, 3, 4) else None,
                    after_status=new_v_status if cur_vstatus in (1, 3, 4) else None,
                )
            except Exception as e:
                logger.warning(
                    f"[evidence_verification] audit_trail 실패 std_id={std_id}: {e}"
                )

            results.append({
                "std_id"       : std_id,
                "evidence_id"  : ev_id,
                "site_id"      : ev_site,
                "metric_name"  : ev_metric,
                "reporting_date": ev_date,
                "db_value"     : float(db_val),
                "ocr_value"    : float(ocr_val),
                "gap_percent"  : float(gap_percent),
                "unit_mismatch": unit_mismatch,
                "new_v_status" : new_v_status,
                "diagnosis"    : diagnosis,
            })

            level = logging.WARNING if new_v_status in (3, 4) else logging.INFO
            logger.log(
                level,
                f"[evidence_verification] {ev_site}/{ev_metric}/{ev_date} "
                f"gap={gap_percent:.2f}% → v_status={new_v_status} ({diagnosis})"
            )

        count = len(results)
        logger.info(
            f"[evidence_verification] 완료: {count}건 검증, {skip_count}건 스킵"
        )

        return {
            "status" : "success",
            "data"   : results,
            "message": f"{count}건 검증 완료 (스킵: {skip_count}건)",
            "count"  : count,
        }

    except Exception as e:
        logger.error(f"[evidence_verification] 실행 오류: {e}")
        return {
            "status" : "error",
            "data"   : [],
            "message": str(e),
            "count"  : 0,
        }


if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    result = verify_evidence_data()
    print(json.dumps(result, ensure_ascii=False, indent=2))
