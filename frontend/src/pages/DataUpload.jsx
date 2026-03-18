import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { uploadRawData } from "../api";

function DataUpload({ isLoggedIn, onLogout }) {

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFile = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError(null);
    }
  };

  const handleStart = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      await uploadRawData(file);
      navigate("/standard-data");
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "업로드 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>

      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={styles.body}>

        <Sidebar currentStep="data-upload" />

        <main style={styles.main}>

          <h1 style={styles.title}>데이터 업로드</h1>

          <p style={styles.subtitle}>
            ESG 분석에 사용할 데이터를 업로드하세요. CSV, XLSX 형식을 지원합니다.<br />
            파일명 형식: <strong>source_type_source_name_raw.csv</strong> (예: 계열사_삼성물산_raw.csv)
          </p>

          <label style={styles.uploadBox}>

            <UploadCloud size={48} color="#aeb784" />

            <p style={styles.uploadText}>
              파일을 드래그하거나 클릭하여 업로드
            </p>

            <p style={styles.uploadSub}>
              CSV, XLSX (최대 50MB)
            </p>

            <input
              type="file"
              style={{ display: "none" }}
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
            />

          </label>

          {file && (
            <div style={styles.fileInfo}>
              📄 {file.name}
            </div>
          )}

          {error && (
            <div style={styles.errorBox}>
              ⚠️ {error}
            </div>
          )}

          {loading && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner} />
              파일을 파싱하고 표준화하는 중입니다...
            </div>
          )}

          <button
            style={{
              ...styles.button,
              ...(file && !loading ? styles.buttonActive : {}),
              ...(loading ? styles.buttonLoading : {}),
            }}
            disabled={!file || loading}
            onClick={handleStart}
          >
            {loading ? "처리 중..." : "분석 시작"}
          </button>

        </main>

      </div>

    </div>
  );
}

const styles = {

  page: {
    minHeight: "100vh",
    background: "#FAF8F0",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    display: "flex",
    flexDirection: "column",
  },

  body: {
    display: "flex",
    flex: 1,
  },

  main: {
    flex: 1,
    padding: "44px 48px",
  },

  title: {
    fontSize: 34,
    fontWeight: 700,
    marginBottom: 10,
    color: "#111827"
  },

  subtitle: {
    color: "#6b7280",
    marginBottom: 40,
    lineHeight: 1.7,
  },

  uploadBox: {
    border: "2px dashed #c8be96",
    borderRadius: 16,
    padding: "80px",
    textAlign: "center",
    background: "#ffffff",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  uploadText: {
    marginTop: 18,
    fontSize: 17,
    fontWeight: 500,
    color: "#374151"
  },

  uploadSub: {
    fontSize: 14,
    color: "#9ca3af",
    marginTop: 6
  },

  fileInfo: {
    marginTop: 25,
    background: "#ecfdf5",
    padding: "12px 16px",
    borderRadius: 10,
    width: "fit-content",
    color: "#065f46",
    fontSize: 14
  },

  errorBox: {
    marginTop: 16,
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    padding: "12px 16px",
    borderRadius: 10,
    color: "#b91c1c",
    fontSize: 14,
  },

  loadingBox: {
    marginTop: 20,
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#6b7280",
    fontSize: 14,
  },

  spinner: {
    width: 18,
    height: 18,
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #84934A",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  button: {
    marginTop: 35,
    padding: "15px 32px",
    borderRadius: 12,
    border: "none",
    background: "#c8be96",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 16,
    cursor: "not-allowed"
  },

  buttonActive: {
    background: "#84934A",
    cursor: "pointer"
  },

  buttonLoading: {
    background: "#84934A",
    opacity: 0.7,
    cursor: "not-allowed",
  },

};

export default DataUpload;
