import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// ─── 더미 데이터 ────────────────────────────────────────────────────
const DUMMY_ITEMS = [
  {
    id: 1,
    dpName: "온실가스 배출량 (Scope 1)",
    unit: "tCO₂e",
    risk: "높음",
    prevValue: 100,
    llmReason: "전년 대비 51.2% 급증하여 통계적 이상치로 탐지되었습니다. 동종 업계 평균 증가율(+3.8%)을 크게 상회하며, 내부 생산량 증가율(+5.1%)과도 불일치합니다. 설비 변경, 연료 전환, 또는 측정 오류 여부를 확인해 주세요.",
    checked: false,
  },
  {
    id: 2,
    dpName: "에너지원별 사용량 - 전력",
    unit: "MWh",
    risk: "중간",
    prevValue: 200,
    llmReason: "전력 사용량이 전년 대비 21.6% 증가하였습니다. 생산 증가율(+5.1%)과 비교 시 괴리가 크며, 하계 냉방 수요 증가 또는 신규 설비 도입 여부를 검토할 필요가 있습니다.",
    checked: false,
  },
  {
    id: 3,
    dpName: "용수 사용량",
    unit: "톤",
    risk: "높음",
    prevValue: 300,
    llmReason: "용수 사용량이 전년 대비 119% 이상 급증하여 데이터 입력 오류 가능성이 높습니다. 단위(톤 vs 리터) 혼동 또는 측정 기간 오류를 우선 점검해 주세요.",
    checked: false,
  },
  {
    id: 4,
    dpName: "산업재해율",
    unit: "%",
    risk: "낮음",
    prevValue: 0.42,
    llmReason: "산업재해율이 0.00%로 기록되었습니다. 업종 평균(0.45%) 대비 이례적으로 낮으며, 미보고 사고가 있거나 집계 기준이 변경되었을 가능성을 확인해 주세요.",
    checked: false,
  },
  {
    id: 5,
    dpName: "폐기물 반출량 - 일반폐기물",
    unit: "톤",
    risk: "중간",
    prevValue: 890,
    llmReason: "일반폐기물 반출량이 전년 대비 39% 증가하였습니다. 생산량 증가율(+5.1%)에 비해 과도한 증가로 판단되며, 폐기물 분류 기준 변경 여부를 확인해 주세요.",
    checked: false,
  },
];

