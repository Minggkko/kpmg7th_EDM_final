"""
outlier_management.py
---------------------
이상치 소명(Justification) 처리 모듈.

주요 함수
---------
- update_outlier_justification() : 사용자 소명 제출 → DB 기록 + v_status 전이
- get_outlier_detail()           : 특정 데이터의 이상치 상세 정보 조회

상태 전이
---------
v_status 2 (Outlier) → 소명 제출 후
  - action_taken == '정상'  → v_status = 1 (Normal)
  - action_taken != '정상'  → v_status 유지 (추가 검토 대기)
"""

from datetime import datetime, timezone
from .database_utils import get_supabase_client, fetch_one
from .audit_trail import log_action, AuditAction


# ── 상수 ──────────────────────────────────────────────────────────────────────
V_STATUS_NORMAL  = 1   # 정상
V_STATUS_OUTLIER = 2   # 이상치 (소명 대기)


# ── 메인 함수 ──────────────────────────────────────────────────────────────────

def update_outlier_justification(
    std_id: int,
    user_feedback: str,
    action_taken: str,
    created_by: str,
    justification_type: str = "user_input",
    outlier_id: int = None,
) -> dict:
    """
    사용자가 제출한 소명 정보를 DB에 저장하고 이상치 상태를 갱신합니다.

    Parameters
    ----------
    std_id : int
        소명 대상 standard_usage 레코드의 id
    user_feedback : str
        사용자가 작성한 소명 내용 (자유 서술)
    action_taken : str
        취한 조치 내용. '정상'이면 v_status를 1(Normal)로 전환합니다.
    created_by : str
        소명을 제출한 사용자 ID
    justification_type : str, optional
        소명 유형 (예: 'user_input', 'system_auto'). 기본값 'user_input'
    outlier_id : int, optional
        연관된 outlier_results.id. None이면 std_id로 자동 조회합니다.

    Returns
    -------
    dict
        {
            "status": "success" | "error",
            "std_id": int,
            "justification_id": int,       # 생성된 justification_logs.id
            "v_status_changed": bool,       # v_status 변경 여부
            "new_v_status": int,            # 변경 후 v_status 값
            "message": str
        }

    Raises
    ------
    ValueError
        std_id에 해당하는 standard_usage 레코드가 없을 때
    """
    client = get_supabase_client()
    now = datetime.now(timezone.utc).isoformat()

    # ── Step 1: 현재 standard_usage 레코드 확인 ─────────────────────────────
    std_record = fetch_one("standard_usage", std_id)
    if not std_record:
        raise ValueError(f"standard_usage에서 id={std_id} 레코드를 찾을 수 없습니다.")

    before_status = std_record["v_status"]
    current_value = float(std_record["value"])

    # ── Step 2: outlier_id 자동 조회 (미제공 시) ────────────────────────────
    if outlier_id is None:
        outlier_query = (
            client.table("outlier_results")
            .select("id")
            .eq("std_id", std_id)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        if outlier_query.data:
            outlier_id = outlier_query.data[0]["id"]

    # ── Step 3: justification_logs 레코드 생성 ──────────────────────────────
    justification_record = {
        "std_id": std_id,
        "outlier_id": outlier_id,
        "justification_type": justification_type,
        "user_feedback": user_feedback,
        "action_taken": action_taken,
        "created_by": created_by,
        "created_at": now,
        "resolved_at": now if action_taken == "정상" else None,
    }

    try:
        j_result = client.table("justification_logs").insert(justification_record).execute()
        justification_id = j_result.data[0]["id"]
    except Exception as e:
        return {
            "status": "error",
            "std_id": std_id,
            "justification_id": None,
            "v_status_changed": False,
            "new_v_status": before_status,
            "message": f"justification_logs 저장 실패: {e}",
        }

    # ── Step 4: v_status 전이 및 outlier_results.is_resolved 업데이트 ───────
    v_status_changed = False
    new_v_status = before_status

    if action_taken == "정상":
        new_v_status = V_STATUS_NORMAL
        v_status_changed = True

        try:
            # standard_usage v_status 업데이트
            client.table("standard_usage").update({"v_status": new_v_status}).eq("id", std_id).execute()

            # outlier_results 소명 완료 플래그
            if outlier_id:
                client.table("outlier_results").update({"is_resolved": True}).eq("id", outlier_id).execute()

        except Exception as e:
            # 상태 전이 실패 → 부분 성공으로 기록
            return {
                "status": "partial_error",
                "std_id": std_id,
                "justification_id": justification_id,
                "v_status_changed": False,
                "new_v_status": before_status,
                "message": f"justification_logs 저장 성공, v_status 업데이트 실패: {e}",
            }

    # ── Step 5: audit_trail 기록 ────────────────────────────────────────────
    log_action(
        std_id=std_id,
        action=AuditAction.JUSTIFY,
        performed_by=created_by,
        reason=f"[소명] {action_taken} | {user_feedback}",
        before_value=current_value,
        after_value=current_value,
        before_status=before_status,
        after_status=new_v_status,
    )

    return {
        "status": "success",
        "std_id": std_id,
        "justification_id": justification_id,
        "v_status_changed": v_status_changed,
        "new_v_status": new_v_status,
        "message": (
            f"소명 저장 완료. v_status: {before_status} → {new_v_status}"
            if v_status_changed
            else f"소명 저장 완료. v_status 유지 ({before_status})"
        ),
    }


# ── 조회 함수 ──────────────────────────────────────────────────────────────────

def get_outlier_detail(std_id: int) -> dict:
    """
    특정 standard_usage 레코드의 이상치 상세 정보를 통합 반환합니다.

    Parameters
    ----------
    std_id : int
        조회할 standard_usage 레코드의 id

    Returns
    -------
    dict
        {
            "standard_usage": {...},        # 실적 데이터
            "outlier_results": [...],       # 이상치 탐지 결과 목록
            "justification_logs": [...],    # 소명 이력 목록
        }

    Raises
    ------
    ValueError
        std_id에 해당하는 standard_usage 레코드가 없을 때
    """
    client = get_supabase_client()

    std_record = fetch_one("standard_usage", std_id)
    if not std_record:
        raise ValueError(f"standard_usage에서 id={std_id} 레코드를 찾을 수 없습니다.")

    outlier_results = (
        client.table("outlier_results")
        .select("*")
        .eq("std_id", std_id)
        .order("id", desc=True)
        .execute()
        .data
    )

    justification_logs = (
        client.table("justification_logs")
        .select("*")
        .eq("std_id", std_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    return {
        "standard_usage": std_record,
        "outlier_results": outlier_results,
        "justification_logs": justification_logs,
    }


# ── 연결 검증 (직접 실행 시) ───────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔍 outlier_management 동작 검증 중...")
    try:
        client = get_supabase_client()

        # 이상치(v_status=2) 데이터 1건 조회
        targets = (
            client.table("standard_usage")
            .select("id, site_id, metric_name, value, v_status")
            .eq("v_status", 2)
            .limit(1)
            .execute()
            .data
        )

        if not targets:
            print("💡 현재 v_status=2(이상치) 데이터가 없습니다. 검증을 건너뜁니다.")
        else:
            sample = targets[0]
            print(f"📌 소명 대상 샘플: {sample}")

            result = update_outlier_justification(
                std_id=sample["id"],
                user_feedback="설비 정기 점검으로 인한 일시적 증가입니다.",
                action_taken="정상",
                created_by="test_user",
            )
            print(f"✅ 결과: {result}")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
