"""
evidence_verification.py
------------------------
OCR 증빙 자료 정합성 검증 모듈.

evidence_usage 와 standardized_data 를 비교하여 gap_percent 를 계산하고
자동 verification_logs 에 기록하며 v_status 를 자동 전이시킵니다.

v_status 전이 규칙 (통합 파이프라인)
--------------------------------------
이상치 탐지(outlier_results) 결과와 증빙 정합성 결과를 조합하여 결정:

  PASS + 일치  → 5 (Verified, 자동 확정)
  PASS + 불일치 → 2 (이상치 없음, 증빙과 다름)
  FAIL + 일치  → 3 (이상치 탐지, 증빙과는 같음)
  FAIL + 불일치 → 4 (이상치 탐지, 증빙과도 다름)

result_code (증빙 비교 결과만)
  0 = 일치 (gap_percent == 0)
  1 = 불일치 (gap_percent != 0)
  2 = 단위 오류 의심 (unit_mismatch == True)

처리 흐름
---------
evidence_usage (미검증)
    ↔ standardized_data (site_id + metric_name + reporting_date, v_status=1)
    ↔ outlier_results (std_id 존재 여부로 이상치 판정)
    → gap_value / gap_percent 계산
    → result_code / unit_mismatch 판정
    → verification_logs INSERT
    → standardized_data.v_status UPDATE (1 → 2 / 3 / 4 / 5)
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


def _build_diagnosis(v_status: int, gap_percent: float, unit_mismatch: bool) -> str:
    """v_status와 gap 정보를 바탕으로 diagnosis 문자열을 생성합니다."""
    unit_note = " [단위 오류 의심]" if unit_mismatch else ""
    if v_status == 5:
        return "정합성 확인 완료 (이상치 없음, 증빙 일치)"
    if v_status == 2:
        return f"증빙 불일치 — 이상치 없음 (오차: {gap_percent:.2f}%){unit_note}"
    if v_status == 3:
        return f"이상치 탐지 — 증빙 일치 (이상치 원인 소명 필요){unit_note}"
    if v_status == 4:
        return f"이상치 탐지 + 증빙 불일치 (오차: {gap_percent:.2f}%){unit_note}"
    return f"검증 완료 (gap: {gap_percent:.2f}%){unit_note}"


def _determine_v_status(
    gap_percent: float,
    unit_mismatch: bool,
    has_outlier: bool,
) -> tuple[int, int, str]:
    """
    v_status, result_code, diagnosis 를 반환합니다 (통합 파이프라인 규칙).

    Parameters
    ----------
    gap_percent   : |db - ocr| / db * 100
    unit_mismatch : 1000배 단위 오기입 여부
    has_outlier   : outlier_results 에 해당 std_id 레코드 존재 여부

    Returns
    -------
    (new_v_status, result_code, diagnosis)

    result_code:
        0 = 일치 (gap_percent == 0)
        1 = 불일치 (gap_percent != 0)
        2 = 단위 오류 의심 (unit_mismatch == True)
    """
    # result_code: 증빙 비교 결과만 반영
    if unit_mismatch:
        result_code    = 2
        evidence_match = False
    elif gap_percent == 0.0:
        result_code    = 0
        evidence_match = True
    else:
        result_code    = 1
        evidence_match = False

    # v_status: 이상치 여부 + 증빙 일치 여부 조합
    if not has_outlier and evidence_match:
        v_status = 5   # PASS + 일치  → 자동 확정
    elif not has_outlier and not evidence_match:
        v_status = 2   # PASS + 불일치
    elif has_outlier and evidence_match:
        v_status = 3   # FAIL + 일치
    else:
        v_status = 4   # FAIL + 불일치

    diagnosis = _build_diagnosis(v_status, gap_percent, unit_mismatch)
    return v_status, result_code, diagnosis


# ── 메인 함수 ─────────────────────────────────────────────────────────────────

def verify_evidence_data(
    site_id: str = None,
    metric_name: str = None,
) -> dict:
    """
    evidence_usage 와 standardized_data 를 비교하여 정합성을 검증합니다.

    v_status=1 인 standardized_data 와 매칭되는 evidence_usage 레코드를 대상으로
    - verification_logs INSERT
    - standardized_data.v_status UPDATE (1 → 2 / 3 / 4 / 5)
    - raw_ocr_data.processing_status = "Success"
    - audit_trail 기록
    을 수행합니다.

    gap 기준: gap_percent == 0.0 만 일치(result_code=0) 처리.
    v_status 는 outlier_results 존재 여부와 증빙 일치 여부의 조합으로 결정.

    Parameters
    ----------
    site_id : str, optional
        특정 사업장만 처리. None 이면 전체.
    metric_name : str, optional
        특정 지표만 처리. None 이면 전체.

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

        # ── STEP 2: 이미 verification_logs에 기록된 evidence_id 스킵 ──────
        verified_ids_rows = (
            client.table("verification_logs")
            .select("evidence_id")
            .execute()
            .data
        )
        already_verified: set[int] = {
            r["evidence_id"] for r in verified_ids_rows
            if r.get("evidence_id")
        }

        pending_evidence = [
            r for r in all_evidence if r["id"] not in already_verified
        ]

        logger.info(f"[evidence_verification] 검증 대상: {len(pending_evidence)}건")

        # ── STEP 3: standardized_data 캐시 (v_status=1 — 검증 파이프라인 시작점) ──
        std_query = (
            client.table("standardized_data")
            .select("*")
            .eq("v_status", 1)
        )
        if site_id:
            std_query = std_query.eq("site_id", site_id)
        if metric_name:
            std_query = std_query.eq("metric_name", metric_name)
        std_rows = std_query.execute().data

        # (site_id, metric_name, reporting_date) → record 인덱싱
        std_index: dict[tuple, dict] = {
            (r["site_id"], r["metric_name"], r["reporting_date"]): r
            for r in std_rows
        }

        # ── STEP 3-5: outlier_results 캐시 (std_id별 이상치 탐지 여부) ─────
        outlier_rows = (
            client.table("outlier_results")
            .select("std_id")
            .execute()
            .data
        )
        outlier_std_ids: set[int] = {
            int(r["std_id"]) for r in outlier_rows if r.get("std_id") is not None
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

            std_id      = int(std_record["id"])
            db_val      = float(std_record["value"])
            cur_vstatus = int(std_record.get("v_status", 0))

            # gap 계산
            gap_value, gap_percent = _calc_gap(db_val, ocr_val)
            unit_mismatch          = _is_unit_mismatch(db_val, ocr_val)

            # 이상치 여부 확인 (outlier_results 캐시 참조)
            has_outlier = std_id in outlier_std_ids

            # v_status / result_code / diagnosis 통합 판정
            new_v_status, result_code, diagnosis = _determine_v_status(
                gap_percent, unit_mismatch, has_outlier
            )

            # ── verification_logs INSERT ──────────────────────────────────
            log_record = {
                "std_id"       : std_id,
                "evidence_id"  : ev_id,
                "gap_value"    : float(gap_value),
                "gap_percent"  : float(gap_percent),
                "result_code"  : result_code,
                "db_value"     : float(db_val),
                "ocr_value"    : float(ocr_val),
                "unit_mismatch": unit_mismatch,
                "diagnosis"    : diagnosis,
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

            # ── v_status UPDATE (v_status=1 인 경우만 전이) ───────────────────
            if cur_vstatus == 1:
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

            # ── audit_trail 기록 ──────────────────────────────────────────
            try:
                log_action(
                    std_id=std_id,
                    action=AuditAction.VERIFY,
                    performed_by="system",
                    reason=(
                        f"gap:{gap_percent:.2f}%, "
                        f"result_code:{result_code}, "
                        f"has_outlier:{has_outlier}, "
                        f"unit_mismatch:{unit_mismatch}"
                    ),
                    before_status=cur_vstatus if cur_vstatus == 1 else None,
                    after_status=new_v_status if cur_vstatus == 1 else None,
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
