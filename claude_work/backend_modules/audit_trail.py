"""
audit_trail.py
--------------
감사 추적(Audit Trail) 전용 모듈.

모든 데이터 변경 이력을 audit_trail 테이블에 기록하고 조회합니다.
outlier_management.py, data_finalization.py 등 다른 모듈에서 이 모듈을
import하여 감사 기록 로직을 중앙화합니다.

주요 함수
---------
- log_action()         : audit_trail에 단일 이벤트 기록 (모든 모듈 공통 사용)
- get_audit_history()  : 특정 std_id의 변경 이력 전체 조회
- get_audit_logs()     : 전체 감사 로그 조회 (필터링 + 페이징)
- get_action_summary() : 사업장/기간별 액션 유형 집계

액션 코드 정의
--------------
UPLOAD   : 최초 데이터 적재 (1_upload_data)
DETECT   : 이상치 탐지 (3_outlier_detect)
AI_DIAG  : AI 진단 완료 (4_outlier_llm)
VERIFY   : 증빙 검증 완료 (6_standard_evidence_check)
JUSTIFY  : 사용자 소명 제출 (outlier_management)
FINALIZE : 수치 보정 및 최종 확정 (data_finalization)
REVERT   : 확정 취소 (data_finalization)
"""

from datetime import datetime, timezone
from .database_utils import get_supabase_client


# ── 액션 코드 상수 ────────────────────────────────────────────────────────────
class AuditAction:
    UPLOAD   = "UPLOAD"    # 최초 데이터 적재
    DETECT   = "DETECT"    # 이상치 탐지
    AI_DIAG  = "AI_DIAG"   # AI 진단 완료
    VERIFY   = "VERIFY"    # 증빙 검증 완료
    JUSTIFY  = "JUSTIFY"   # 사용자 소명 제출
    FINALIZE = "FINALIZE"  # 수치 보정 및 최종 확정
    REVERT   = "REVERT"    # 확정 취소

    ALL = {UPLOAD, DETECT, AI_DIAG, VERIFY, JUSTIFY, FINALIZE, REVERT}


# ── 메인 기록 함수 ────────────────────────────────────────────────────────────

def log_action(
    std_id: int,
    action: str,
    performed_by: str,
    reason: str,
    before_value: float = None,
    after_value: float = None,
    before_status: int = None,
    after_status: int = None,
) -> dict:
    """
    audit_trail 테이블에 단일 이벤트를 기록합니다.

    이 함수는 다른 모든 모듈에서 감사 기록이 필요할 때 호출합니다.
    audit_trail 테이블이 아직 없으면(마이그레이션 전) 경고를 출력하고
    graceful하게 실패합니다 (앱 크래시 없음).

    Parameters
    ----------
    std_id : int
        변경 대상 standard_usage 레코드의 id
    action : str
        액션 코드 (AuditAction 상수 사용 권장)
    performed_by : str
        작업을 수행한 사용자 ID 또는 시스템 식별자
    reason : str
        변경 사유 (자유 서술)
    before_value : float, optional
        변경 전 수치 (수치 변경이 없는 이벤트는 None)
    after_value : float, optional
        변경 후 수치
    before_status : int, optional
        변경 전 v_status
    after_status : int, optional
        변경 후 v_status

    Returns
    -------
    dict
        {
            "status": "success" | "skipped" | "error",
            "trail_id": int | None,   # 생성된 레코드 id
            "message": str
        }
    """
    client = get_supabase_client()
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "std_id":        std_id,
        "action":        action,
        "before_value":  float(before_value)  if before_value  is not None else None,
        "after_value":   float(after_value)   if after_value   is not None else None,
        "before_status": int(before_status)   if before_status is not None else None,
        "after_status":  int(after_status)    if after_status  is not None else None,
        "reason":        reason,
        "performed_by":  performed_by,
        "performed_at":  now,
    }

    try:
        result = client.table("audit_trail").insert(record).execute()
        trail_id = result.data[0].get("trail_id") if result.data else None
        return {
            "status":   "success",
            "trail_id": trail_id,
            "message":  f"audit_trail 기록 완료 (action={action}, std_id={std_id})",
        }
    except Exception as e:
        err_msg = str(e)
        # 테이블 미존재(마이그레이션 전) 경고 처리
        if "PGRST205" in err_msg or "audit_trail" in err_msg:
            print(f"⚠️  audit_trail 테이블 없음 (마이그레이션 후 활성화): std_id={std_id}, action={action}")
            return {
                "status":   "skipped",
                "trail_id": None,
                "message":  "audit_trail 테이블 미존재 — 마이그레이션 후 자동 활성화됩니다.",
            }
        return {
            "status":   "error",
            "trail_id": None,
            "message":  f"audit_trail 기록 실패: {e}",
        }


# ── 조회 함수 ─────────────────────────────────────────────────────────────────

