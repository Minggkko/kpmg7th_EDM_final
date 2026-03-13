import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const requestItems = [
  { id: 1, category: "환경", metric: "용수 사용량", reason: "전년 대비 68% 급증 — 재확인 필요", type: "재입력", assignee: "", dueDate: "" },
  { id: 2, category: "지배구조", metric: "윤리 위반 건수", reason: "업종 평균 대비 3배 초과 — 세부 내역 필요", type: "증빙자료", assignee: "", dueDate: "" },
  { id: 3, category: "사회", metric: "여성 임원 비율", reason: "GRI 405-1 필수 공시 항목 누락", type: "신규입력", assignee: "", dueDate: "" },
];

function DataInputRequest({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";

  const [items, setItems] = useState(requestItems);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("데이터 검토 및 수정 협조 부탁드립니다.\n이상치 탐지 결과에 따라 아래 항목에 대한 데이터 재확인이 필요합니다.");

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const handleSend = () => {
    setSent(true);
  };

  const typeColor = {
    재입력: { bg: "#fef2f2", color: "#991b1b" },
    증빙자료: { bg: "#fffbeb", color: "#92400e" },
    신규입력: { bg: "rgba(132,147,74,0.1)", color: "#84934A" },
  };

  const allFilled = items.every(it => it.assignee && it.dueDate);

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="data-input-request" />
        <main style={s.main}>

          <div style={s.header}>
            <div>
              <h1 style={s.title}>데이터 입력 요청</h1>
              <p style={s.sub}>이상치 항목에 대해 담당자에게 데이터 입력 또는 증빙자료 제출을 요청합니다.</p>
            </div>
          </div>

          {sent ? (
            <div style={s.successBox}>
              <div style={s.successIcon}>✓</div>
              <h2 style={s.successTitle}>요청이 전송되었습니다</h2>
              <p style={s.successSub}>총 {items.length}개 항목에 대한 데이터 입력 요청이 담당자에게 발송되었습니다.</p>
              <div style={s.successItems}>
                {items.map(it => (
                  <div key={it.id} style={s.successItem}>
                    <span style={{ ...s.typeBadge, ...typeColor[it.type] }}>{it.type}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{it.metric}</span>
                    <span style={{ color: "#777", fontSize: 13 }}>→ {it.assignee}</span>
                    <span style={{ color: "#aaa", fontSize: 13 }}>기한: {it.dueDate}</span>
                  </div>
                ))}
              </div>
              <button
                style={s.priBtn}
                onClick={() => navigate("/data-input-upload", { state: { fileName } })}
              >
                데이터 입력/업로드 화면으로 →
              </button>
            </div>
          ) : (
            <>
              {/* Request Items */}
              <div style={s.panel}>
                <p style={s.panelLabel}>요청 항목 ({items.length}개)</p>
                <div style={s.itemList}>
                  {items.map((it) => (
                    <div key={it.id} style={s.itemCard}>
                      <div style={s.itemTop}>
                        <div style={s.itemLeft}>
                          <span style={{ ...s.typeBadge, ...typeColor[it.type] }}>{it.type}</span>
                          <span style={s.catBadge}>{it.category}</span>
                          <span style={s.metricName}>{it.metric}</span>
                        </div>
                      </div>
                      <p style={s.itemReason}>⚠ {it.reason}</p>
                      <div style={s.itemFields}>
                        <div style={s.fieldGroup}>
                          <label style={s.fieldLabel}>담당자 이메일</label>
                          <input
                            style={s.input}
                            type="email"
                            placeholder="example@company.com"
                            value={it.assignee}
                            onChange={e => updateItem(it.id, "assignee", e.target.value)}
                          />
                        </div>
                        <div style={s.fieldGroup}>
                          <label style={s.fieldLabel}>제출 기한</label>
                          <input
                            style={s.input}
                            type="date"
                            value={it.dueDate}
                            onChange={e => updateItem(it.id, "dueDate", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div style={s.panel}>
                <p style={s.panelLabel}>메시지 (선택)</p>
                <textarea
                  style={s.textarea}
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              <div style={s.bottom}>
                <button style={s.secBtn} onClick={() => navigate(-1)}>← 이전</button>
                <button
                  style={{ ...s.priBtn, opacity: allFilled ? 1 : 0.45, cursor: allFilled ? "pointer" : "not-allowed" }}
                  disabled={!allFilled}
                  onClick={handleSend}
                >
                  요청 전송 →
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
  page: { minHeight: "100vh", background: "#F5F5F3", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "44px 48px" },
  header: { marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  sub: { fontSize: 14, color: "#777" },
  panel: { background: "white", borderRadius: 16, padding: "28px 32px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 20 },
  panelLabel: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 18 },
  itemList: { display: "flex", flexDirection: "column", gap: 16 },
  itemCard: { border: "1.5px solid #eee", borderRadius: 12, padding: "18px 20px" },
  itemTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemLeft: { display: "flex", alignItems: "center", gap: 8 },
  typeBadge: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6 },
  catBadge: { fontSize: 12, color: "#84934A", background: "rgba(132,147,74,0.1)", padding: "3px 10px", borderRadius: 6, fontWeight: 600 },
  metricName: { fontSize: 15, fontWeight: 700, color: "#222" },
  itemReason: { fontSize: 13, color: "#888", marginBottom: 14, paddingLeft: 2 },
  itemFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: "#555" },
  input: { padding: "10px 14px", borderRadius: 8, border: "1.5px solid #e0e0e0", fontSize: 14, outline: "none", color: "#333" },
  textarea: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #e0e0e0", fontSize: 14, color: "#333", resize: "vertical", outline: "none", boxSizing: "border-box" },
  bottom: { display: "flex", justifyContent: "flex-end", gap: 12 },
  secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
  priBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  successBox: { background: "white", borderRadius: 20, padding: "52px 48px", textAlign: "center", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  successIcon: { width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5", color: "#22c55e", fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" },
  successTitle: { fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  successSub: { fontSize: 14, color: "#777", marginBottom: 28 },
  successItems: { display: "flex", flexDirection: "column", gap: 10, textAlign: "left", maxWidth: 500, margin: "0 auto 32px", background: "#f8f8f6", borderRadius: 12, padding: "18px 20px" },
  successItem: { display: "flex", alignItems: "center", gap: 10 },
};

export default DataInputRequest;