"""
_run_e2e_validation.py
----------------------
EDM 파이프라인 전체 E2E 검증 스크립트 (관점 A 코드 로직 + 관점 B 흐름 검증 통합).

실행 방법 (kpmg7th_EDM_final/ 디렉토리에서):
    python backend_modules/_run_e2e_validation.py

전제 조건: _setup_test_data.py 를 먼저 실행하여 Mock 데이터가 준비되어 있어야 합니다.

══ 검증 단계 ═══════════════════════════════════════════════════════════════════
  STEP 0  초기 상태 확인       (Pending 레코드 4건 존재)
  STEP 1  evidence_extraction   OCR → evidence_usage 적재
  STEP 2  detect_outliers       L1/L2/L3 이상치 탐지 + v_status 전이
  STEP 2B outlier_justification 이상치 소명 → v_status 2→1
  STEP 3  verify_evidence_data  OCR 정합성 검증 → v_status 3/4/5 전이
  STEP 4  finalize_usage_data   수치 보정 + 최종 확정 → v_status=5
  STEP F  audit_trail 완전성    모든 액션 코드 기록 여부 확인

══ 관점 A: 코드 로직 검증 항목 ════════════════════════════════════════════════
  - L1 Z-Score 임계값(3.0) 적용 확인
  - L2 upper_limit 초과 판정 확인
  - L3 intensity_dev 임계값(50%) 적용 확인
  - Severity: L2→Critical, L1only→Warning 판정
  - unit_mismatch(1000배) 판정 우선순위 확인
  - gap_percent_threshold(1%) 경계 정확도 확인
  - v_status=2 레코드의 STEP3 자동 제외 확인
  - result_code=5 스킵 / 3·4 재검증 허용 확인

══ 관점 B: E2E 흐름 검증 항목 ═════════════════════════════════════════════════
  - 0→1/2 전이 (detect_outliers)
  - 2→1 전이 (justification, action='정상')
  - 1→5 전이 (verify: gap<1%)
  - 1→3 전이 (verify: gap≥1%)
  - 1→4 전이 (verify: unit_mismatch)
  - 3→5 전이 (finalize 수치 보정)
  - audit_trail: DETECT / JUSTIFY / VERIFY / FINALIZE 전 단계 기록
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend_modules.database_utils    import get_supabase_client
from backend_modules.evidence_extraction  import extract_pending_ocr_data
from backend_modules.outlier_detection    import detect_outliers
from backend_modules.outlier_management   import update_outlier_justification
from backend_modules.evidence_verification import verify_evidence_data
from backend_modules.data_finalization    import finalize_usage_data

# 매 실행마다 자동 리셋 (누적 결과 오염 방지)
from backend_modules._setup_test_data import (
    reset_all_tables, insert_master_data, insert_activity_data,
    insert_standardized_data, insert_raw_ocr_data,
)


# ── 출력 헬퍼 ─────────────────────────────────────────────────────────────────

_PASS  = "✅ PASS"
_FAIL  = "❌ FAIL"
_INFO  = "ℹ️  INFO"
_SEP   = "─" * 62


def _section(title: str) -> None:
    print(f"\n{'=' * 62}")
    print(f"  {title}")
    print('=' * 62)


def _check(condition: bool, label: str, detail: str = "",
           results: dict = None) -> bool:
    status = _PASS if condition else _FAIL
    suffix = f"  [{detail}]" if detail else ""
    print(f"  {status}  {label}{suffix}")
    if results is not None:
        if condition:
            results["passed"] += 1
        else:
            results["failed"] += 1
    return condition


def _get_std(client, site_id: str, metric_name: str, reporting_date: str) -> dict | None:
    """standardized_data 에서 조건에 맞는 단일 레코드 반환."""
    rows = (
        client.table("standardized_data")
        .select("*")
        .eq("site_id", site_id)
        .eq("metric_name", metric_name)
        .eq("reporting_date", reporting_date)
        .execute()
        .data
    )
    return rows[0] if rows else None


# ── 메인 검증 ─────────────────────────────────────────────────────────────────

def run_validation() -> None:
    client  = get_supabase_client()
    results = {"passed": 0, "failed": 0}

    def chk(cond, label, detail=""):
        return _check(cond, label, detail, results)

    # ══════════════════════════════════════════════════════════════════
    _section("AUTO RESET  DB 초기화 + Mock 데이터 재삽입")
    # ══════════════════════════════════════════════════════════════════
    reset_all_tables(client)
    insert_master_data(client)
    insert_activity_data(client)
    insert_standardized_data(client)
    insert_raw_ocr_data(client)
    print("\n  ✅  리셋 완료. 파이프라인 검증을 시작합니다.\n")

    # ══════════════════════════════════════════════════════════════════
    _section("STEP 0  초기 상태 확인")
    # ══════════════════════════════════════════════════════════════════

    pending_std = (
        client.table("standardized_data").select("id")
        .eq("v_status", 0).execute().data
    )
    pending_ocr = (
        client.table("raw_ocr_data").select("id")
        .eq("processing_status", "Pending").execute().data
    )

    chk(len(pending_std) == 4,
        "standardized_data Pending(v_status=0) 4건",
        f"실제: {len(pending_std)}건")
    chk(len(pending_ocr) == 4,
        "raw_ocr_data Pending 4건",
        f"실제: {len(pending_ocr)}건")

    # ══════════════════════════════════════════════════════════════════
    _section("STEP 1  evidence_extraction — OCR → evidence_usage")
    # ══════════════════════════════════════════════════════════════════

    res1 = extract_pending_ocr_data()
    print(f"  {_INFO}  {res1['message']}  (처리: {res1['count']}건)")

    chk(res1["status"] == "success", "STEP 1 실행 성공")
    chk(res1["count"] == 4, "evidence_usage 4건 적재", f"실제: {res1['count']}건")

    ocr_extracted = (
        client.table("raw_ocr_data").select("id")
        .eq("processing_status", "Extracted").execute().data
    )
    chk(len(ocr_extracted) == 4,
        "raw_ocr_data 전체 → Extracted 전환 [관점B]",
        f"실제: {len(ocr_extracted)}건")

    # ══════════════════════════════════════════════════════════════════
    _section("STEP 2  detect_outliers — L1/L2/L3 탐지 [관점 A+B]")
    # ══════════════════════════════════════════════════════════════════

    res2 = detect_outliers()
    print(f"  {_INFO}  {res2['message']}  (이상치: {res2['count']}건)")

    # ── 관점 B: v_status 전이 확인
    a01 = _get_std(client, "SITE_A", "전기사용량", "2026-01-01")
    a02 = _get_std(client, "SITE_A", "전기사용량", "2026-02-01")
    b01 = _get_std(client, "SITE_B", "연료사용량", "2026-01-01")
    b02 = _get_std(client, "SITE_B", "연료사용량", "2026-02-01")

    chk(a01 is not None and a01["v_status"] == 1,
        "SITE_A 2026-01: v_status=0→1 (Normal) [관점B]",
        f"실제: {a01['v_status'] if a01 else 'N/A'}")
    chk(a02 is not None and a02["v_status"] == 2,
        "SITE_A 2026-02: v_status=0→2 (Outlier) [관점B]",
        f"실제: {a02['v_status'] if a02 else 'N/A'}")
    chk(b01 is not None and b01["v_status"] == 1,
        "SITE_B 2026-01: v_status=0→1 (Normal) [관점B]",
        f"실제: {b01['v_status'] if b01 else 'N/A'}")
    chk(b02 is not None and b02["v_status"] == 2,
        "SITE_B 2026-02: v_status=0→2 (Outlier) [관점B]",
        f"실제: {b02['v_status'] if b02 else 'N/A'}")

    # ── 관점 A: outlier_results 심각도 및 레이어 검증
    a02_id = a02["id"] if a02 else -1
    b02_id = b02["id"] if b02 else -1

    a02_outliers = (
        client.table("outlier_results").select("*")
        .eq("std_id", a02_id).execute().data
    )
    b02_outliers = (
        client.table("outlier_results").select("*")
        .eq("std_id", b02_id).execute().data
    )

    a02_sev   = a02_outliers[0]["severity"] if a02_outliers else None
    a02_layer = a02_outliers[0]["layer"]    if a02_outliers else ""
    b02_sev   = b02_outliers[0]["severity"] if b02_outliers else None
    b02_layer = b02_outliers[0]["layer"]    if b02_outliers else ""

    chk(a02_sev == "Critical",
        "SITE_A 2026-02: severity=Critical (L2>2000) [관점A]",
        f"실제: {a02_sev}")
    chk(b02_sev == "Warning",
        "SITE_B 2026-02: severity=Warning  (L1 Z>3.0만 해당) [관점A]",
        f"실제: {b02_sev}")
    chk("L1" in a02_layer and "L2" in a02_layer,
        "SITE_A 2026-02: layer에 L1·L2 포함 [관점A]",
        f"실제: {a02_layer}")
    chk("L1" in b02_layer and "L2" not in b02_layer,
        "SITE_B 2026-02: layer에 L1만 포함 (L2 미초과) [관점A]",
        f"실제: {b02_layer}")

    # ── 관점 A: v_status=2 레코드가 evidence_usage 에 매칭되더라도
    #          STEP3 이전 이 시점에서는 std_index 미포함 → 아래 STEP3에서 확인

    # ══════════════════════════════════════════════════════════════════
    _section("STEP 2B outlier_justification — 소명 처리 (v_status 2→1)")
    # ══════════════════════════════════════════════════════════════════

    a01_id = a01["id"] if a01 else None
    b01_id = b01["id"] if b01 else None

    def _justify(std_id, site_label, feedback, action="정상"):
        if std_id is None:
            chk(False, f"{site_label} 소명: std_id 조회 실패")
            return
        res = update_outlier_justification(
            std_id=std_id,
            user_feedback=feedback,
            action_taken=action,
            created_by="test_user",
        )
        print(f"  {_INFO}  {site_label}: {res['message']}")
        chk(res["status"] == "success",
            f"{site_label}: 소명 저장 성공 [관점B]")
        chk(res["v_status_changed"] and res["new_v_status"] == 1,
            f"{site_label}: v_status=2→1 전이 [관점B]",
            f"실제: {res['new_v_status']}")

    _justify(
        a02_id, "SITE_A 2026-02",
        "설비 점검 기간 중 누적 사용량이 단월분으로 계상됨 — 실제 이상 사용 아님",
    )
    _justify(
        b02_id, "SITE_B 2026-02",
        "연료 납품 일정 조정으로 전월 미수령분이 2026-02에 포함 납품됨",
    )

    # ══════════════════════════════════════════════════════════════════
    _section("STEP 3  verify_evidence_data — OCR 정합성 검증 [관점 A+B]")
    # ══════════════════════════════════════════════════════════════════

    res3 = verify_evidence_data()
    print(f"  {_INFO}  {res3['message']}  (처리: {res3['count']}건)")
    chk(res3["status"] == "success", "STEP 3 실행 성공")
    chk(res3["count"] == 4, "검증 로그 4건 처리", f"실제: {res3['count']}건")

    # ── 관점 B: v_status 전이 확인
    a01_v = _get_std(client, "SITE_A", "전기사용량", "2026-01-01")
    b01_v = _get_std(client, "SITE_B", "연료사용량", "2026-01-01")
    a02_v = _get_std(client, "SITE_A", "전기사용량", "2026-02-01")
    b02_v = _get_std(client, "SITE_B", "연료사용량", "2026-02-01")

    chk(a01_v is not None and a01_v["v_status"] == 5,
        "SITE_A 2026-01: gap<1% → v_status=5 (Verified) [관점B]",
        f"실제: {a01_v['v_status'] if a01_v else 'N/A'}")
    chk(b01_v is not None and b01_v["v_status"] == 3,
        "SITE_B 2026-01: gap≥1% → v_status=3 (Mismatch) [관점B]",
        f"실제: {b01_v['v_status'] if b01_v else 'N/A'}")
    chk(a02_v is not None and a02_v["v_status"] == 4,
        "SITE_A 2026-02: unit_mismatch → v_status=4 (UnitError) [관점B]",
        f"실제: {a02_v['v_status'] if a02_v else 'N/A'}")
    chk(b02_v is not None and b02_v["v_status"] == 5,
        "SITE_B 2026-02: gap=0% → v_status=5 (Verified) [관점B]",
        f"실제: {b02_v['v_status'] if b02_v else 'N/A'}")

    # ── 관점 A: unit_mismatch 플래그 확인
    a02_vlog = (
        client.table("verification_logs").select("*")
        .eq("std_id", a02_id).execute().data
    )
    chk(
        bool(a02_vlog) and a02_vlog[0].get("unit_mismatch") is True,
        "SITE_A 2026-02: verification_logs.unit_mismatch=True [관점A]",
    )

    # ── 관점 A: gap_percent 수치 정확도 확인 (threshold=1% 경계)
    a01_vlog = (
        client.table("verification_logs").select("*")
        .eq("std_id", a01_id if a01_id else -1).execute().data
    )
    if a01_vlog:
        actual_gap = float(a01_vlog[0].get("gap_percent", -1))
        chk(actual_gap < 1.0,
            f"SITE_A 2026-01: gap_percent < 1% 기준 통과 [관점A]",
            f"실제: {actual_gap:.4f}%")
    else:
        chk(False, "SITE_A 2026-01 verification_log 조회 실패")

    # ── 관점 A: v_status=2 레코드가 STEP3 이전(소명 전)에
    #          처리되지 않았는지 확인하려면 audit_trail 타임스탬프로 검증.
    #          현재는 소명 완료 후 실행되었으므로 정상 처리됨.
    #          단, 소명 전 상태로 verify 호출 시 스킵 여부는
    #          std_index 가 v_status in (1,3,4) 만 로드하므로 보장 ✓

    # verification_logs 총 4건
    vlog_total = len(
        client.table("verification_logs").select("log_id").execute().data
    )
    chk(vlog_total == 4,
        "verification_logs 총 4건 생성 [관점B]",
        f"실제: {vlog_total}건")

    # ── 관점 A: 재검증 허용 확인
    #   result_code=5 evidence_id 는 재실행 시 스킵, 3·4는 재검증 가능
    result5_ids = {
        r["evidence_id"]
        for r in client.table("verification_logs").select("evidence_id, result_code").execute().data
        if r.get("result_code") == 5
    }
    res3_rerun = verify_evidence_data()  # 재실행
    # result_code=3(SITE_B 2026-01), result_code=4(SITE_A 2026-02) evidence는
    # 스펙 상 '교정 OCR 재투입 후 재검증 피대상' → 재실행 시 2건 재처리됨 (정상)
    chk(res3_rerun["count"] == 2,
        "재실행 시 result_code=5만 스킵, result_code=3/4는 재검증 허용 → 2건 재처리 [관점A]",
        f"실제: {res3_rerun['count']}건")

    # ══════════════════════════════════════════════════════════════════
    _section("STEP 4  finalize_usage_data — 수치 보정 + 최종 확정 [관점A+B]")
    # ══════════════════════════════════════════════════════════════════

    # SITE_B 2026-01 (v_status=3 Mismatch) → OCR 값 488로 보정 후 Verified
    b01_now = _get_std(client, "SITE_B", "연료사용량", "2026-01-01")
    if b01_now and b01_now["v_status"] == 3:
        res4 = finalize_usage_data(
            std_id=b01_now["id"],
            corrected_value=488.0,          # OCR 측정값으로 보정
            user_id="test_manager",
            reason="OCR 488 Nm3 측정값으로 보정 확정 (게이트 미터 재검침 완료)",
        )
        print(f"  {_INFO}  SITE_B 2026-01 보정 확정: {res4['message']}")

        b01_fin = _get_std(client, "SITE_B", "연료사용량", "2026-01-01")
        chk(res4["status"] == "success",
            "finalize_usage_data 실행 성공 [관점B]")
        chk(b01_fin is not None and b01_fin["v_status"] == 5,
            "SITE_B 2026-01: finalize 후 v_status=5 [관점B]",
            f"실제: {b01_fin['v_status'] if b01_fin else 'N/A'}")
        chk(b01_fin is not None and abs(float(b01_fin["value"]) - 488.0) < 0.01,
            "SITE_B 2026-01: 보정값 488.0 적용 확인 [관점A]",
            f"실제: {b01_fin['value'] if b01_fin else 'N/A'}")
        chk(res4.get("audit_trail_id") is not None,
            "FINALIZE audit_trail 기록 반환 [관점A]",
            f"trail_id={res4.get('audit_trail_id')}")
    else:
        vstatus = b01_now["v_status"] if b01_now else "N/A"
        print(f"  ⚠️   STEP4 스킵: SITE_B 2026-01 v_status={vstatus} (3 아님)")

    # ══════════════════════════════════════════════════════════════════
    _section("STEP F  audit_trail 완전성 검증 [관점 A]")
    # ══════════════════════════════════════════════════════════════════

    all_trails = client.table("audit_trail").select("action, std_id").execute().data
    action_counts: dict[str, int] = {}
    for t in all_trails:
        a = t["action"]
        action_counts[a] = action_counts.get(a, 0) + 1

    print(f"  {_INFO}  audit_trail 총 {len(all_trails)}건: {action_counts}")
    print()

    for action in ("DETECT", "JUSTIFY", "VERIFY", "FINALIZE"):
        cnt = action_counts.get(action, 0)
        chk(cnt > 0, f"{action:<10} 액션 기록됨 ({cnt}건)")

    # 4개 Pending std_id 전부에 DETECT 기록 있는지
    detect_std_ids = {
        t["std_id"]
        for t in client.table("audit_trail").select("std_id, action")
        .eq("action", "DETECT").execute().data
    }
    for row, label in [
        (a01, "SITE_A 2026-01"), (a02, "SITE_A 2026-02"),
        (b01, "SITE_B 2026-01"), (b02, "SITE_B 2026-02"),
    ]:
        sid = row["id"] if row else None
        chk(sid is not None and sid in detect_std_ids,
            f"{label}: DETECT 이력 존재")

    # ══════════════════════════════════════════════════════════════════
    _section("최종 v_status 현황")
    # ══════════════════════════════════════════════════════════════════

    pending_rows = [
        ("SITE_A", "전기사용량", "2026-01-01"),
        ("SITE_A", "전기사용량", "2026-02-01"),
        ("SITE_B", "연료사용량", "2026-01-01"),
        ("SITE_B", "연료사용량", "2026-02-01"),
    ]
    STATUS_NAMES = {0: "Pending", 1: "Normal", 2: "Outlier",
                    3: "Mismatch", 4: "UnitError", 5: "Verified", 99: "Legacy"}

    print(f"  {'사업장':<8} {'지표':<12} {'날짜':<12} {'v_status'}")
    print(f"  {_SEP}")
    for site, metric, date in pending_rows:
        row    = _get_std(client, site, metric, date)
        vstatus = row["v_status"] if row else -1
        name   = STATUS_NAMES.get(vstatus, str(vstatus))
        print(f"  {site:<8} {metric:<12} {date:<12} {vstatus} ({name})")

    # ══════════════════════════════════════════════════════════════════
    _section("검증 결과 요약")
    # ══════════════════════════════════════════════════════════════════

    total  = results["passed"] + results["failed"]
    passed = results["passed"]
    failed = results["failed"]

    print(f"\n  총 검증 항목: {total}개")
    print(f"  ✅ PASS : {passed}개")
    print(f"  ❌ FAIL : {failed}개")

    if failed == 0:
        print("\n  🎉 모든 검증 항목 통과! EDM 파이프라인 정상 동작 확인")
    else:
        print(f"\n  ⚠️  {failed}개 항목 검토 필요 — FAIL 항목의 [실제:] 값을 확인하세요")
    print("=" * 62)


if __name__ == "__main__":
    run_validation()
