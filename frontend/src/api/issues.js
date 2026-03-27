// src/api/issues.js
import { apiFetch } from "./index";

// 전체 이슈 조회 (필터: years, search)
export async function getIssues({ years = [], search = "" } = {}) {
  const params = new URLSearchParams();
  years.forEach((y) => params.append("years", y));
  if (search) params.append("search", search);
  return apiFetch(`/issues?${params.toString()}`);
}

// 이슈 단건 조회
export async function getIssue(issueId) {
  return apiFetch(`/issues/${issueId}`);
}

// 이슈 생성
export async function createIssue(body) {
  return apiFetch("/issues", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 이슈 수정
export async function updateIssue(issueId, body) {
  return apiFetch(`/issues/${issueId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// 이슈 삭제
export async function deleteIssue(issueId) {
  return apiFetch(`/issues/${issueId}`, { method: "DELETE" });
}