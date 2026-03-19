// src/api/standardData.js
import { apiFetch } from "./index";

// issues → indicators → data → data_points 계층 구조 조회
// StandardDataView 메인 데이터
export async function getGroupedData() {
  return apiFetch("/mapping/grouped");
}

// 지표 목록 (issue_id로 필터)
export async function getIndicators(issueId) {
  return apiFetch(`/indicators?issue_id=${issueId}`);
}

// 지표 상세 (data 포함)
export async function getIndicatorDetail(indicatorId) {
  return apiFetch(`/indicators/${indicatorId}`);
}

// data 목록 (indicator_id로 필터)
export async function getDataList(indicatorId) {
  return apiFetch(`/data?indicator_id=${indicatorId}`);
}

// data 상세 (data_points 포함)
export async function getDataDetail(dataId) {
  return apiFetch(`/data/${dataId}`);
}

// data_points 목록
export async function getDataPoints(dataId) {
  return apiFetch(`/data-points?data_id=${dataId}`);
}