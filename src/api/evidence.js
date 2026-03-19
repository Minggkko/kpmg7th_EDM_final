// src/api/evidence.js
import { apiFetch } from "./index";

// 증빙 파일 업로드 + OCR (multipart)
export async function uploadOCR(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/evidence/upload-ocr", {
    method: "POST",
    headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

// OCR 추출 (raw_ocr_data → evidence_usage)
export async function extractOCR(fileName) {
  const params = fileName ? `?file_name=${encodeURIComponent(fileName)}` : "";
  return apiFetch(`/evidence/extract${params}`, { method: "POST" });
}

// 정합성 검증 실행
export async function verifyEvidence({ siteId, metricName } = {}) {
  const params = new URLSearchParams();
  if (siteId) params.append("site_id", siteId);
  if (metricName) params.append("metric_name", metricName);
  return apiFetch(`/evidence/verify?${params.toString()}`, { method: "POST" });
}