import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const DUMMY_ITEMS = [
  { id: 1, dpName: "Scope 3 기타 간접배출량", unit: "tCO₂e", value: 3012.1, reason: "공급망 배출량 산정 기준 문서가 업로드되지 않았습니다.", checked: false },
  { id: 2, dpName: "재생에너지 사용량", unit: "MWh", value: 1200.0, reason: "재생에너지 구매 계약서 또는 REC 인증서가 없습니다.", checked: false },
  { id: 3, dpName: "지정폐기물 반출량", unit: "톤", value: 87.5, reason: "지정폐기물 처리업체 계약서 및 처리 확인서가 첨부되지 않았습니다.", checked: false },
  { id: 4, dpName: "여성 임원 비율", unit: "%", value: 18.2, reason: "이사회 구성원 명단 및 성별 확인 문서가 없습니다.", checked: false },
];

export default function UnverifiedResult({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(DUMMY_ITEMS);
  const [popup, setPopup] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = checkedCount === items.length;

  const handleConfirmRequest = () => {
    setItems((prev) => prev.map((i) => (i.id === popup.id ? { ...i, checked: true } : i)));
    setPopup(null);
  };

  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>

          <div style={s.pageHeader}>
            <div>
              <p style={s.breadcrumb}>데이터 검증</p>
              <h1 style={s.pageTitle}>미증빙자료 검증</h1>
              <p style={s.pageDesc}>증빙자료가 없는 항목을 확인하고 소명해 주세요.</p>
            </div>
            <div style={s.headerRight}>
              <div style={s.progressCircle}>
                <span style={s.progressNum}>
                  <span style={{ color: "#5C6B2E" }}>{checkedCount}</span>/{items.length}
                </span>
              </div>
              <p style={s.progressLabel}>검토 완료</p>
            </div>
          </div>

          <div style={s.divider} />

          <div style={s.tabBar}>
            <div style={{ display: "flex" }}>
              {["이상치 탐지", "정합성 탐지", "미증빙 자료"].map((tab) => (
                <button key={tab} style={tab === "미증빙 자료" ? s.tabActive : s.tab}>{tab}</button>
              ))}
            </div>
            <button
              style={allChecked ? s.btnPrimary : s.btnDisabled}
              disabled={!allChecked}
              onClick={() => setShowConfirm(true)}
            >
              확정
            </button>
          </div>

          <div style={s.listWrap}>
            <div style={s.colHeader}>
              <span style={{ width: 32 }} />
              <span style={{ flex: 3 }}>데이터 포인트</span>
              <span style={{ flex: 2 }}>미증빙 사유</span>
              <span style={{ flex: 1, textAlign: "center" }}>상태</span>
            </div>
            {items.map((item, idx) => (
              <div
                key={item.id}
                style={{ ...s.listRow, borderBottom: idx < items.length - 1 ? "1px solid #f0ede8" : "none" }}
                onClick={() => setPopup(item)}
              >
                <div style={{ width: 32, display: "flex", justifyContent: "center" }}>
                  <div style={{ ...s.checkbox, ...(item.checked ? s.checkboxChecked : {}) }}>
                    {item.checked && <span style={s.checkMark}>✓</span>}
                  </div>
                </div>
                <div style={{ flex: 3 }}>
                  <span style={s.dpName}>{item.dpName}</span>
                  <span style={s.dpUnit}>{item.unit}</span>
                </div>
                <div style={{ flex: 2 }}>
                  <span style={s.reasonText}>{item.reason}</span>
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  {item.checked
                    ? <span style={s.statusDone}>완료</span>
                    : <span style={s.statusNeed}>검토 필요 →</span>}
                </div>
              </div>
            ))}
          </div>

        </main>
      </div>

      {/* 팝업 */}
      {popup && (
        <div style={s.overlay} onClick={() => setPopup(null)}>
          <div style={s.popupBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.popupHeader}>
              <div>
                <p style={s.popupBreadcrumb}>미증빙자료 소명</p>
                <h2 style={s.popupTitle}>{popup.dpName}</h2>
              </div>
              <button style={s.closeBtn} onClick={() => setPopup(null)}>✕</button>
            </div>
            <div style={s.popupDivider} />
            <div style={s.valueBox}>
              <p style={s.valueLabel}>현재 입력값</p>
              <p style={s.valueNum}>{popup.value.toLocaleString()} <span style={s.valueUnit}>{popup.unit}</span></p>
            </div>
            <div style={s.reasonBox}>
              <p style={s.reasonBoxLabel}>미증빙 사유</p>
              <p style={s.reasonBoxDesc}>{popup.reason}</p>
            </div>
            <div style={s.infoBox}>
              <span>ℹ️</span>
              <span style={s.infoText}>확인 요청 클릭 시 현재 입력값을 유지하고 검토 완료 처리됩니다.</span>
            </div>
            <div style={s.popupBtns}>
              <button style={s.cancelBtn} onClick={() => setPopup(null)}>취소</button>
              <button style={s.confirmRequestBtn} onClick={handleConfirmRequest}>확인 요청</button>
            </div>
          </div>
        </div>
      )}

      {/* 확정 팝업 */}
      {showConfirm && (
        <div style={s.overlay}>
          <div style={s.confirmModal}>
            <p style={s.confirmTitle}>최종 확정</p>
            <p style={s.confirmDesc}>미증빙자료 검증을 완료하고 SR 보고서로 이동하시겠습니까?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button style={s.cancelBtn} onClick={() => setShowConfirm(false)}>취소</button>
              <button style={s.btnPrimary} onClick={() => { setShowConfirm(false); navigate("/report-draft"); }}>확정 및 이동</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  body: { display: "flex" },
  main: { flex: 1, padding: "40px 48px", maxWidth: 1000 },
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  breadcrumb: { fontSize: 12, color: "#aaa", margin: "0 0 6px" },
  pageTitle: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" },
  pageDesc: { fontSize: 14, color: "#888", margin: 0 },
  headerRight: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  progressCircle: { width: 64, height: 64, borderRadius: "50%", border: "2px solid #d0d0d0", display: "flex", alignItems: "center", justifyContent: "center" },
  progressNum: { fontSize: 16, fontWeight: 700, color: "#555" },
  progressLabel: { fontSize: 12, color: "#aaa", margin: 0 },
  divider: { height: 1, background: "#e8e3da", marginBottom: 24 },
  tabBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e8e3da", marginBottom: 16, paddingBottom: 8 },
  tab: { padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#aaa", background: "none", border: "none", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: -9 },
  tabActive: { padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "#5C6B2E", background: "none", border: "none", cursor: "pointer", borderBottom: "2px solid #5C6B2E", marginBottom: -9 },
  btnPrimary: { padding: "7px 20px", fontSize: 13, fontWeight: 600, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  btnDisabled: { padding: "7px 20px", fontSize: 13, fontWeight: 600, background: "#e8e3da", color: "#bbb", border: "none", borderRadius: 6, cursor: "not-allowed" },
  listWrap: { background: "#fff", border: "1px solid #e8e3da", borderRadius: 8, overflow: "hidden" },
  colHeader: { display: "flex", alignItems: "center", padding: "10px 20px", background: "#f5f3ed", borderBottom: "1px solid #e8e3da", fontSize: 12, color: "#888", fontWeight: 600, gap: 12 },
  listRow: { display: "flex", alignItems: "center", padding: "16px 20px", gap: 12, cursor: "pointer", transition: "background 0.15s" },
  checkbox: { width: 18, height: 18, border: "1.5px solid #ccc", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" },
  checkboxChecked: { background: "#5C6B2E", border: "1.5px solid #5C6B2E" },
  checkMark: { fontSize: 11, color: "#fff", fontWeight: 700 },
  dpName: { fontSize: 14, fontWeight: 600, color: "#1a1a1a", display: "block" },
  dpUnit: { fontSize: 12, color: "#aaa", display: "block" },
  reasonText: { fontSize: 13, color: "#888" },
  statusDone: { fontSize: 12, fontWeight: 600, color: "#16a34a" },
  statusNeed: { fontSize: 12, fontWeight: 500, color: "#d97706" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  popupBox: { background: "#fff", borderRadius: 12, padding: "32px 36px", width: 520, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" },
  popupHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  popupBreadcrumb: { fontSize: 12, color: "#aaa", margin: "0 0 4px" },
  popupTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: 18, color: "#aaa", cursor: "pointer" },
  popupDivider: { height: 1, background: "#e8e3da", marginBottom: 20 },
  valueBox: { background: "#f5f7ee", border: "1px solid #c8d4a0", borderRadius: 8, padding: "16px 20px", marginBottom: 14 },
  valueLabel: { fontSize: 11, color: "#5C6B2E", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" },
  valueNum: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  valueUnit: { fontSize: 14, color: "#888", fontWeight: 400 },
  reasonBox: { background: "#fff8ed", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 16px", marginBottom: 14 },
  reasonBoxLabel: { fontSize: 11, color: "#92400e", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" },
  reasonBoxDesc: { fontSize: 13, color: "#92400e", lineHeight: 1.6, margin: 0 },
  infoBox: { display: "flex", alignItems: "flex-start", gap: 8, background: "#f5f5f5", borderRadius: 8, padding: "12px 14px", marginBottom: 20 },
  infoText: { fontSize: 12, color: "#666", lineHeight: 1.6 },
  popupBtns: { display: "flex", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { padding: "9px 22px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#444", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" },
  confirmRequestBtn: { padding: "9px 22px", fontSize: 13, fontWeight: 600, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  confirmModal: { background: "#fff", borderRadius: 12, padding: "32px 36px", width: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" },
  confirmTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" },
  confirmDesc: { fontSize: 14, color: "#555", lineHeight: 1.7, margin: 0 },
};