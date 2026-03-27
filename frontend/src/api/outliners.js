// src/api/outliers.js
import { apiFetch } from "./index";

// 이상치 탐지 실행
export async function detectOutliers({ siteId, metricName } = {}) {
  const params = new URLSearchParams();
  if (siteId) params.append("site_id", siteId);
  if (metricName) params.append("metric_name", metricName);
  return apiFetch(`/outliers/detect?${params.toString()}`, { method: "POST" });
}

// AI 진단 실행
export async function analyzeOutliers(outlierId) {
  const params = outlierId ? `?outlier_id=${outlierId}` : "";
  return apiFetch(`/outliers/analyze${params}`, { method: "POST" });
}

// 이상치 상세 조회 (탐지 결과 + 소명 이력)
export async function getOutlierDetail(stdId) {
  return apiFetch(`/outliers/${stdId}`);
}

// 소명 제출
// action_taken: '정상' 입력 시 v_status 2→1 전환
export async function submitJustification(stdId, { userFeedback, actionTaken, justificationType = "user_input", outlierId }) {
  return apiFetch(`/outliers/${stdId}/justify`, {
    method: "POST",
    body: JSON.stringify({
      user_feedback: userFeedback,
      action_taken: actionTaken,
      justification_type: justificationType,
      outlier_id: outlierId,
    }),
  });
}

// 대시보드 — 검증 현황 전체
export async function getDashboard({ siteId, vStatus, metricName, limit = 200 } = {}) {
  const params = new URLSearchParams();
  if (siteId) params.append("site_id", siteId);
  if (vStatus !== undefined) params.append("v_status", vStatus);
  if (metricName) params.append("metric_name", metricName);
  params.append("limit", limit);
  return apiFetch(`/dashboard?${params.toString()}`);
}

// 소명 대기 이상치 목록 (v_status=2)
export async function getOutlierPending(siteId) {
  const params = siteId ? `?site_id=${siteId}` : "";
  return apiFetch(`/dashboard/outlier-pending${params}`);
}

// v_status 별 건수
export async function getStatusSummary(siteId) {
  const params = siteId ? `?site_id=${siteId}` : "";
  return apiFetch(`/dashboard/status-summary${params}`);
}