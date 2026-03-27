"""
outlier_detection.py
--------------------
이상치 탐지 파이프라인 모듈.

3_outlier_detect.ipynb 로직을 프로덕션 모듈로 전환합니다.
L1(Z-Score/YoY), L2(임계치), L3(원단위 편차) 3단계 탐지를 수행하고
outlier_results 에 결과를 기록합니다.

전체 흐름 (이 함수 하나로 탐지 + 검증이 연속 실행됨)
-----------------------------------------------------
STEP 1~4: L1/L2/L3 이상치 탐지
  · 탐지 대상: v_status=1 (표준화 완료, 미탐지 레코드)
  · 이상치 탐지 결과는 outlier_results 테이블에 기록
  · 이 단계에서는 v_status 를 변경하지 않음 (v_status=1 유지)

STEP 5: verify_evidence_data() 자동 연동 호출
  · 탐지 완료 직후 증빙 검증을 자동 실행
  · outlier_results 존재 여부 + evidence_usage 비교 결과를 조합하여 v_status 최종 결정
      이상치 없음 + 증빙 일치   → v_status = 5 (자동 확정)
      이상치 없음 + 증빙 불일치  → v_status = 2
      이상치 있음 + 증빙 일치   → v_status = 3
      이상치 있음 + 증빙 불일치  → v_status = 4

중복 처리 방지
--------------
audit_trail 의 DETECT 액션으로 이미 탐지된 레코드를 식별하여 재실행 시 스킵.
"""

import logging

import numpy as np
import pandas as pd

from .audit_trail import AuditAction, log_action
from .database_utils import get_supabase_client
from .evidence_verification import verify_evidence_data

logger = logging.getLogger(__name__)

# ── 탐지 임계값 상수 (3_outlier_detect.ipynb 동일) ─────────────────────────────
L1_Z_THRESHOLD         = 3.0   # Z-Score 상한
L1_YOY_THRESHOLD       = 30.0  # 전년 동월 대비 변화율(%) 상한
L3_INTENSITY_THRESHOLD = 50.0  # 원단위 편차(%) 상한


# ── 내부 헬퍼 함수 ─────────────────────────────────────────────────────────────

def _calculate_z_score(value: float, window: pd.Series) -> float:
    """L1: 12개월 rolling window 기반 Z-Score 계산."""
    std = float(window.std())
    if std > 0:
        return float(abs(value - float(window.mean())) / std)
    return 0.0


def _calculate_yoy_roc(value: float, yoy_value: float) -> float:
    """L1: 전년 동월 대비 변화율(%) 계산."""
    if yoy_value != 0:
        return float(abs((value - yoy_value) / yoy_value * 100))
    return 0.0


def _calculate_intensity_deviation(
    value: float, prod_qty: float, hist_window: pd.DataFrame
) -> float:
    """L3: 원단위(intensity) 편차(%) 계산."""
    if prod_qty <= 0:
        return 0.0
    intensity = value / prod_qty
    valid_prod = hist_window["production_qty"].replace(0, np.nan)
    hist_intensity = hist_window["value"] / valid_prod
    hist_mean = float(hist_intensity.mean())
    if pd.isna(hist_mean) or hist_mean == 0:
        return 0.0
    return float(abs((intensity - hist_mean) / hist_mean * 100))


def _determine_severity(l2_fail: bool, intensity_dev: float) -> str:
    """이상치 심각도 등급 판정 (Critical > Major > Warning)."""
    if l2_fail:
        return "Critical"
    if intensity_dev > L3_INTENSITY_THRESHOLD:
        return "Major"
    return "Warning"


# ── 메인 탐지 함수 ─────────────────────────────────────────────────────────────

