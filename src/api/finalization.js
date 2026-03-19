// src/api/finalization.js
import { apiFetch } from "./index";

// 최종 확정 (수치 보정 포함)
// 수치 변경 없이 확정만 하려면 현재 value를 correctedValue로 전달
export async function finalizeData(stdId, { correctedValue, reason }) {
  return apiFetch(`/finalization/${stdId}`, {
    method: "POST",
    body: JSON.stringify({ corrected_value: correctedValue, reason }),
  });
}

// 확정 취소 (원복)
export async function revertFinalization(stdId, reason) {
  return apiFetch(`/finalization/${stdId}/revert`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// 보정 이력 조회
export async function getFinalizationHistory(stdId) {
  return apiFetch(`/finalization/${stdId}/history`);
}