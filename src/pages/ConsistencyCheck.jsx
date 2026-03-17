import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// ─── 더미 데이터 ─────────────────────────────────────────────────────
const INDICATORS = [
  {
    id: 1,
    name: "온실가스 배출량",
    items: [
      {
        id: 1,
        dpName: "Scope 1 직접배출량",
        unit: "tCO₂e",
        result: "검증 실패 - 범위 초과",
        inputValue: 151.2,
        evidenceDoc: "환경부 온실가스 배출권 거래제 명세서 (2023)",
        evidenceValue: 148.7,
        checked: false,
      },
      {
        id: 2,
        dpName: "에너지원별 사용량 - 전력",
        unit: "MWh",
        result: "검증 실패 - 타입 오류",
        inputValue: 24320,
        evidenceDoc: "한국전력 전력사용확인서 (2023)",
        evidenceValue: 24100,
        checked: false,
      },
      {
        id: 3,
        dpName: "용수 사용량",
        unit: "톤",
        result: "검증 실패 - 필수값 없음",
        inputValue: 62400,
        evidenceDoc: "상수도 사용량 내역서 (2023 연간)",
        evidenceValue: 31200,
        checked: false,
      },
    ],
  },
  {
    id: 2,
    name: "사회·안전",
    items: [
      {
        id: 4,
        dpName: "산업재해율",
        unit: "%",
        result: "검증 실패 - 범위 초과",
        inputValue: 0.00,
        evidenceDoc: "안전보건관리시스템 재해 기록부 (2023)",
        evidenceValue: 0.12,
        checked: false,
      },
      {
        id: 5,
        dpName: "일반폐기물 반출량",
        unit: "톤",
        result: "검증 실패 - 타입 오류",
        inputValue: 1238,
        evidenceDoc: "폐기물 처리업체 반출 확인서 (2023)",
        evidenceValue: 1190,
        checked: false,
      },
    ],
  },
];

const TABS = ["이상치 탐지", "정합성 탐지", "미증빙 자료"];