def get_audit_history(std_id: int) -> list[dict]:
    """
    특정 std_id의 전체 변경 이력을 최신순으로 반환합니다.

    Parameters
    ----------
    std_id : int
        조회할 standard_usage 레코드의 id

    Returns
    -------
    list[dict]
        audit_trail 레코드 목록 (최신순), 테이블 없으면 빈 리스트
    """
    client = get_supabase_client()
    try:
        result = (
            client.table("audit_trail")
            .select("*")
            .eq("std_id", std_id)
            .order("performed_at", desc=True)
            .execute()
        )
        return result.data
    except Exception as e:
        if "PGRST205" in str(e):
            return []
        raise


def get_audit_logs(
    site_id: str = None,
    action: str = None,
    performed_by: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = 100,
) -> list[dict]:
    """
    전체 감사 로그를 필터 조건에 맞춰 조회합니다.

    Parameters
    ----------
    site_id : str, optional
        사업장 필터 (standard_usage와 조인하여 필터링)
    action : str, optional
        액션 코드 필터 (예: AuditAction.FINALIZE)
    performed_by : str, optional
        수행자 ID 필터
    start_date : str, optional
        조회 시작일 (ISO: 'YYYY-MM-DD')
    end_date : str, optional
        조회 종료일 (ISO: 'YYYY-MM-DD')
    limit : int, optional
        최대 반환 건수. 기본값 100

    Returns
    -------
    list[dict]
        audit_trail 레코드 목록 (최신순)
    """
    client = get_supabase_client()

    try:
        query = (
            client.table("audit_trail")
            .select("*")
            .order("performed_at", desc=True)
            .limit(limit)
        )

        if action:
            query = query.eq("action", action)
        if performed_by:
            query = query.eq("performed_by", performed_by)
        if start_date:
            query = query.gte("performed_at", start_date)
        if end_date:
            query = query.lte("performed_at", end_date + "T23:59:59Z")

        logs = query.execute().data

        # site_id 필터: audit_trail에 site_id가 없으므로 std_id → standard_usage 매칭
        if site_id and logs:
            std_ids_in_site = _get_std_ids_for_site(client, site_id)
            logs = [l for l in logs if l["std_id"] in std_ids_in_site]

        return logs

    except Exception as e:
        if "PGRST205" in str(e):
            return []
        raise


def get_action_summary(
    site_id: str = None,
    start_date: str = None,
    end_date: str = None,
) -> list[dict]:
    """
    액션 유형별 발생 건수를 집계합니다 (모니터링/차트용).

    Parameters
    ----------
    site_id : str, optional
        특정 사업장만 집계
    start_date : str, optional
        집계 시작일
    end_date : str, optional
        집계 종료일

    Returns
    -------
    list[dict]
        [{"action": str, "action_label": str, "count": int}, ...]
    """
    logs = get_audit_logs(
        site_id=site_id,
        start_date=start_date,
        end_date=end_date,
        limit=10000,
    )

    counts: dict[str, int] = {}
    for log in logs:
        act = log.get("action", "UNKNOWN")
        counts[act] = counts.get(act, 0) + 1

    action_labels = {
        AuditAction.UPLOAD:   "데이터 적재",
        AuditAction.DETECT:   "이상치 탐지",
        AuditAction.AI_DIAG:  "AI 진단",
        AuditAction.VERIFY:   "증빙 검증",
        AuditAction.JUSTIFY:  "소명 제출",
        AuditAction.FINALIZE: "수치 확정",
        AuditAction.REVERT:   "확정 취소",
    }

    return [
        {
            "action":       act,
            "action_label": action_labels.get(act, act),
            "count":        cnt,
        }
        for act, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _get_std_ids_for_site(client, site_id: str) -> set[int]:
    """site_id에 속하는 standard_usage id 집합 반환"""
    result = (
        client.table("standard_usage")
        .select("id")
        .eq("site_id", site_id)
        .execute()
    )
    return {r["id"] for r in result.data}


# ── 연결 검증 (직접 실행 시) ──────────────────────────────────────────────────

if __name__ == "__main__":
    print("🔍 audit_trail 동작 검증 중...\n")
    try:
        # 1. 테스트 로그 기록 시도
        print("📝 [1] 테스트 감사 로그 기록 시도:")
        result = log_action(
            std_id=1,
            action=AuditAction.DETECT,
            performed_by="system",
            reason="테스트 감사 기록",
            before_status=0,
            after_status=2,
        )
        print(f"   결과: {result['status']} | {result['message']}")

        # 2. 이력 조회
        print("\n📋 [2] std_id=1 감사 이력:")
        history = get_audit_history(std_id=1)
        if history:
            for h in history:
                print(f"   [{h.get('performed_at','?')[:19]}] {h['action']} | {h['performed_by']} | {h['reason']}")
        else:
            print("   (이력 없음 — audit_trail 테이블 미존재 또는 데이터 없음)")

        # 3. 액션 집계
        print("\n📊 [3] 전체 액션 집계:")
        summary = get_action_summary()
        if summary:
            for s in summary:
                print(f"   {s['action_label']:10s} ({s['action']:8s}): {s['count']}건")
        else:
            print("   (집계 없음 — audit_trail 테이블 미존재)")

        print("\n✅ 검증 완료! (테이블 미존재 시 마이그레이션 후 자동 활성화)")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