const RISK_COLOR = {
  높음: { color: "#dc2626", bg: "#fef2f2", dot: "#dc2626" },
  중간: { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  낮음: { color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
};

const TABS = ["이상치 탐지", "정합성 탐지"];

export default function AnomalyResult({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("이상치 탐지");
  const [items, setItems] = useState(DUMMY_ITEMS);
  const [selected, setSelected] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = checkedCount === items.length;

  const handleRowClick = (item) => {
    setSelected(item);
    setEditMode(false);
    setNewValue("");
    setReason("");
  };

  const handleConfirm = () => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === selected.id
          ? {
              ...i,
              checked: true,
              modifiedValue: newValue !== '' ? newValue : null,
              modifiedReason: reason !== '' ? reason : null,
            }
          : i
      )
    );
    setSelected(null);
  };

  const diff =
    newValue !== "" && !isNaN(Number(newValue))
      ? Number(newValue) - selected?.prevValue
      : null;

  // ── 2-2-2 : 소명 화면 ───────────────────────────────────────────
  if (selected) {
    return (
      <div style={s.root}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={s.body}>
          <Sidebar />
          <main style={s.main}>

            {/* 페이지 헤더 */}
            <div style={s.pageHeader}>
              <div>
                <p style={s.breadcrumb}>데이터 검증</p>
                <h1 style={s.pageTitle}>{selected.dpName}</h1>
                <p style={s.pageDesc}>이상치 추론 내역을 확인하고 소명해 주세요.</p>
              </div>
              <div style={s.headerRight}>
                <div style={s.actionBtns}>
                  <button style={s.outlineBtn}>확인 요청</button>
                  <button
                    style={s.btnPrimary}
                    onClick={handleConfirm}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>

            <div style={s.divider} />

            {/* LLM 추론 내역 */}
            <div style={s.sectionBox}>
              <div style={s.sectionHeader}>이상치 추론 (LLM) 내역</div>
              <div style={s.sectionBody}>
                <p style={s.llmText}>{selected.llmReason}</p>
              </div>
            </div>

            {/* 수정 폼 - 항상 노출 */}
            <div style={s.editBox}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>이전값</th>
                    <th style={s.th}>수정값</th>
                    <th style={s.th}>차이값</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={s.td}>{selected.prevValue.toLocaleString()}</td>
                    <td style={s.td}>
                      <input
                        style={s.tableInput}
                        placeholder="[입력]"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                      />
                    </td>
                    <td style={{ ...s.td, color: diff != null ? (diff > 0 ? "#dc2626" : "#16a34a") : "#aaa" }}>
                      {diff != null ? (diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()) : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={s.reasonLabel}>이유</p>
              <textarea
                style={s.textarea}
                placeholder="[이유를 입력하세요]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>

          </main>
        </div>
      </div>
    );
  }

  // ── 2-2-1 : 목록 화면 ───────────────────────────────────────────
  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>

          {/* 페이지 헤더 */}
          <div style={s.pageHeader}>
            <div>
              <p style={s.breadcrumb}>데이터 검증</p>
              <h1 style={s.pageTitle}>이상치 검증</h1>
              <p style={s.pageDesc}>AI가 탐지한 이상치 항목을 검토하고 소명해 주세요.</p>
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

          {/* 탭 */}
          <div style={s.tabBar}>
            <div style={{ display: "flex" }}>
              {TABS.map((tab) => (
                <button
                  key={tab}
                  style={activeTab === tab ? s.tabActive : s.tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                  {tab === "이상치 탐지" && (
                    <span style={activeTab === tab ? s.tabBadgeActive : s.tabBadge}>
                      {items.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              style={allChecked ? s.btnPrimary : s.btnDisabled}
              disabled={!allChecked}
              onClick={() => navigate("/analysis-dashboard", {
                state: {
                  anomalyItems: items,
                  checkedCount: checkedCount,
                  totalCount: items.length,
                }
              })}
            >
              다음 단계로
            </button>
          </div>

          {/* 리스트 */}
          <div style={s.listWrap}>
            {/* 컬럼 헤더 */}
            <div style={s.colHeader}>
              <span style={s.colDp}>데이터 포인트</span>
              <span style={s.colRisk}>위험도</span>
              <span style={s.colStatus}>상태</span>
            </div>

            {activeTab === "이상치 탐지" ? (
              items.map((item) => (
                <div
                  key={item.id}
                  style={s.listRow}
                  onClick={() => handleRowClick(item)}
                >
                  <div style={s.colDp}>
                    <span style={s.dpName}>{item.dpName}</span>
                    <span style={s.dpUnit}>{item.unit}</span>
                  </div>
                  <div style={s.colRisk}>
                    <span style={{
                      ...s.riskBadge,
                      color: RISK_COLOR[item.risk].color,
                      background: RISK_COLOR[item.risk].bg,
                    }}>
                      <span style={{ ...s.riskDot, background: RISK_COLOR[item.risk].dot }} />
                      {item.risk}
                    </span>
                  </div>
                  <div style={s.colStatus}>
                    {item.checked ? (
                      <span style={s.statusDone}>완료</span>
                    ) : (
                      <>
                        <span style={s.statusNeed}>검토 필요</span>
                        <span style={s.arrow}>→</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p style={s.emptyMsg}>이상치 탐지를 완료하면 활성화됩니다.</p>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}

// ─── 스타일 ─────────────────────────────────────────────────────────
const s = {
  root: { minHeight: "100vh", background: "#f7f6f2", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  body: { display: "flex" },
  main: { flex: 1, padding: "40px 48px", maxWidth: 1000 },

  // 페이지 헤더
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  breadcrumb: { fontSize: 12, color: "#aaa", marginBottom: 6, margin: "0 0 6px" },
  pageTitle: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" },
  pageDesc: { fontSize: 14, color: "#888", margin: 0 },
  headerRight: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },

  // 진행 원형
  progressCircle: {
    width: 64, height: 64, borderRadius: "50%",
    border: "2px solid #d0d0d0",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  progressNum: { fontSize: 16, fontWeight: 700, color: "#555" },
  progressLabel: { fontSize: 12, color: "#aaa", margin: 0 },

  // 소명화면 액션 버튼 묶음
  actionBtns: { display: "flex", gap: 10, alignItems: "center", marginTop: 8 },

  divider: { height: 1, background: "#e8e3da", marginBottom: 24 },

  // 탭
  tabBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid #e8e3da", marginBottom: 0, paddingBottom: 8 },
  tab: {
    padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#aaa",
    background: "none", border: "none", cursor: "pointer",
    borderBottom: "2px solid transparent", marginBottom: -1,
    display: "flex", alignItems: "center", gap: 8,
  },
  tabActive: {
    padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "#5C6B2E",
    background: "none", border: "none", cursor: "pointer",
    borderBottom: "2px solid #5C6B2E", marginBottom: -1,
    display: "flex", alignItems: "center", gap: 8,
  },
  tabBadge: { fontSize: 11, background: "#eee", color: "#aaa", borderRadius: 10, padding: "1px 7px" },
  tabBadgeActive: { fontSize: 11, background: "rgba(92,107,46,0.1)", color: "#5C6B2E", borderRadius: 10, padding: "1px 7px" },

  // 리스트
  listWrap: { background: "#fff", border: "1px solid #e8e3da", borderRadius: 8, overflow: "hidden", marginTop: 16, marginBottom: 24 },
  colHeader: {
    display: "flex", alignItems: "center",
    padding: "10px 24px", background: "#fafaf8",
    borderBottom: "1px solid #e8e3da",
    fontSize: 12, color: "#aaa", fontWeight: 500,
  },
  listRow: {
    display: "flex", alignItems: "center",
    padding: "18px 24px", borderBottom: "1px solid #f0ede8",
    cursor: "pointer", transition: "background 0.15s",
  },
  colDp: { flex: 3, display: "flex", flexDirection: "column", gap: 3 },
  colRisk: { flex: 1, display: "flex", alignItems: "center" },
  colStatus: { flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  dpName: { fontSize: 15, fontWeight: 500, color: "#1a1a1a" },
  dpUnit: { fontSize: 12, color: "#aaa" },
  riskBadge: {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
  },
  riskDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  statusNeed: { fontSize: 13, fontWeight: 500, color: "#d97706" },
  statusDone: { fontSize: 13, fontWeight: 600, color: "#16a34a" },
  arrow: { fontSize: 14, color: "#ccc" },
  emptyMsg: { textAlign: "center", padding: "60px 0", color: "#bbb", fontSize: 14 },

  // 다음 버튼
  nextRow: { display: "flex", justifyContent: "flex-end" },

  // 공통 버튼
  btnPrimary: {
    padding: "7px 20px", fontSize: 13, fontWeight: 600,
    background: "#5C6B2E", color: "#fff",
    border: "none", borderRadius: 6, cursor: "pointer",
  },
  btnDisabled: {
    padding: "7px 20px", fontSize: 13, fontWeight: 600,
    background: "#e8e3da", color: "#bbb",
    border: "none", borderRadius: 6, cursor: "not-allowed",
  },
  outlineBtn: {
    padding: "8px 20px", fontSize: 13, fontWeight: 500,
    background: "#fff", color: "#444",
    border: "1px solid #ccc", borderRadius: 6, cursor: "pointer",
  },

  // 2-2-2 소명
  sectionBox: { border: "1px solid #ddd", borderRadius: 8, overflow: "hidden", marginBottom: 16, background: "#fff" },
  sectionHeader: { background: "#eeecea", borderBottom: "1px solid #ddd", padding: "14px 20px", fontSize: 14, fontWeight: 700, color: "#222" },
  sectionBody: { padding: "20px", background: "#fff" },
  llmText: { fontSize: 14, color: "#444", lineHeight: 1.9, margin: 0 },
  editBox: { border: "1px solid #e8e3da", borderRadius: 8, padding: "20px 24px", background: "#fff" },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 14 },
  th: { background: "#f0f0ec", border: "1px solid #e0e0da", padding: "10px", fontWeight: 600, textAlign: "center", color: "#444" },
  td: { border: "1px solid #e0e0da", padding: "10px", textAlign: "center", color: "#333" },
  tableInput: { width: "80%", padding: "6px 10px", fontSize: 14, border: "1px solid #ccc", borderRadius: 4, textAlign: "center", outline: "none" },
  reasonLabel: { fontSize: 14, fontWeight: 600, color: "#333", margin: "0 0 8px" },
  textarea: { width: "100%", padding: "12px 14px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" },
};