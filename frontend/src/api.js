import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // http://localhost:8000/api/v1
});

// ===== 요청 인터셉터 - JWT 토큰 자동 첨부 =====
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ===== 에러 처리 =====
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("login");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ===== Auth =====
export const checkUsername = (username) => api.get(`/auth/check-username/${encodeURIComponent(username)}`);
export const searchCompanies = (q) => api.get(`/auth/companies?q=${encodeURIComponent(q)}`);
export const signup = (data) => api.post("/auth/signup", data);
export const loginApi = (data) => api.post("/auth/login", data);

// ===== Issues =====
export const getIssues = () => api.get("/issues");
export const createIssue = (data) => api.post("/issues", data);
export const getIssue = (issueId) => api.get(`/issues/${issueId}`);
export const updateIssue = (issueId, data) => api.patch(`/issues/${issueId}`, data);
export const deleteIssue = (issueId) => api.delete(`/issues/${issueId}`);

// ===== Indicators =====
export const getIndicators = () => api.get("/indicators");
export const createIndicator = (data) => api.post("/indicators", data);
export const getIndicator = (indicatorId) => api.get(`/indicators/${indicatorId}`);
export const updateIndicator = (indicatorId, data) => api.patch(`/indicators/${indicatorId}`, data);

// ===== DataPoints =====
export const getDataPoints = () => api.get("/data-points");
export const createDataPoint = (data) => api.post("/data-points", data);

// ===== RawData =====
export const uploadRawData = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/raw-data/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// ===== Mapping =====
export const runMapping = (rawDataId) =>
  api.post("/mapping/run", { raw_data_id: rawDataId });

export const getMappingResult = (rawDataId) =>
  api.get(`/mapping/result/${rawDataId}`);

export const getGroupedStandardized = () =>
  api.get("/mapping/grouped");

export default api;
