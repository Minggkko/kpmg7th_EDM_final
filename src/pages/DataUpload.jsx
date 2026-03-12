import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

function DataUpload({ isLoggedIn, onLogout }) {

  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const handleFile = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleStart = () => {
    if (!file) return;
    navigate("/data-process", {
      state: { fileName: file.name }
    });
  };

  return (
    <div style={styles.page}>

      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={styles.body}>

        <Sidebar currentStep="data-upload" />

        <main style={styles.main}>

          <h1 style={styles.title}>데이터 업로드</h1>

          <p style={styles.subtitle}>
            ESG 분석에 사용할 데이터를 업로드하세요. PDF, XLSX, DOCX 형식을 지원합니다.
          </p>

          <label style={styles.uploadBox}>

            <UploadCloud size={48} color="#9ca3af" />

            <p style={styles.uploadText}>
              파일을 드래그하거나 클릭하여 업로드
            </p>

            <p style={styles.uploadSub}>
              PDF, XLSX, DOCX (최대 50MB)
            </p>

            <input
              type="file"
              style={{ display: "none" }}
              onChange={handleFile}
            />

          </label>

          {file && (
            <div style={styles.fileInfo}>
              📄 {file.name}
            </div>
          )}

          <button
            style={{
              ...styles.button,
              ...(file ? styles.buttonActive : {})
            }}
            disabled={!file}
            onClick={handleStart}
          >
            분석 시작
          </button>

        </main>

      </div>

    </div>
  );
}

const styles = {

  page: {
    minHeight: "100vh",
    background: "#F5F5F3",
    fontFamily: "'Inter', sans-serif",
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
    marginBottom: 40
  },

  uploadBox: {
    border: "2px dashed #d1d5db",
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

  button: {
    marginTop: 35,
    padding: "15px 32px",
    borderRadius: 12,
    border: "none",
    background: "#d1d5db",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 16,
    cursor: "not-allowed"
  },

  buttonActive: {
    background: "#84934A",
    cursor: "pointer"
  }

};

export default DataUpload;