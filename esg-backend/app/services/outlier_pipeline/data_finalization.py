"""
data_finalization.py
--------------------
수치 보정 및 최종 확정(Finalization) 모듈.

주요 함수
---------
- finalize_usage_data()      : 검증된 데이터를 최종 확정 (수치 보정 + v_status=5)
- revert_finalization()      : 확정 취소 (original_value 복원 + v_status 이전 상태로 복구)
- get_finalization_history() : 특정 레코드의 보정 이력 조회

상태 전이
---------
v_status 2(Outlier) / 3(Mismatch) / 4(Unit Error)
    → 수치 보정 + 확정 승인
    → v_status = 5 (Verified)

트랜잭션 전략 (Supabase 미지원 → 단계별 롤백)
---------
Step 1. 현재 레코드 조회 (before_value, before_status 스냅샷)
Step 2. standardized_data 업데이트 (original_value 백업 + value 보정 + v_status=5)
Step 3. audit_trail 기록
실패 시: 이전 스냅샷으로 복원 시도 후 오류 반환
"""

from datetime import datetime, timezone
from .database_utils import get_supabase_client, fetch_one
from .audit_trail import log_action, AuditAction


# ── 상수 ──────────────────────────────────────────────────────────────────────
V_STATUS_VERIFIED = 5   # 최종 확정 (Verified)


# ── 메인 함수 ──────────────────────────────────────────────────────────────────

def finalize_usage_data(
    std_id: int,
    corrected_value: float,
    user_id: str,
    reason: str,
) -> dict:
    """
    검증된 데이터를 최종 확정합니다.

    기존 value를 original_value에 백업한 뒤 corrected_value로 덮어쓰고,
    v_status를 5(Verified)로 전환합니다. 모든 변경은 audit_trail에 기록됩니다.

    Parameters
    ----------
    std_id : int
        확정할 standardized_data 레코드의 id
    corrected_value : float
        보정된 최종 수치. 수치 변경 없이 상태만 확정할 경우 기존 값을 그대로 전달합니다.
    user_id : str
        확정을 승인한 사용자 ID
    reason : str
        보정 사유 (감사 추적용)

    Returns
    -------
    dict
        {
            "status": "success" | "error" | "rollback_success" | "rollback_failed",
            "std_id": int,
            "before_value": float,          # 보정 전 수치
            "after_value": float,           # 보정 후 수치
            "before_status": int,           # 보정 전 v_status
            "after_status": int,            # 보정 후 v_status (성공 시 5)
            "audit_trail_id": int | None,   # 생성된 audit_trail.trail_id
            "message": str
        }

    Raises
    ------
    ValueError
        std_id에 해당하는 standardized_data 레코드가 없을 때
    """
    client = get_supabase_client()
    now = datetime.now(timezone.utc).isoformat()

    # ── Step 1: 현재 레코드 스냅샷 ──────────────────────────────────────────
    std_record = fetch_one("standardized_data", std_id)
    if not std_record:
        raise ValueError(f"standardized_data에서 id={std_id} 레코드를 찾을 수 없습니다.")

    before_value  = float(std_record["value"])
    before_status = int(std_record["v_status"])
    # original_value가 이미 있으면 최초 원본을 보존, 없으면 현재 value를 백업
    original_value = std_record.get("original_value") or before_value

    # ── Step 2: standardized_data 업데이트 ──────────────────────────────────────
    # 확장 컬럼(마이그레이션 후 사용 가능) 포함한 전체 payload 시도,
    # 실패 시 현재 DB에 존재하는 핵심 컬럼만으로 재시도 (fallback)
    update_payload_full = {
        "original_value":    float(original_value),
        "value":             float(corrected_value),
        "v_status":          V_STATUS_VERIFIED,
        "updated_by":        user_id,
        "updated_at":        now,
        "correction_reason": reason,
    }
    update_payload_minimal = {
        "value":    float(corrected_value),
        "v_status": V_STATUS_VERIFIED,
    }

    try:
        client.table("standardized_data").update(update_payload_full).eq("id", std_id).execute()
        update_payload = update_payload_full
    except Exception:
        # 확장 컨럼 없을 경우 핵심 컨럼만 업데이트 (마이그레이션 전 호환)
        try:
            client.table("standardized_data").update(update_payload_minimal).eq("id", std_id).execute()
            update_payload = update_payload_minimal
            print("⚠️  확장 컨럼 미존재 → 핵심 컨럼(value, v_status)만 업데이트 (마이그레이션 후 전체 적용)")
        except Exception as e:
            return {
            "status": "error",
            "std_id": std_id,
            "before_value": before_value,
            "after_value": before_value,
            "before_status": before_status,
            "after_status": before_status,
            "audit_trail_id": None,
            "message": f"standardized_data 업데이트 실패 (DB 변경 없음): {e}",
        }

    # ── Step 3: audit_trail 기록 ─────────────────────────────────────────────
    audit_result = log_action(
        std_id=std_id,
        action=AuditAction.FINALIZE,
        performed_by=user_id,
        reason=reason,
        before_value=float(before_value),
        after_value=float(corrected_value),
        before_status=before_status,
        after_status=V_STATUS_VERIFIED,
    )
    audit_trail_id = audit_result.get("trail_id")

    # audit_trail 실패(테이블 미존재 제외)면 롤백
    if audit_result["status"] == "error":
        print(f"⚠️  audit_trail 오류. standardized_data 롤백을 시도합니다.")
        rollback_payload = {"value": float(before_value), "v_status": before_status}
        try:
            client.table("standardized_data").update(rollback_payload).eq("id", std_id).execute()
            return {
                "status": "rollback_success",
                "std_id": std_id,
                "before_value": before_value,
                "after_value": before_value,
                "before_status": before_status,
                "after_status": before_status,
                "audit_trail_id": None,
                "message": f"audit_trail 실패로 롤백 완료. 데이터 원상 복구됨: {audit_result['message']}",
            }
        except Exception as rollback_err:
            return {
                "status": "rollback_failed",
                "std_id": std_id,
                "before_value": before_value,
                "after_value": float(corrected_value),
                "before_status": before_status,
                "after_status": V_STATUS_VERIFIED,
                "audit_trail_id": None,
                "message": f"audit_trail 실패 + 롤백도 실패. 수동 확인 필요! | 롤백 오류: {rollback_err}",
            }

    return {
        "status": "success",
        "std_id": std_id,
        "before_value": before_value,
        "after_value": float(corrected_value),
        "before_status": before_status,
        "after_status": V_STATUS_VERIFIED,
        "audit_trail_id": audit_trail_id,
        "message": (
            f"최종 확정 완료. "
            f"value: {before_value} → {corrected_value}, "
            f"v_status: {before_status} → {V_STATUS_VERIFIED}"
        ),
    }


