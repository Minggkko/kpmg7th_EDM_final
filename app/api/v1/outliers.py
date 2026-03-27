# app/api/v1/outliers.py
# EDM 파이프라인 STEP 1·2·3 — 이상치 탐지 / AI 진단 / 소명 처리

import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies import get_current_user
from app.services.outlier_pipeline.outlier_detection import detect_outliers
from app.services.outlier_pipeline.outlier_llm import analyze_outlier_with_llm
from app.services.outlier_pipeline.outlier_management import update_outlier_justification, get_outlier_detail
from app.services.email_service import send_confirmation_request
from app.services.outlier_pipeline.database_utils import get_supabase_client

router = APIRouter()


# ── Request 스키마 ─────────────────────────────────────────────────────────────

class JustifyRequest(BaseModel):
    user_feedback: str
    action_taken: str
    justification_type: str = "user_input"
    outlier_id: Optional[int] = None


class ConfirmRequestBody(BaseModel):
    """확인 요청 (이메일 발송 + justification_logs 기록)"""
    assignee_email: str
    due_date: str           # YYYY-MM-DD
    message: str
    outlier_id: Optional[int] = None
    # 이메일 본문용 메타 (프론트에서 전달)
    dp_name:         Optional[str]   = None
    site:            Optional[str]   = None
    reporting_date:  Optional[str]   = None
    value:           Optional[float] = None
    unit:            Optional[str]   = None
    v_status:        Optional[int]   = None
    ai_diagnosis:    Optional[str]   = None
    ocr_value:       Optional[float] = None


# ── STEP 1: 이상치 탐지 실행 ──────────────────────────────────────────────────

@router.post("/detect")
async def run_outlier_detection(
    site_id: Optional[str] = None,
    metric_name: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    """
    v_status=0(Pending) 레코드에 대해 L1/L2/L3 이상치 탐지를 실행합니다.
    - site_id, metric_name 미입력 시 전체 대상 처리
    """
    try:
        result = detect_outliers(site_id=site_id, metric_name=metric_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── STEP 2: AI 진단 실행 ──────────────────────────────────────────────────────

@router.post("/analyze")
async def run_llm_analysis(
    outlier_id: Optional[int] = None,
    current_user=Depends(get_current_user),
):
    """
    analysis_summary가 NULL인 outlier_results에 GPT-4o 진단 보고서를 생성합니다.
    - outlier_id 미입력 시 미처리 전건 처리
    """
    try:
        result = analyze_outlier_with_llm(outlier_id=outlier_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── STEP 3: 소명 제출 ─────────────────────────────────────────────────────────

@router.post("/{std_id}/justify")
async def submit_justification(
    std_id: int,
    body: JustifyRequest,
    current_user=Depends(get_current_user),
):
    """
    이상치(v_status=2)에 대해 소명을 제출합니다.
    - action_taken='정상' 입력 시 v_status 2→1로 전환
    """
    try:
        result = update_outlier_justification(
            std_id=std_id,
            user_feedback=body.user_feedback,
            action_taken=body.action_taken,
            created_by=current_user.id,
            justification_type=body.justification_type,
            outlier_id=body.outlier_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 확인 요청 (이메일 발송) ───────────────────────────────────────────────────

@router.post("/{std_id}/confirm-request")
async def send_confirm_request(
    std_id: int,
    body: ConfirmRequestBody,
    current_user=Depends(get_current_user),
):
    """
    이상치 확인 요청을 담당자에게 이메일로 전송하고 justification_logs에 기록합니다.

    v_status=2 (증빙불일치) 또는 v_status=4 (이상치+증빙불일치) 항목에 사용됩니다.
    이메일 전송은 SMTP 설정이 있을 때만 실행되며, 미설정 시 DB 기록만 남깁니다.
    """
    try:
        # justification_logs에 확인요청 기록
        feedback_data = json.dumps({
            "assignee_email": body.assignee_email,
            "due_date":       body.due_date,
            "message":        body.message,
        }, ensure_ascii=False)

        result = update_outlier_justification(
            std_id=std_id,
            user_feedback=feedback_data,
            action_taken="확인요청",
            created_by=current_user.id,
            justification_type="확인요청",
            outlier_id=body.outlier_id,
        )

        # 이메일 발송 시도 (SMTP 미설정 시 소프트 페일)
        email_sent = send_confirmation_request(
            to_email=body.assignee_email,
            dp_name=body.dp_name or "",
            site=body.site or "",
            reporting_date=body.reporting_date or "",
            value=body.value or 0.0,
            unit=body.unit or "",
            v_status=body.v_status or 2,
            due_date=body.due_date,
            message=body.message,
            ai_diagnosis=body.ai_diagnosis,
            ocr_value=body.ocr_value,
        )

        return {
            **result,
            "email_sent": email_sent,
            "assignee_email": body.assignee_email,
            "message": result.get("message", "") + (
                f" | 이메일 발송 완료 → {body.assignee_email}" if email_sent
                else " | 이메일 미발송 (SMTP 미설정 또는 오류)"
            ),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── v_status=4 일괄 현행 확정 ─────────────────────────────────────────────────

@router.post("/auto-finalize-v4")
async def auto_finalize_v4(
    current_user=Depends(get_current_user),
):
    """
    v_status=4 (이상치 있음 + 증빙 불일치) 레코드를 일괄 현행 확정 처리합니다.
    각 레코드에 대해 update_outlier_justification(action_taken='정상')을 호출하여
    v_status를 5(최종 확정)로 전환합니다.
    """
    client = get_supabase_client()
    try:
        records = (
            client.table("standardized_data")
            .select("id")
            .eq("v_status", 4)
            .execute()
            .data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"v_status=4 조회 실패: {e}")

    results = []
    for rec in records:
        try:
            result = update_outlier_justification(
                std_id=rec["id"],
                user_feedback="자동 현행 확정 처리 (v_status=4 일괄)",
                action_taken="정상",
                created_by=current_user.id,
                justification_type="auto_finalize",
            )
            results.append({"std_id": rec["id"], "status": result["status"]})
        except Exception as e:
            results.append({"std_id": rec["id"], "status": "error", "message": str(e)})

    success = sum(1 for r in results if r["status"] == "success")
    return {
        "total": len(records),
        "success": success,
        "failed": len(records) - success,
        "results": results,
    }


# ── 이상치 상세 조회 ──────────────────────────────────────────────────────────

@router.get("/{std_id}")
async def get_outlier_info(
    std_id: int,
    current_user=Depends(get_current_user),
):
    """
    특정 표준화 데이터의 이상치 탐지 결과 + 소명 이력을 반환합니다.
    """
    try:
        result = get_outlier_detail(std_id=std_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