def detect_outliers(site_id: str = None, metric_name: str = None) -> dict:
    """
    이상치 탐지를 실행합니다 (3_outlier_detect.ipynb 기반).

    v_status=1(표준화 완료) 레코드 중 아직 탐지되지 않은 것을 대상으로
    L1/L2/L3 분석을 수행하고
    - outlier_results INSERT
    - audit_trail 기록 (v_status 는 변경하지 않음, evidence_verification 에서 결정)
    을 수행합니다.

    Parameters
    ----------
    site_id : str, optional
        특정 사업장만 처리. None 이면 전체 사업장.
    metric_name : str, optional
        특정 지표만 처리. None 이면 전체 지표.

    Returns
    -------
    dict
        {
            "status"  : "success" | "error",
            "data"    : [탐지된 이상치 목록],
            "message" : str,
            "count"   : int   # 탐지된 이상치 수
        }
    """
    try:
        client = get_supabase_client()

        # ── STEP 1: 탐지 대상 확인 (v_status=1, 미탐지 레코드) ───────────────
        pending_query = (
            client.table("standardized_data")
            .select("id, site_id, metric_name")
            .eq("v_status", 1)
        )
        if site_id:
            pending_query = pending_query.eq("site_id", site_id)
        if metric_name:
            pending_query = pending_query.eq("metric_name", metric_name)

        all_v1_rows = pending_query.execute().data
        if not all_v1_rows:
            return {
                "status": "success",
                "data": [],
                "message": "처리할 표준화 완료(v_status=1) 데이터가 없습니다.",
                "count": 0,
            }

        # 이미 탐지된 std_id 는 audit_trail DETECT 액션으로 식별 → 중복 처리 방지
        detected_rows = (
            client.table("audit_trail")
            .select("std_id")
            .eq("action", "DETECT")
            .execute()
            .data
        )
        already_detected_ids: set[int] = {
            int(r["std_id"]) for r in detected_rows if r.get("std_id") is not None
        }

        pending_rows = [r for r in all_v1_rows if r["id"] not in already_detected_ids]
        if not pending_rows:
            return {
                "status": "success",
                "data": [],
                "message": "미탐지 데이터가 없습니다. (v_status=1 레코드가 모두 이미 탐지됨)",
                "count": 0,
            }

        pending_ids = {row["id"] for row in pending_rows}
        logger.info(f"[outlier_detection] Pending 대상: {len(pending_ids)}건")

        # ── STEP 2: 분석용 전체 데이터 로드 ────────────────────────────────────
        # rolling window 계산을 위해 전체 이력이 필요
        all_usage_data  = client.table("standardized_data").select("*").execute().data
        activity_data   = client.table("activity_data").select("*").execute().data
        threshold_data  = client.table("threshold_limits").select("*").execute().data

        all_usage_df  = pd.DataFrame(all_usage_data)
        activity_df   = pd.DataFrame(activity_data)
        threshold_df  = pd.DataFrame(threshold_data)

        # ── STEP 3: 사업장 × 지표 조합별 rolling window 분석 ──────────────────
        # pending 레코드가 속한 (site_id, metric_name) 조합만 처리
        target_combos = {
            (row["site_id"], row["metric_name"]) for row in pending_rows
        }

        outlier_results_list = []
        total_processed = 0
        total_skipped   = 0
        processed_pending_ids: set = set()   # merge 루프에서 실제 처리된 pending id

        for s, m in target_combos:
            # 해당 사업장/지표의 전체 이력 (날짜순 정렬)
            site_usage = all_usage_df[
                (all_usage_df["site_id"] == s) & (all_usage_df["metric_name"] == m)
            ].sort_values("reporting_date").reset_index(drop=True)

            # activity_data 없거나 빈 경우 빈 DataFrame 처리 (L3는 스킵, L1/L2는 정상 수행)
            if activity_df.empty or "site_id" not in activity_df.columns:
                site_act = pd.DataFrame(columns=["reporting_date", "production_qty"])
            else:
                site_act = activity_df[
                    activity_df["site_id"] == s
                ].sort_values("reporting_date")

            # 실적 + 활동량 병합 (left join: activity_data 없는 날짜도 포함)
            # L1/L3 계산에 production_qty가 필요하지만, L2는 단독으로도 판정 가능
            merged = pd.merge(
                site_usage, site_act,
                on="reporting_date",
                how="left",
                suffixes=('', '_act'),
            )

            if len(merged) < 13:
                # rolling window 최소 13행(현재 1 + 이전 12) 필요
                combo_pending_count = sum(
                    1 for r in pending_rows
                    if r["site_id"] == s and r["metric_name"] == m
                )
                logger.info(
                    f"[outlier_detection] {s}/{m}: 데이터 부족 "
                    f"({len(merged)}건, 최소 13건 필요) → {combo_pending_count}건 스킵"
                )
                total_skipped += combo_pending_count
                continue

            # L2 임계치 조회 (threshold_limits 비어있으면 inf fallback)
            if threshold_df.empty or "site_id" not in threshold_df.columns:
                upper_limit = float("inf")
            else:
                limit_row = threshold_df[
                    (threshold_df["site_id"] == s) & (threshold_df["metric_name"] == m)
                ]
                upper_limit = (
                    float(limit_row["upper_limit"].values[0])
                    if not limit_row.empty
                    else float("inf")
                )

            # ── STEP A: baseline 구간(i<12) pending 레코드 처리 ─────────────
            # 첫 12개월은 rolling window 기준 데이터 → 비교 대상 없으므로
            # '정상(Baseline)' 처리 (v_status 는 1 유지, audit_trail 만 기록)
            for i in range(min(12, len(merged))):
                brow   = merged.iloc[i]
                b_id   = int(brow["id"])
                if b_id not in pending_ids:
                    continue
                try:
                    total_processed += 1
                    log_action(
                        std_id=b_id,
                        action=AuditAction.DETECT,
                        performed_by="system",
                        reason="baseline 구간 (12개월 이전 이력 없음) → 정상 처리",
                        before_status=1,
                        after_status=1,
                    )
                except Exception as e:
                    logger.warning(
                        f"[outlier_detection] baseline 처리 실패 std_id={b_id}: {e}"
                    )

            # ── STEP B: 슬라이딩 윈도우 루프 (i≥12) ─────────────────────────
            for i in range(12, len(merged)):
                row    = merged.iloc[i]
                std_id = int(row["id"])

                if std_id not in pending_ids:
                    continue  # Pending 아닌 레코드는 스킵

                total_processed += 1
                processed_pending_ids.add(std_id)
                val    = float(row["value"])
                window = merged.iloc[i - 12 : i]["value"]

                # [L1] Z-Score & YoY-RoC
                z_score   = _calculate_z_score(val, window)
                yoy_value = float(merged.iloc[i - 12]["value"])
                yoy_roc   = _calculate_yoy_roc(val, yoy_value)

                # [L2] 고정 임계치
                l2_fail = val > upper_limit

                # [L3] 원단위 편차
                prod_qty      = float(row.get("production_qty", 0))
                hist_window   = merged.iloc[i - 12 : i]
                intensity_dev = _calculate_intensity_deviation(
                    val, prod_qty, hist_window
                )

                # 탐지 결과 조합
                layers = []
                if z_score > L1_Z_THRESHOLD or yoy_roc > L1_YOY_THRESHOLD:
                    layers.append(f"L1(Z:{z_score:.1f},YoY:{yoy_roc:.1f}%)")
                if l2_fail:
                    layers.append(f"L2(Limit:{upper_limit})")
                if intensity_dev > L3_INTENSITY_THRESHOLD:
                    layers.append(f"L3(Dev:{intensity_dev:.1f}%)")

                is_outlier = bool(layers)
                # v_status 는 이 단계에서 변경하지 않음.
                # STEP 5 에서 verify_evidence_data() 가 자동 호출되어
                # outlier_results 존재 여부 + 증빙 비교 결과를 조합해 2/3/4/5 로 결정.

                # ── outlier_results INSERT (이상치인 경우만) ─────────────────
                outlier_id = None
                if is_outlier:
                    severity    = _determine_severity(l2_fail, intensity_dev)
                    # float("inf") 는 JSON 직렬화 불가 → None 처리
                    threshold_val = None if upper_limit == float("inf") else float(upper_limit)
                    base_record = {
                        "std_id"         : std_id,
                        "layer"          : ", ".join(layers),
                        "detected_value" : float(val),
                        "threshold"      : threshold_val,
                        "severity"       : severity,
                    }
                    # Rule 9: 신규 컬럼(z_score, yoy_roc, intensity_deviation)
                    # 마이그레이션 전 fallback 처리
                    try:
                        extended = dict(base_record)
                        extended.update({
                            "z_score"            : float(z_score),
                            "yoy_roc"            : float(yoy_roc),
                            "intensity_deviation": float(intensity_dev),
                        })
                        res        = client.table("outlier_results").insert(extended).execute()
                        outlier_id = res.data[0]["id"] if res.data else None
                    except Exception:
                        # 신규 컬럼 없으면 기본 컬럼만으로 재시도
                        try:
                            res        = client.table("outlier_results").insert(base_record).execute()
                            outlier_id = res.data[0]["id"] if res.data else None
                        except Exception as e2:
                            logger.error(
                                f"[outlier_detection] outlier_results INSERT 실패 "
                                f"std_id={std_id}: {e2}"
                            )

                    outlier_results_list.append({
                        "std_id"             : std_id,
                        "outlier_id"         : outlier_id,
                        "site_id"            : s,
                        "metric_name"        : m,
                        "reporting_date"     : str(row["reporting_date"]),
                        "layer"              : ", ".join(layers),
                        "severity"           : severity,
                        "detected_value"     : float(val),
                        "z_score"            : float(z_score),
                        "yoy_roc"            : float(yoy_roc),
                        "intensity_deviation": float(intensity_dev),
                        "threshold"          : None if upper_limit == float("inf") else float(upper_limit),
                    })
                    logger.warning(
                        f"[outlier_detection] 이상치 탐지: {s}/{m}/"
                        f"{row['reporting_date']} | "
                        + ", ".join(layers)
                        + f" | {severity}"
                    )

                # ── audit_trail 기록 (v_status 변경 없음, 탐지 결과만 기록) ─
                reason = (
                    ", ".join(layers)
                    if is_outlier
                    else f"정상 (Z:{z_score:.1f}, YoY:{yoy_roc:.1f}%)"
                )
                try:
                    log_action(
                        std_id=std_id,
                        action=AuditAction.DETECT,
                        performed_by="system",
                        reason=reason,
                        before_status=1,
                        after_status=1,
                    )
                except Exception as e:
                    logger.warning(
                        f"[outlier_detection] audit_trail 기록 실패 "
                        f"std_id={std_id}: {e}"
                    )

        # ── STEP 4: 미처리 pending 행 → L2 단독 체크 (이력 없는 신규 행) ──────
        # 메인 루프(merged 기반)에서 처리되지 않은 pending 행들:
        #   - activity_data 날짜 범위 밖 (ex. 미래 날짜)
        #   - 이력 데이터 부족으로 스킵된 조합
        # 이들은 L1/L3 판정 불가 → L2(절대 상한 초과) 만으로 판정
        unprocessed_ids = pending_ids - processed_pending_ids
        if unprocessed_ids:
            logger.info(f"[outlier_detection] L2 단독 체크 대상: {len(unprocessed_ids)}건")
            unprocessed_rows = client.table("standardized_data").select(
                "id,site_id,metric_name,value,reporting_date"
            ).in_("id", list(unprocessed_ids)).execute().data

            for urow in unprocessed_rows:
                u_id     = int(urow["id"])
                u_site   = urow["site_id"]
                u_metric = urow["metric_name"]
                u_val    = float(urow["value"])

                # L2 임계치 조회
                if threshold_df.empty or "site_id" not in threshold_df.columns:
                    u_upper = float("inf")
                else:
                    limit_row = threshold_df[
                        (threshold_df["site_id"] == u_site)
                        & (threshold_df["metric_name"] == u_metric)
                    ]
                    u_upper = (
                        float(limit_row["upper_limit"].values[0])
                        if not limit_row.empty
                        else float("inf")
                    )

                l2_fail = u_val > u_upper
                # v_status 는 이 단계에서 변경하지 않음.
                # STEP 5 에서 verify_evidence_data() 가 자동 호출되어 2/3/4/5 로 결정.
                total_processed += 1

                if l2_fail:
                    u_upper_val = None if u_upper == float("inf") else float(u_upper)
                    layer_str = f"L2(Limit:{u_upper})"
                    base_record = {
                        "std_id"         : u_id,
                        "layer"          : layer_str,
                        "detected_value" : u_val,
                        "threshold"      : u_upper_val,
                        "severity"       : "Critical",
                    }
                    outlier_id = None
                    try:
                        extended = dict(base_record)
                        extended.update({"z_score": 0.0, "yoy_roc": 0.0, "intensity_deviation": 0.0})
                        res = client.table("outlier_results").insert(extended).execute()
                        outlier_id = res.data[0]["id"] if res.data else None
                    except Exception:
                        try:
                            res = client.table("outlier_results").insert(base_record).execute()
                            outlier_id = res.data[0]["id"] if res.data else None
                        except Exception as e2:
                            logger.error(f"[outlier_detection] L2 outlier_results INSERT 실패 std_id={u_id}: {e2}")

                    outlier_results_list.append({
                        "std_id"             : u_id,
                        "outlier_id"         : outlier_id,
                        "site_id"            : u_site,
                        "metric_name"        : u_metric,
                        "reporting_date"     : str(urow["reporting_date"]),
                        "layer"              : layer_str,
                        "severity"           : "Critical",
                        "detected_value"     : u_val,
                        "z_score"            : 0.0,
                        "yoy_roc"            : 0.0,
                        "intensity_deviation": 0.0,
                        "threshold"          : None if u_upper == float("inf") else float(u_upper),
                    })
                    logger.warning(f"[outlier_detection] L2 Critical: {u_site}/{u_metric} val={u_val} > limit={u_upper}")

                reason = f"L2 단독 체크: {'초과' if l2_fail else '정상'} (limit={u_upper})"
                try:
                    log_action(
                        std_id=u_id,
                        action=AuditAction.DETECT,
                        performed_by="system",
                        reason=reason,
                        before_status=1,
                        after_status=1,
                    )
                except Exception as e:
                    logger.warning(f"[outlier_detection] L2 audit_trail 실패 std_id={u_id}: {e}")

        outlier_count = len(outlier_results_list)
        logger.info(
            f"[outlier_detection] 완료: {total_processed}건 처리, "
            f"{total_skipped}건 스킵, {outlier_count}건 이상치"
        )

        # ── STEP 5: 증빙 검증 자동 연동 ──────────────────────────────────────
        # 이상치 탐지 완료 후 evidence_verification 을 자동 호출하여
        # outlier_results + 증빙 비교 결과를 조합한 최종 v_status 를 결정한다.
        logger.info("[outlier_detection] 증빙 정합성 검증 자동 시작...")
        try:
            verification_result = verify_evidence_data(
                site_id=site_id,
                metric_name=metric_name,
            )
            logger.info(
                f"[outlier_detection] 증빙 검증 완료: {verification_result.get('message', '')}"
            )
        except Exception as e:
            logger.error(f"[outlier_detection] 증빙 검증 자동 호출 실패: {e}")
            verification_result = {"status": "error", "message": str(e), "count": 0}

        # ── STEP 6: 증빙 미연계 항목 fallback 처리 ────────────────────────────
        # verify_evidence_data() 이후에도 v_status=1 로 남은 항목을 처리한다.
        # - 이상치 탐지됨 + 증빙 없음 → v_status=4 (FAIL + 불일치 fallback)
        # - 이상치 없음   + 증빙 없음 → v_status=5 (PASS + 일치 fallback, 자동 확정)
        fallback_confirmed = 0
        fallback_review    = 0
        try:
            if pending_ids:
                remaining_rows = (
                    client.table("standardized_data")
                    .select("id")
                    .in_("id", list(pending_ids))
                    .eq("v_status", 1)
                    .execute()
                    .data
                )
                # 이번 탐지에서 outlier_results 에 등록된 std_id 집합
                detected_set: set[int] = {r["std_id"] for r in outlier_results_list}

                for rem in remaining_rows:
                    rem_id   = int(rem["id"])
                    new_vs   = 4 if rem_id in detected_set else 5
                    reason   = (
                        "증빙 미연계 fallback: 이상치 탐지 → v_status=4"
                        if new_vs == 4
                        else "증빙 미연계 fallback: 정상 자동확정 → v_status=5"
                    )
                    try:
                        client.table("standardized_data").update(
                            {"v_status": new_vs}
                        ).eq("id", rem_id).execute()
                        log_action(
                            std_id=rem_id,
                            action=AuditAction.VERIFY,
                            performed_by="system",
                            reason=reason,
                            before_status=1,
                            after_status=new_vs,
                        )
                        if new_vs == 5:
                            fallback_confirmed += 1
                        else:
                            fallback_review += 1
                    except Exception as fe:
                        logger.warning(
                            f"[outlier_detection] fallback 업데이트 실패 std_id={rem_id}: {fe}"
                        )

                if remaining_rows:
                    logger.info(
                        f"[outlier_detection] 증빙 미연계 fallback: "
                        f"자동확정(v5) {fallback_confirmed}건, "
                        f"검토필요(v4) {fallback_review}건"
                    )
        except Exception as e:
            logger.warning(f"[outlier_detection] STEP 6 fallback 오류: {e}")

        return {
            "status": "success",
            "data"  : outlier_results_list,
            "message": (
                f"{total_processed}건 처리 완료 (스킵: {total_skipped}건), "
                f"{outlier_count}개 이상치 탐지"
            ),
            "count" : outlier_count,
            "verification": verification_result,
            "fallback": {
                "auto_confirmed": fallback_confirmed,
                "needs_review":   fallback_review,
            },
        }

    except Exception as e:
        import traceback
        logger.error(f"[outlier_detection] 실행 오류: {e}\n{traceback.format_exc()}")
        return {
            "status" : "error",
            "data"   : [],
            "message": str(e),
            "count"  : 0,
        }


if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    result = detect_outliers()
    print(json.dumps(result, ensure_ascii=False, indent=2))
