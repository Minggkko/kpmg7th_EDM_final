"""
restore_vstatus5.py
--------------------
audit_trail의 FINALIZE 액션 기록을 이용하여
mapping 재실행으로 v_status=1로 리셋된 레코드를 v_status=5로 복원합니다.

실행: python -m scripts.restore_vstatus5
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.outlier_pipeline.database_utils import get_supabase_client

def restore():
    client = get_supabase_client()

    # 1. audit_trail에서 FINALIZE 액션이 있고 after_status=5인 std_id 목록 조회
    finalize_logs = (
        client.table("audit_trail")
        .select("std_id, after_status")
        .eq("action", "FINALIZE")
        .eq("after_status", 5)
        .execute()
        .data
    )

    if not finalize_logs:
        print("[OK] FINALIZE 기록이 없습니다. 복원할 레코드 없음.")
        return

    finalized_std_ids = {row["std_id"] for row in finalize_logs}
    print(f"[INFO] FINALIZE 기록된 std_id: {len(finalized_std_ids)}개")

    # 2. 현재 v_status=1이지만 FINALIZE 기록이 있는 레코드 조회 (손상된 레코드)
    damaged = (
        client.table("standardized_data")
        .select("id, site_id, reporting_date, metric_name, v_status")
        .in_("id", list(finalized_std_ids))
        .eq("v_status", 1)
        .execute()
        .data
    )

    if not damaged:
        print("[OK] 복원이 필요한 레코드가 없습니다 (v_status=1인 FINALIZE 기록 없음).")
        return

    print(f"\n[WARN] 복원 대상: {len(damaged)}개 레코드")
    for r in damaged[:5]:
        print(f"   id={r['id']} | {r['site_id']} | {r['reporting_date']} | {r['metric_name']}")
    if len(damaged) > 5:
        print(f"   ... 외 {len(damaged)-5}개")

    # 3. v_status=5로 복원
    damaged_ids = [r["id"] for r in damaged]
    result = (
        client.table("standardized_data")
        .update({"v_status": 5, "updated_by": "system:restore_vstatus5"})
        .in_("id", damaged_ids)
        .execute()
    )

    print(f"\n[OK] 복원 완료: {len(result.data)}개 레코드를 v_status=5로 복원했습니다.")

    # 4. audit_trail에 REVERT 대신 복원 기록 (별도 액션 없으므로 FINALIZE 재기록)
    from app.services.outlier_pipeline.audit_trail import AuditAction, log_action
    for r in damaged:
        log_action(
            std_id=r["id"],
            action=AuditAction.FINALIZE,
            performed_by="system:restore_vstatus5",
            reason="mapping 재실행으로 손상된 v_status 복원 (1→5)",
            before_status=1,
            after_status=5,
        )
    print(f"[LOG] audit_trail 복원 기록 완료: {len(damaged)}건")


if __name__ == "__main__":
    restore()
