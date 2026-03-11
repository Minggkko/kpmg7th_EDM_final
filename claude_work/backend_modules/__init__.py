# backend_modules package
from .database_utils import get_supabase_client
from .audit_trail import log_action, get_audit_history, get_audit_logs, get_action_summary, AuditAction
from .outlier_detection import detect_outliers
from .outlier_llm import analyze_outlier_with_llm
from .evidence_extraction import extract_pending_ocr_data
from .evidence_verification import verify_evidence_data
from .outlier_management import update_outlier_justification, get_outlier_detail
from .data_finalization import finalize_usage_data, revert_finalization, get_finalization_history
from .verification_dashboard import get_verification_dashboard, get_status_summary, get_outlier_pending_list

__all__ = [
    "get_supabase_client",
    "log_action",
    "get_audit_history",
    "get_audit_logs",
    "get_action_summary",
    "AuditAction",
    "detect_outliers",
    "analyze_outlier_with_llm",
    "extract_pending_ocr_data",
    "verify_evidence_data",
    "update_outlier_justification",
    "get_outlier_detail",
    "finalize_usage_data",
    "revert_finalization",
    "get_finalization_history",
    "get_verification_dashboard",
    "get_status_summary",
    "get_outlier_pending_list",
]
