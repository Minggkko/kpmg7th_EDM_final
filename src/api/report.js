// src/api/report.js
import { apiFetch } from "./index";

// 보고서 생성 (Supabase DB + GPT)
// 소요 시간: 항목 수 × 2~3초
export async function generateReport() {
  return apiFetch("/report/generate", { method: "POST" });
}

// 저장된 초안 불러오기
export async function loadDraft() {
  return apiFetch("/report/draft");
}

// 특정 필드 수정
export async function updateField(fieldId, fieldType, newValue) {
  return apiFetch("/report/draft/field", {
    method: "PATCH",
    body: JSON.stringify({
      field_id:   fieldId,
      field_type: fieldType,
      new_value:  newValue,
    }),
  });
}

// 보고서 파일 내보내기 (blob 반환)
export async function exportReport(format = "docx") {
  const res = await fetch("/api/v1/report/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access_token")}`,
    },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) throw await res.json();
  return res.blob();
}