import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const inputFields = [
  {
    id: 1,
    category: "환경",
    metric: "용수 사용량",
    unit: "톤",
    type: "재입력",
    prevValue: "31,800",
    requiresFile: false,
  },
  {
    id: 2,
    category: "지배구조",
    metric: "윤리 위반 건수",
    unit: "건",
    type: "증빙자료",
    prevValue: "3",
    requiresFile: true,
  },
  {
    id: 3,
    category: "사회",
    metric: "여성 임원 비율",
    unit: "%",
    type: "신규입력",
    prevValue: "",
    requiresFile: false,
  },
];

const typeColor = {
  재입력: { bg: "#fef2f2", color: "#991b1b" },
  증빙자료: { bg: "#fffbeb", color: "#92400e" },
  신규입력: { bg: "rgba(132,147,74,0.1)", color: "#84934A" },
};

function DataInputUpload({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";

  const [values, setValues] = useState({});
  const [notes, setNotes] = useState({});
  const [files, setFiles] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const updateValue = (id, val) => setValues(prev => ({ ...prev, [id]: val }));
  const updateNote = (id, val) => setNotes(prev => ({ ...prev, [id]: val }));
  const handleFileChange = (id, e) => {
    const f = e.target.files[0];
    if (f) setFiles(prev => ({ ...prev, [id]: f.name }));
  };

  const allDone = inputFields.every(f =>
    values[f.id] && (f.requiresFile ? files[f.id] : true)
  );

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="data-input-upload" />
        <main style={s.main}>

          <div style={s.header}>
            <div>
              <h1 style={s.title}>데이터 입력 / 증빙자료 업로드</h1>
              <p style={s.sub}>요청된 항목의 데이터를 입력하고, 필요한 경우 증빙자료를 첨부하세요.</p>
            </div>
          </div>

          {submitted ? (
            <div style={s.successBox}>
              <div style={s.successIcon}>✓</div>
              <h2 style={s.successTitle}>입력이 완료되었습니다</h2>
              <p style={s.successSub}>총 {inputFields.length}개 항목의 데이터가 저장되었습니다. 데이터 취합 화면으로 이동합니다.</p>
              <button style={s.priBtn} onClick={() => navigate("/data-aggregation", { state: { fileName } })}>
                데이터 취합 화면으로 →
              </button>
            </div>
          ) : (
            <>
              <div style={s.formList}>
                {inputFields.map((field) => (
                  <div key={field.id} style={s.fieldCard}>
                    <div style={s.cardHeader}>
                      <div style={s.cardLeft}>
                        <span style={{ ...s.typeBadge, ...typeColor[field.type] }}>{field.type}</span>
                        <span style={s.catBadge}>{field.category}</span>
                        <span style={s.metricName}>{field.metric}</span>
                      </div>
                      {field.prevValue && (
                        <div style={s.prevValue}>
                          이전 값: <strong>{field.prevValue} {field.unit}</strong>
                        </div>
                      )}
                    </div>

                    <div style={s.inputRow}>
                      {/* Value Input */}
                      <div style={s.inputGroup}>
                        <label style={s.label}>
                          {field.type === "재입력" ? "수정된 값" : "입력 값"} <span style={{ color: "#e53e3e" }}>*</span>
                        </label>
                        <div style={s.inputWithUnit}>
                          <input
                            style={s.input}
                            type="text"
                            placeholder={`${field.metric} 값 입력`}
                            value={values[field.id] || ""}
                            onChange={e => updateValue(field.id, e.target.value)}
                          />
                          <span style={s.unitTag}>{field.unit}</span>
                        </div>
                      </div>

                      {/* Note */}
                      <div style={s.inputGroup}>
                        <label style={s.label}>비고 (선택)</label>
                        <input
                          style={s.input}
                          type="text"
                          placeholder="변경 사유 또는 참고사항"
                          value={notes[field.id] || ""}
                          onChange={e => updateNote(field.id, e.target.value)}
                        />
                      </div>
                    </div>

                    {/* File Upload (if required) */}
                    {field.requiresFile && (
                      <div style={s.uploadSection}>
                        <label style={s.label}>
                          증빙자료 <span style={{ color: "#e53e3e" }}>*</span>
                        </label>
                        <label style={s.uploadBox}>
                          <UploadCloud size={22} color="#84934A" />
                          <span style={s.uploadText}>
                            {files[field.id] ? `📄 ${files[field.id]}` : "파일 클릭 또는 드래그 업로드"}
                          </span>
                          <span style={s.uploadSub}>PDF, JPG, PNG (최대 20MB)</span>
                          <input
                            type="file"
                            style={{ display: "none" }}
                            onChange={e => handleFileChange(field.id, e)}
                          />
                        </label>
                      </div>
                    )}

                    {/* Done indicator */}
                    {values[field.id] && (!field.requiresFile || files[field.id]) && (
                      <div style={s.doneTag}>✓ 입력 완료</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div style={s.progressSection}>
                <div style={s.progressInfo}>
                  <span style={{ fontSize: 13, color: "#555" }}>입력 진행률</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#84934A" }}>
                    {inputFields.filter(f => values[f.id] && (!f.requiresFile || files[f.id])).length} / {inputFields.length}
                  </span>
                </div>
                <div style={s.progressBar}>
                  <div style={{
                    ...s.progressFill,
                    width: `${(inputFields.filter(f => values[f.id] && (!f.requiresFile || files[f.id])).length / inputFields.length) * 100}%`
                  }} />
                </div>
              </div>

              <div style={s.bottom}>
                <button style={s.secBtn} onClick={() => navigate(-1)}>← 이전</button>
                <button
                  style={{ ...s.priBtn, opacity: allDone ? 1 : 0.45, cursor: allDone ? "pointer" : "not-allowed" }}
                  disabled={!allDone}
                  onClick={() => setSubmitted(true)}
                >
                  저장 및 다음 →
                </button>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f8f9fa", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "44px 48px" },
  header: { marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  sub: { fontSize: 14, color: "#777" },
  formList: { display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 },
  fieldCard: { background: "white", borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", position: "relative" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  cardLeft: { display: "flex", alignItems: "center", gap: 8 },
  typeBadge: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6 },
  catBadge: { fontSize: 12, color: "#84934A", background: "rgba(132,147,74,0.1)", padding: "3px 10px", borderRadius: 6, fontWeight: 600 },
  metricName: { fontSize: 15, fontWeight: 700, color: "#222" },
  prevValue: { fontSize: 13, color: "#888", background: "#f5f5f3", padding: "6px 12px", borderRadius: 8 },
  inputRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  inputGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "#555" },
  inputWithUnit: { display: "flex", alignItems: "center", gap: 0 },
  input: { flex: 1, padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none", color: "#333" },
  unitTag: { background: "#f0f0ee", border: "1.5px solid #e0e0e0", borderLeft: "none", padding: "10px 14px", borderRadius: "0 8px 8px 0", fontSize: 13, color: "#777", fontWeight: 600 },
  uploadSection: { marginTop: 4 },
  uploadBox: { display: "flex", alignItems: "center", gap: 12, border: "2px dashed #d1d5db", borderRadius: 10, padding: "16px 20px", cursor: "pointer", marginTop: 8, background: "rgba(132,147,74,0.02)" },
  uploadText: { fontSize: 14, color: "#374151", fontWeight: 500 },
  uploadSub: { fontSize: 12, color: "#9ca3af", marginLeft: "auto" },
  doneTag: { position: "absolute", top: 20, right: 24, background: "#ecfdf5", color: "#065f46", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20 },
  progressSection: { background: "white", borderRadius: 14, padding: "18px 22px", marginBottom: 24, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  progressInfo: { display: "flex", justifyContent: "space-between", marginBottom: 10 },
  progressBar: { height: 8, background: "#f0f0ee", borderRadius: 99 },
  progressFill: { height: "100%", background: "#84934A", borderRadius: 99, transition: "width 0.4s ease" },
  bottom: { display: "flex", justifyContent: "flex-end", gap: 12 },
  secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
  priBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  successBox: { background: "white", borderRadius: 20, padding: "52px 48px", textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  successIcon: { width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5", color: "#22c55e", fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" },
  successTitle: { fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  successSub: { fontSize: 14, color: "#777", marginBottom: 28 },
};

export default DataInputUpload;