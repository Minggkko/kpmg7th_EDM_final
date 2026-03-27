import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

// ===== 에러 처리 =====
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

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

export const getDashboard = async () => {};
export const getIndicatorDetail = async () => {};
export const submitJustification = async () => {};
export const sendConfirmRequest = async () => {};
export const finalizeData = async () => {};
export const getSites = async () => {};
export const autoFinalizeV4 = async () => {};

export default api;
