"""
outlier_detection.py
--------------------
이상치 탐지 파이프라인 모듈.

3_outlier_detect.ipynb 로직을 프로덕션 모듈로 전환합니다.
L1(Z-Score/YoY), L2(임계치), L3(원단위 편차) 3단계 탐지를 수행하고
outlier_results 에 결과를 기록하며 v_status 를 자동 전이시킵니다.

v_status 전이
-------------
0 (Pending) → 1 (Normal)   : 이상치 없음
0 (Pending) → 2 (Outlier)  : 이상치 탐지됨
"""

import logging

import numpy as np
import pandas as pd

from .audit_trail import AuditAction, log_action
from .database_utils import get_supabase_client

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

    v_status=0(Pending) 레코드를 대상으로 L1/L2/L3 분석을 수행하고
    - outlier_results INSERT
    - standardized_data.v_status UPDATE (0 → 1 or 2)
    - audit_trail 기록
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

        # ── STEP 1: Pending 대상 확인 ──────────────────────────────────────────
        pending_query = (
            client.table("standardized_data")
            .select("id, source_name, metric_name")
            .eq("v_status", 0)
        )
        if site_id:
            pending_query = pending_query.eq("source_name", site_id)
        if metric_name:
            pending_query = pending_query.eq("metric_name", metric_name)

        pending_rows = pending_query.execute().data
        if not pending_rows:
            return {
                "status": "success",
                "data": [],
                "message": "처리할 Pending(v_status=0) 데이터가 없습니다.",
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
        # pending 레코드가 속한 (source_name, metric_name) 조합만 처리
        target_combos = {
            (row["source_name"], row["metric_name"]) for row in pending_rows
        }

        outlier_results_list = []
        total_processed = 0
        total_skipped   = 0

        for s, m in target_combos:
            # 해당 사업장/지표의 전체 이력 (날짜순 정렬)
            site_usage = all_usage_df[
                (all_usage_df["source_name"] == s) & (all_usage_df["metric_name"] == m)
            ].sort_values("reporting_date").reset_index(drop=True)

            site_act = activity_df[
                activity_df["site_id"] == s
            ].sort_values("reporting_date")

            # 실적 + 활동량 병합 (inner join: 양쪽 모두 있는 날짜만)
            # site_usage 에는 source_name, site_act 에는 site_id → reporting_date 변수만으로 join
            merged = pd.merge(
                site_usage, site_act,
                on="reporting_date",
                how="inner",
                suffixes=('', '_act'),
            )

            if len(merged) < 13:
                # rolling window 최소 13행(현재 1 + 이전 12) 필요
                combo_pending_count = sum(
                    1 for r in pending_rows
                    if r["source_name"] == s and r["metric_name"] == m
                )
                logger.info(
                    f"[outlier_detection] {s}/{m}: 데이터 부족 "
                    f"({len(merged)}건, 최소 13건 필요) → {combo_pending_count}건 스킵"
                )
                total_skipped += combo_pending_count
                continue

            # L2 임계치 조회
            limit_row = threshold_df[
                (threshold_df["site_id"] == s) & (threshold_df["metric_name"] == m)
            ]
            upper_limit = (
                float(limit_row["upper_limit"].values[0])
                if not limit_row.empty
                else float("inf")
            )

            # ── STEP A: baseline 구간(i<12) pending 레코드 → v_status=1 ──────
            # 첫 12개월은 rolling window 기준 데이터 → 비교 대상 없으므로
            # '정상(Baseline)' 처리로 v_status=1 전이
            for i in range(min(12, len(merged))):
                brow   = merged.iloc[i]
                b_id   = int(brow["id"])
                if b_id not in pending_ids:
                    continue
                try:
                    client.table("standardized_data").update(
                        {"v_status": 1}
                    ).eq("id", b_id).execute()
                    total_processed += 1
                    log_action(
                        std_id=b_id,
                        action=AuditAction.DETECT,
                        performed_by="system",
                        reason="baseline 구간 (12개월 이전 이력 없음) → 정상 처리",
                        before_status=0,
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

                is_outlier    = bool(layers)
                new_v_status  = 2 if is_outlier else 1

                # ── v_status 업데이트 ────────────────────────────────────────
                try:
                    client.table("standardized_data").update(
                        {"v_status": new_v_status}
                    ).eq("id", std_id).execute()
                except Exception as e:
                    logger.error(
                        f"[outlier_detection] v_status 업데이트 실패 "
                        f"std_id={std_id}: {e}"
                    )
                    continue

                # ── outlier_results INSERT (이상치인 경우만) ─────────────────
                outlier_id = None
                if is_outlier:
                    severity    = _determine_severity(l2_fail, intensity_dev)
                    base_record = {
                        "std_id"         : std_id,
                        "layer"          : ", ".join(layers),
                        "detected_value" : float(val),
                        "threshold"      : float(upper_limit),
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
                        "source_name"        : s,
                        "metric_name"        : m,
                        "reporting_date"     : str(row["reporting_date"]),
                        "layer"              : ", ".join(layers),
                        "severity"           : severity,
                        "detected_value"     : float(val),
                        "z_score"            : float(z_score),
                        "yoy_roc"            : float(yoy_roc),
                        "intensity_deviation": float(intensity_dev),
                        "threshold"          : float(upper_limit),
                    })
                    logger.warning(
                        f"[outlier_detection] 이상치 탐지: {s}/{m}/"
                        f"{row['reporting_date']} | "
                        + ", ".join(layers)
                        + f" | {severity}"
                    )

                # ── audit_trail 기록 (Rule 2: 모든 변경 기록) ────────────────
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
                        before_status=0,
                        after_status=new_v_status,
                    )
                except Exception as e:
                    logger.warning(
                        f"[outlier_detection] audit_trail 기록 실패 "
                        f"std_id={std_id}: {e}"
                    )

        outlier_count = len(outlier_results_list)
        logger.info(
            f"[outlier_detection] 완료: {total_processed}건 처리, "
            f"{total_skipped}건 스킵, {outlier_count}건 이상치"
        )

        return {
            "status": "success",
            "data"  : outlier_results_list,
            "message": (
                f"{total_processed}건 처리 완료 (스킵: {total_skipped}건), "
                f"{outlier_count}개 이상치 탐지"
            ),
            "count" : outlier_count,
        }

    except Exception as e:
        logger.error(f"[outlier_detection] 실행 오류: {e}")
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