export default function ConsistencyCheck({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("정합성 탐지");
  const [activeIndicatorIdx, setActiveIndicatorIdx] = useState(0);
  const [indicators, setIndicators] = useState(INDICATORS);
  const [popup, setPopup] = useState(null); // 선택된 항목

  const currentIndicator = indicators[activeIndicatorIdx];
  const allItems = indicators.flatMap((ind) => ind.items);
  const checkedCount = allItems.filter((i) => i.checked).length;
  const allChecked = checkedCount === allItems.length;

  const handleRowClick = (item) => {
    setPopup(item);
  };

  const handleClosePopup = () => {
    setPopup(null);
  };

  // 증빙자료로 수정
  const handleReplaceWithEvidence = () => {
    setIndicators((prev) =>
      prev.map((ind) => ({
        ...ind,
        items: ind.items.map((i) =>
          i.id === popup.id
            ? { ...i, inputValue: i.evidenceValue, checked: true }
            : i
        ),
      }))
    );
    setPopup(null);
  };

  // 입력값 유지 (소명 완료 처리)
  const handleKeepInput = () => {
    setIndicators((prev) =>
      prev.map((ind) => ({
        ...ind,
        items: ind.items.map((i) =>
          i.id === popup.id ? { ...i, checked: true } : i
        ),
      }))
    );
    setPopup(null);
  };

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
              <h1 style={s.pageTitle}>정합성 검증</h1>
              <p style={s.pageDesc}>증빙자료와 불일치하는 항목을 확인하고 소명해 주세요.</p>
            </div>
            <div style={s.headerRight}>
              <div style={s.progressCircle}>
                <span style={s.progressNum}>
                  <span style={{ color: "#5C6B2E" }}>{checkedCount}</span>/{allItems.length}
                </span>
              </div>
              <p style={s.progressLabel}>검토 완료</p>
            </div>
          </div>

          <div style={s.divider} />

          {/* 상단 탭 + 다음 버튼 */}
          <div style={s.tabBar}>
            <div style={{ display: "flex" }}>
              {TABS.map((tab) => (
                <button
                  key={tab}
                  style={activeTab === tab ? s.tabActive : s.tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              style={allChecked ? s.btnPrimary : s.btnDisabled}
              disabled={!allChecked}
              onClick={() => navigate("/data-input-request")}
            >
              다음 단계로
            </button>
          </div>

          {/* 콘텐츠 영역 */}
          <div style={s.contentArea}>

            {/* 좌측 지표 패널 */}
            <div style={s.indicatorPanel}>
              {indicators.map((ind, idx) => {
                const done = ind.items.every((i) => i.checked);
                const active = idx === activeIndicatorIdx;
                return (
                  <button
                    key={ind.id}
                    style={{
                      ...s.indicatorBtn,
                      ...(active ? s.indicatorBtnActive : {}),
                      ...(done && !active ? s.indicatorBtnDone : {}),
                    }}
                    onClick={() => setActiveIndicatorIdx(idx)}
                  >
                    <span style={{
                      ...s.indicatorLabel,
                      color: active ? "#fff" : "#aaa",
                    }}>
                      지표 {idx + 1}
                    </span>
                    <span style={{
                      ...s.indicatorName,
                      color: active ? "#fff" : done ? "#16a34a" : "#1a1a1a",
                    }}>
                      {ind.name}
                    </span>
                    {done && !active && <span style={s.indicatorCheck}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* 우측 테이블 */}
            <div style={s.tablePanel}>
              {/* 컬럼 헤더 */}
              <div style={s.colHeader}>
                <span style={{ ...s.colDp, paddingLeft: 0 }}>데이터 명</span>
                <span style={s.colResult}>정합성 검증결과</span>
                <span style={s.colCheck}>체크박스</span>
              </div>

              {currentIndicator.items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    ...s.listRow,
                    borderBottom: idx < currentIndicator.items.length - 1
                      ? "1px solid #f0ede8" : "none",
                  }}
                  onClick={() => handleRowClick(item)}
                >
                  <div style={s.colDp}>
                    <span style={s.dpName}>{item.dpName}</span>
                    <span style={s.dpUnit}>{item.unit}</span>
                  </div>
                  <div style={s.colResult}>
                    <span style={s.resultBadge}>{item.result}</span>
                  </div>
                  <div style={s.colCheck}>
                    <div style={{
                      ...s.checkbox,
                      ...(item.checked ? s.checkboxChecked : {}),
                    }}>
                      {item.checked && <span style={s.checkMark}>✓</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* ── 팝업 (2-3-2) ── */}
      {popup && (
        <div style={s.overlay} onClick={handleClosePopup}>
          <div style={s.popupBox} onClick={(e) => e.stopPropagation()}>

            {/* 팝업 헤더 */}
            <div style={s.popupHeader}>
              <div>
                <p style={s.popupBreadcrumb}>정합성 소명</p>
                <h2 style={s.popupTitle}>{popup.dpName}</h2>
              </div>
              <button style={s.closeBtn} onClick={handleClosePopup}>✕</button>
            </div>

            <div style={s.popupDivider} />

            {/* 테이블: 입력값 / 증빙자료 / 추출값 */}
            <table style={s.popupTable}>
              <thead>
                <tr>
                  <th style={s.popupTh}>입력값</th>
                  <th style={s.popupTh}>증빙자료</th>
                  <th style={s.popupTh}>추출값</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...s.popupTd, color: "#dc2626", fontWeight: 700 }}>
                    {popup.inputValue.toLocaleString()} {popup.unit}
                  </td>
                  <td style={{ ...s.popupTd, color: "#888", fontSize: 13 }}>
                    {popup.evidenceDoc}
                  </td>
                  <td style={{ ...s.popupTd, color: "#5C6B2E", fontWeight: 700 }}>
                    {popup.evidenceValue.toLocaleString()} {popup.unit}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 차이값 안내 */}
            <div style={s.diffBox}>
              <span style={s.diffLabel}>차이</span>
              <span style={s.diffValue}>
                {(popup.inputValue - popup.evidenceValue > 0 ? "+" : "")}
                {(popup.inputValue - popup.evidenceValue).toLocaleString()} {popup.unit}
              </span>
              <span style={s.diffDesc}>입력값이 증빙자료 추출값과 일치하지 않습니다.</span>
            </div>

            {/* 팝업 버튼 */}
            <div style={s.popupBtns}>
              <button style={s.keepBtn} onClick={handleKeepInput}>
                입력값 유지
              </button>
              <button style={s.replaceBtn} onClick={handleReplaceWithEvidence}>
                증빙자료로 수정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스타일 ─────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: "100vh",
    background: "#FAF8F0",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  body: { display: "flex" },
  main: { flex: 1, padding: "40px 48px", maxWidth: 1000 },

  // 헤더
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  breadcrumb: { fontSize: 12, color: "#aaa", margin: "0 0 6px" },
  pageTitle: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" },
  pageDesc: { fontSize: 14, color: "#888", margin: 0 },
  headerRight: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  progressCircle: {
    width: 64, height: 64, borderRadius: "50%",
    border: "2px solid #d0d0d0",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  progressNum: { fontSize: 16, fontWeight: 700, color: "#555" },
  progressLabel: { fontSize: 12, color: "#aaa", margin: 0 },

  divider: { height: 1, background: "#e8e3da", marginBottom: 24 },

  // 탭바
  tabBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: "1px solid #e8e3da",
    marginBottom: 20,
    paddingBottom: 8,
  },
  tab: {
    padding: "10px 20px", fontSize: 14, fontWeight: 500, color: "#aaa",
    background: "none", border: "none", cursor: "pointer",
    borderBottom: "2px solid transparent", marginBottom: -9,
  },
  tabActive: {
    padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "#5C6B2E",
    background: "none", border: "none", cursor: "pointer",
    borderBottom: "2px solid #5C6B2E", marginBottom: -9,
  },

  // 버튼
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

  // 콘텐츠
  contentArea: { display: "flex", gap: 16, alignItems: "flex-start" },

  // 지표 패널
  indicatorPanel: { width: 140, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 },
  indicatorBtn: {
    width: "100%", padding: "14px 14px", textAlign: "left",
    background: "#fff", border: "1px solid #e8e3da", borderRadius: 8,
    cursor: "pointer", display: "flex", flexDirection: "column", gap: 3,
    position: "relative", transition: "all 0.15s",
  },
  indicatorBtnActive: { background: "#5C6B2E", border: "1px solid #5C6B2E" },
  indicatorBtnDone: { background: "#f0fdf4", border: "1px solid #bbf7d0" },
  indicatorLabel: { fontSize: 10, fontWeight: 600, letterSpacing: "0.05em" },
  indicatorName: { fontSize: 13, fontWeight: 600 },
  indicatorCheck: { position: "absolute", top: 10, right: 10, fontSize: 12, color: "#16a34a", fontWeight: 700 },

  // 테이블 패널
  tablePanel: {
    flex: 1,
    background: "#fff",
    border: "1px solid #e8e3da",
    borderRadius: 8,
    overflow: "hidden",
  },

  // 컬럼 헤더
  colHeader: {
    display: "flex", alignItems: "center",
    padding: "12px 24px",
    background: "#f5f3ed",
    borderBottom: "1px solid #e8e3da",
    fontSize: 13, fontWeight: 600, color: "#555",
  },
  colDp: { flex: 3, display: "flex", flexDirection: "column", gap: 2 },
  colResult: { flex: 3 },
  colCheck: { flex: 1, display: "flex", justifyContent: "center" },

  // 리스트 행
  listRow: {
    display: "flex", alignItems: "center",
    padding: "18px 24px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  dpName: { fontSize: 14, fontWeight: 500, color: "#1a1a1a" },
  dpUnit: { fontSize: 12, color: "#aaa" },
  resultBadge: { fontSize: 13, color: "#d97706", fontWeight: 500 },

  // 체크박스
  checkbox: {
    width: 20, height: 20,
    border: "1.5px solid #ccc",
    borderRadius: 4,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#fff",
  },
  checkboxChecked: {
    background: "#5C6B2E",
    border: "1.5px solid #5C6B2E",
  },
  checkMark: { fontSize: 12, color: "#fff", fontWeight: 700 },

  // ── 팝업 ──
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  popupBox: {
    background: "#fff",
    borderRadius: 12,
    padding: "32px 36px",
    width: 620,
    maxWidth: "90vw",
    boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
  },
  popupHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 16,
  },
  popupBreadcrumb: { fontSize: 12, color: "#aaa", margin: "0 0 4px" },
  popupTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  closeBtn: {
    background: "none", border: "none", fontSize: 18,
    color: "#aaa", cursor: "pointer", padding: 4,
  },
  popupDivider: { height: 1, background: "#e8e3da", marginBottom: 24 },

  // 팝업 테이블
  popupTable: { width: "100%", borderCollapse: "collapse", marginBottom: 20 },
  popupTh: {
    background: "#f5f3ed",
    border: "1px solid #e8e3da",
    padding: "12px 16px",
    fontWeight: 600, fontSize: 13, color: "#555",
    textAlign: "center",
  },
  popupTd: {
    border: "1px solid #e8e3da",
    padding: "18px 16px",
    textAlign: "center",
    fontSize: 15,
    color: "#333",
  },

  // 차이값 박스
  diffBox: {
    display: "flex", alignItems: "center", gap: 10,
    background: "#fff8ed",
    border: "1px solid #fde68a",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 24,
  },
  diffLabel: { fontSize: 12, fontWeight: 600, color: "#92400e" },
  diffValue: { fontSize: 14, fontWeight: 700, color: "#d97706" },
  diffDesc: { fontSize: 12, color: "#92400e", flex: 1 },

  // 팝업 버튼
  popupBtns: { display: "flex", justifyContent: "flex-end", gap: 10 },
  keepBtn: {
    padding: "9px 22px", fontSize: 13, fontWeight: 500,
    background: "#fff", color: "#444",
    border: "1px solid #ccc", borderRadius: 6, cursor: "pointer",
  },
  replaceBtn: {
    padding: "9px 22px", fontSize: 13, fontWeight: 600,
    background: "#5C6B2E", color: "#fff",
    border: "none", borderRadius: 6, cursor: "pointer",
  },
};