# ── 확정 취소 함수 ─────────────────────────────────────────────────────────────

def revert_finalization(std_id: int, user_id: str, reason: str) -> dict:
    """
    최종 확정(v_status=5)을 취소하고 original_value로 복원합니다.

    Parameters
    ----------
    std_id : int
        복원할 standardized_data 레코드의 id
    user_id : str
        취소를 수행한 사용자 ID
    reason : str
        취소 사유

    Returns
    -------
    dict
        {
            "status": "success" | "error",
            "std_id": int,
            "restored_value": float,    # 복원된 값 (original_value)
            "message": str
        }

    Raises
    ------
    ValueError
        std_id 레코드가 없거나, v_status가 5가 아닌 경우
    """
    client = get_supabase_client()
    now = datetime.now(timezone.utc).isoformat()

    std_record = fetch_one("standardized_data", std_id)
    if not std_record:
        raise ValueError(f"standardized_data에서 id={std_id} 레코드를 찾을 수 없습니다.")

    if int(std_record["v_status"]) != V_STATUS_VERIFIED:
        raise ValueError(
            f"id={std_id}의 v_status가 {std_record['v_status']}이므로 확정 취소할 수 없습니다. "
            f"(취소 가능 상태: {V_STATUS_VERIFIED})"
        )

    original_value = std_record.get("original_value")
    if original_value is None:
        raise ValueError(f"id={std_id}에 original_value가 없어 복원할 수 없습니다.")

    current_value = float(std_record["value"])
    restored_value = float(original_value)

    # 이전 v_status는 audit_trail에서 복원 (없으면 2=Outlier로 되돌림)
    audit_history = (
        client.table("audit_trail")
        .select("before_status")
        .eq("std_id", std_id)
        .eq("action", "FINALIZE")
        .order("performed_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    prev_status = audit_history[0]["before_status"] if audit_history else 2

    try:
        client.table("standardized_data").update({
            "value":             restored_value,
            "original_value":    None,
            "v_status":          prev_status,
            "updated_by":        user_id,
            "updated_at":        now,
            "correction_reason": f"[확정취소] {reason}",
        }).eq("id", std_id).execute()

        # audit_trail 기록
        log_action(
            std_id=std_id,
            action=AuditAction.REVERT,
            performed_by=user_id,
            reason=reason,
            before_value=float(current_value),
            after_value=restored_value,
            before_status=V_STATUS_VERIFIED,
            after_status=prev_status,
        )

    except Exception as e:
        return {
            "status": "error",
            "std_id": std_id,
            "restored_value": None,
            "message": f"확정 취소 실패: {e}",
        }

    return {
        "status": "success",
        "std_id": std_id,
        "restored_value": restored_value,
        "message": f"확정 취소 완료. value: {current_value} → {restored_value}, v_status: {V_STATUS_VERIFIED} → {prev_status}",
    }


# ── 이력 조회 함수 ─────────────────────────────────────────────────────────────

def get_finalization_history(std_id: int) -> list[dict]:
    """
    특정 레코드의 보정 이력을 audit_trail에서 조회합니다.

    Parameters
    ----------
    std_id : int
        조회할 standardized_data 레코드의 id

    Returns
    -------
    list[dict]
        FINALIZE / REVERT 액션 목록 (최신순)
    """
    client = get_supabase_client()
    result = (
        client.table("audit_trail")
        .select("*")
        .eq("std_id", std_id)
        .in_("action", ["FINALIZE", "REVERT"])
        .order("performed_at", desc=True)
        .execute()
    )
    return result.data


# ── 연결 검증 (직접 실행 시) ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔍 data_finalization 동작 검증 중...")
    try:
        client = get_supabase_client()

        # 이상치(v_status=2,3,4) 데이터 1건 조회
        targets = (
            client.table("standardized_data")
            .select("id, site_id, metric_name, value, v_status")
            .in_("v_status", [2, 3, 4])
            .limit(1)
            .execute()
            .data
        )

        if not targets:
            print("💡 현재 v_status 2/3/4 데이터가 없습니다. 검증을 건너뜁니다.")
        else:
            sample = targets[0]
            print(f"📌 확정 대상 샘플: {sample}")

            result = finalize_usage_data(
                std_id=sample["id"],
                corrected_value=float(sample["value"]),  # 수치 변경 없이 상태만 확정
                user_id="test_user",
                reason="테스트 확정 (수치 동일)",
            )
            print(f"✅ 결과: {result}")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
