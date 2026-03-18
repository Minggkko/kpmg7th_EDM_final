import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// ─── 이상치 정보 (dpId 기준으로 매핑) ───────────────────────────────
const ANOMALIES = {
  1:  { risk: "높음", prevValue: "1,050.3", llmReason: "전년 대비 51.2% 급증하여 통계적 이상치로 탐지되었습니다. 설비 변경, 연료 전환, 또는 측정 오류 여부를 확인해 주세요." },
  5:  { risk: "중간", prevValue: "887.2",   llmReason: "일반폐기물 반출량이 전년 대비 39% 증가하였습니다. 폐기물 분류 기준 변경 여부를 확인해 주세요." },
  16: { risk: "중간", prevValue: "23,400.0",llmReason: "전력 사용량이 전년 대비 21.6% 증가하였습니다. 신규 설비 도입 여부를 검토할 필요가 있습니다." },
  18: { risk: "높음", prevValue: "28,900.0",llmReason: "용수 사용량이 전년 대비 119% 급증하여 데이터 입력 오류 가능성이 높습니다. 단위(톤 vs 리터) 혼동을 점검해 주세요." },
};

const RISK_COLOR = {
  높음: { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", dot: "#dc2626" },
  중간: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b" },
  낮음: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e" },
};

const ISSUES = [
  {
    id: 1, name: "ISSUE ①",
    indicators: [
      {
        id: 101, name: "온실가스 배출량",
        data: [
          { id: 1001, label: "Data1", category: "에너지원별 사용량", dps: [
            { id: 1,  name: "Scope 1 직접배출량",         unit: "tCO₂e", value: "1,245.6", period: "2023" },
            { id: 2,  name: "Scope 2 간접배출량 (전력)",   unit: "tCO₂e", value: "892.3",   period: "2023" },
            { id: 3,  name: "Scope 2 간접배출량 (열·스팀)",unit: "tCO₂e", value: "134.7",   period: "2023" },
            { id: 4,  name: "Scope 3 기타 간접배출량",     unit: "tCO₂e", value: "3,012.1", period: "2023" },
          ]},
          { id: 1002, label: "Data2", category: "폐기물 반출량", dps: [
            { id: 5,  name: "일반폐기물 반출량", unit: "톤", value: "1,234.0", period: "2023" },
            { id: 6,  name: "지정폐기물 반출량", unit: "톤", value: "87.5",    period: "2023" },
            { id: 7,  name: "재활용 폐기물량",   unit: "톤", value: "456.2",   period: "2023" },
          ]},
          { id: 1003, label: "Data3", category: "약품 사용량", dps: [
            { id: 8,  name: "유해화학물질 사용량", unit: "톤", value: "23.4",  period: "2023" },
            { id: 9,  name: "일반화학물질 사용량", unit: "톤", value: "156.8", period: "2023" },
          ]},
          { id: 1004, label: "Data4", category: "오염 물질 배출량", dps: [
            { id: 10, name: "대기오염물질 배출량 (NOx)", unit: "톤", value: "12.3", period: "2023" },
            { id: 11, name: "대기오염물질 배출량 (SOx)", unit: "톤", value: "4.7",  period: "2023" },
            { id: 12, name: "수질오염물질 배출량 (BOD)", unit: "톤", value: "0.89", period: "2023" },
          ]},
        ],
      },
      {
        id: 102, name: "에너지",
        data: [
          { id: 2001, label: "Data1", category: "에너지 소비량", dps: [
            { id: 13, name: "총 에너지 소비량",  unit: "GJ",     value: "45,678.9", period: "2023" },
            { id: 14, name: "재생에너지 사용량", unit: "GJ",     value: "3,210.0",  period: "2023" },
            { id: 15, name: "에너지 집약도",     unit: "GJ/억원",value: "12.4",     period: "2023" },
          ]},
          { id: 2002, label: "Data2", category: "전력 소비량", dps: [
            { id: 16, name: "총 전력 소비량", unit: "MWh", value: "28,450.0", period: "2023" },
            { id: 17, name: "자가 발전량",    unit: "MWh", value: "1,200.0",  period: "2023" },
          ]},
        ],
      },
    ],
  },
  {
    id: 2, name: "ISSUE ②",
    indicators: [
      {
        id: 201, name: "용수",
        data: [
          { id: 3001, label: "Data1", category: "용수 사용량", dps: [
            { id: 18, name: "총 용수 취수량",  unit: "톤", value: "89,234.0", period: "2023" },
            { id: 19, name: "상수도 사용량",   unit: "톤", value: "45,600.0", period: "2023" },
            { id: 20, name: "지하수 사용량",   unit: "톤", value: "43,634.0", period: "2023" },
          ]},
          { id: 3002, label: "Data2", category: "용수 재사용량", dps: [
            { id: 21, name: "재이용수량", unit: "톤", value: "12,340.0", period: "2023" },
            { id: 22, name: "재이용률",   unit: "%",  value: "13.8",     period: "2023" },
          ]},
        ],
      },
      {
        id: 202, name: "사회",
        data: [
          { id: 4001, label: "Data1", category: "임직원 현황", dps: [
            { id: 23, name: "총 임직원 수",      unit: "명", value: "3,456", period: "2023" },
            { id: 24, name: "여성 임직원 비율",   unit: "%",  value: "28.4", period: "2023" },
            { id: 25, name: "신규 채용 인원",     unit: "명", value: "234",  period: "2023" },
          ]},
        ],
      },
    ],
  },
];

export default function StandardDataView({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [activeIssueIdx, setActiveIssueIdx] = useState(0);
  const [activeIndicatorIdx, setActiveIndicatorIdx] = useState(0);
  const [activeDataIdx, setActiveDataIdx] = useState(0);
  const [confirmedData, setConfirmedData] = useState(new Set());
  const [clearedAnomalies, setClearedAnomalies] = useState(new Set()); // 소명 완료된 이상치

  // 팝업 상태
  const [popup, setPopup] = useState(null);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  const currentIssue = ISSUES[activeIssueIdx];
  const currentIndicator = currentIssue.indicators[activeIndicatorIdx];
  const currentData = currentIndicator.data[activeDataIdx];

  const isDataDone = (dataId) => confirmedData.has(dataId);
  const isIndicatorDone = (ind) => ind.data.every((d) => isDataDone(d.id));
  const isIssueDone = (issue) => issue.indicators.every((i) => isIndicatorDone(i));
  const allDone = ISSUES.every((issue) => isIssueDone(issue));

  // 현재 data의 이상치 미소명 항목 수
  const currentDataAnomalyCount = currentData.dps.filter(
    (dp) => ANOMALIES[dp.id] && !clearedAnomalies.has(dp.id)
  ).length;

  const handleConfirmData = () => {
    setConfirmedData((prev) => new Set([...prev, currentData.id]));
  };

  // 이상치 소명 확인
  const handleAnomalyConfirm = () => {
    setClearedAnomalies((prev) => new Set([...prev, popup.dpId]));
    setPopup(null);
    setNewValue("");
    setReason("");
  };

  // 확인 버튼 활성 조건: 현재 data의 모든 이상치가 소명 완료
  const canConfirmData = currentDataAnomalyCount === 0 && !isDataDone(currentData.id);

  const diff = newValue !== "" && !isNaN(Number(newValue)) && popup
    ? (Number(newValue) - Number(popup.prevValue.replace(/,/g, ""))).toLocaleString()
    : null;

  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>

          {/* 이슈 네비게이션 바 */}
          <div style={s.issueBar}>
            <div style={s.issueTabs}>
              {ISSUES.map((issue, idx) => {
                const done = isIssueDone(issue);
                const active = idx === activeIssueIdx;
                return (
                  <button
                    key={issue.id}
                    style={{ ...s.issueTab, ...(active ? s.issueTabActive : {}), ...(done && !active ? s.issueTabDone : {}) }}
                    onClick={() => { setActiveIssueIdx(idx); setActiveIndicatorIdx(0); setActiveDataIdx(0); }}
                  >
                    {done && <span>✓ </span>}{issue.name}
                  </button>
                );
              })}
            </div>
            <button
              style={allDone ? s.verifyBtn : s.verifyBtnDisabled}
              disabled={!allDone}
              onClick={() => navigate("/consistency-check")}
            >
              검증
            </button>
          </div>

          <div style={s.contentArea}>
            {/* 좌측 지표 패널 */}
            <div style={s.indicatorPanel}>
              {currentIssue.indicators.map((ind, idx) => {
                const done = isIndicatorDone(ind);
                const active = idx === activeIndicatorIdx;
                return (
                  <button
                    key={ind.id}
                    style={{ ...s.indicatorBtn, ...(active ? s.indicatorBtnActive : {}), ...(done && !active ? s.indicatorBtnDone : {}) }}
                    onClick={() => { setActiveIndicatorIdx(idx); setActiveDataIdx(0); }}
                  >
                    <span style={{ fontSize: 10, color: active ? "#fff" : "#aaa" }}>지표 {idx + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: active ? "#fff" : done ? "#16a34a" : "#1a1a1a" }}>
                      {ind.name}
                    </span>
                    {done && !active && <span style={s.indicatorCheck}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* 우측 데이터 패널 */}
            <div style={s.dataPanel}>
              {/* Data 탭 */}
              <div style={s.dataTabs}>
                {currentIndicator.data.map((data, idx) => {
                  const done = isDataDone(data.id);
                  const active = idx === activeDataIdx;
                  // 이 data탭의 이상치 미소명 수
                  const anomalyCount = data.dps.filter(
                    (dp) => ANOMALIES[dp.id] && !clearedAnomalies.has(dp.id)
                  ).length;
                  return (
                    <button
                      key={data.id}
                      style={{ ...s.dataTab, ...(active ? s.dataTabActive : {}), ...(done && !active ? s.dataTabDone : {}) }}
                      onClick={() => setActiveDataIdx(idx)}
                    >
                      <span style={{ fontSize: 11, color: "#aaa" }}>{data.category}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#5C6B2E" : done ? "#16a34a" : "#888" }}>
                        {done ? "✓ " : ""}{data.label}
                      </span>
                      {anomalyCount > 0 && !done && (
                        <span style={s.anomalyTabBadge}>{anomalyCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* DP 테이블 */}
              <div style={s.dpArea}>
                <div style={s.dpHeader}>
                  <div>
                    <span style={s.dpTitle}>{currentData.category}</span>
                    <span style={s.dpSubtitle}>총 {currentData.dps.length}개 데이터 포인트</span>
                    {currentDataAnomalyCount > 0 && (
                      <span style={s.anomalyAlert}>⚠ 이상치 {currentDataAnomalyCount}건 — 클릭하여 소명하세요</span>
                    )}
                  </div>
                  {isDataDone(currentData.id) && <span style={s.doneBadge}>✓ 확인 완료</span>}
                </div>

                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>데이터 포인트</th>
                      <th style={s.th}>단위</th>
                      <th style={s.th}>수집 기간</th>
                      <th style={s.th}>값</th>
                      <th style={s.th}>이상치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.dps.map((dp, idx) => {
                      const anomaly = ANOMALIES[dp.id];
                      const cleared = clearedAnomalies.has(dp.id);
                      const rc = anomaly ? RISK_COLOR[anomaly.risk] : null;
                      return (
                        <tr
                          key={dp.id}
                          style={{
                            background: anomaly && !cleared ? rc.bg : idx % 2 === 0 ? "#fff" : "#fdfcf9",
                            cursor: anomaly && !cleared ? "pointer" : "default",
                          }}
                          onClick={() => {
                            if (anomaly && !cleared) {
                              setPopup({ ...dp, dpId: dp.id, anomaly, prevValue: anomaly.prevValue });
                              setNewValue("");
                              setReason("");
                            }
                          }}
                        >
                          <td style={{ ...s.td, fontWeight: 500, color: anomaly && !cleared ? rc.color : "#222" }}>
                            {dp.name}
                            {anomaly && !cleared && (
                              <span style={{ ...s.riskDot, background: rc.dot }} />
                            )}
                          </td>
                          <td style={{ ...s.td, textAlign: "center", color: "#888" }}>{dp.unit}</td>
                          <td style={{ ...s.td, textAlign: "center", color: "#888" }}>{dp.period}</td>
                          <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: anomaly && !cleared ? rc.color : "#1a1a1a" }}>
                            {dp.value}
                          </td>
                          <td style={{ ...s.td, textAlign: "center" }}>
                            {anomaly ? (
                              cleared ? (
                                <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>소명완료</span>
                              ) : (
                                <span style={{ ...s.riskBadge, color: rc.color, background: "#fff", border: `1px solid ${rc.border}` }}>
                                  {anomaly.risk}
                                </span>
                              )
                            ) : (
                              <span style={{ fontSize: 12, color: "#ccc" }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={s.confirmRow}>
                  <button
                    style={canConfirmData ? s.confirmBtn : s.confirmBtnDisabled}
                    disabled={!canConfirmData}
                    onClick={handleConfirmData}
                  >
                    {isDataDone(currentData.id) ? "✓ 확인 완료" : currentDataAnomalyCount > 0 ? `이상치 ${currentDataAnomalyCount}건 소명 필요` : "확인"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── 이상치 소명 팝업 ── */}
      {popup && (
        <div style={s.overlay} onClick={() => setPopup(null)}>
          <div style={s.popupBox} onClick={(e) => e.stopPropagation()}>
            <div style={s.popupHeader}>
              <div>
                <p style={s.popupBreadcrumb}>이상치 소명</p>
                <h2 style={s.popupTitle}>{popup.name}</h2>
              </div>
              <button style={s.closeBtn} onClick={() => setPopup(null)}>✕</button>
            </div>
            <div style={s.popupDivider} />

            {/* 위험도 */}
            <div style={{ ...s.riskBox, background: RISK_COLOR[popup.anomaly.risk].bg, border: `1px solid ${RISK_COLOR[popup.anomaly.risk].border}` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: RISK_COLOR[popup.anomaly.risk].color }}>
                위험도: {popup.anomaly.risk}
              </span>
            </div>

            {/* LLM 추론 */}
            <div style={s.llmBox}>
              <p style={s.llmLabel}>이상치 추론 (LLM) 내역</p>
              <p style={s.llmText}>{popup.anomaly.llmReason}</p>
            </div>

            {/* 수정 폼 */}
            <table style={s.popupTable}>
              <thead>
                <tr>
                  <th style={s.popupTh}>이전값</th>
                  <th style={s.popupTh}>수정값</th>
                  <th style={s.popupTh}>차이값</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...s.popupTd, color: "#888" }}>{popup.prevValue} {popup.unit}</td>
                  <td style={s.popupTd}>
                    <input
                      style={s.tableInput}
                      placeholder="[입력]"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                    />
                  </td>
                  <td style={{ ...s.popupTd, color: diff ? (parseFloat(diff) > 0 ? "#dc2626" : "#16a34a") : "#aaa" }}>
                    {diff !== null ? (parseFloat(diff) > 0 ? `+${diff}` : diff) : "-"}
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
              rows={3}
            />

            <div style={s.popupBtns}>
              <button style={s.cancelBtn} onClick={() => setPopup(null)}>취소</button>
              <button style={s.confirmPopupBtn} onClick={handleAnomalyConfirm}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────────
const s = {
  root: { minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  body: { display: "flex" },
  main: { flex: 1, padding: "32px 40px", minHeight: "calc(100vh - 60px)" },

  issueBar: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e8e3da", borderRadius: 10, padding: "12px 20px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  issueTabs: { display: "flex", gap: 8 },
  issueTab: { padding: "8px 22px", fontSize: 14, fontWeight: 600, background: "#f5f3ed", color: "#888", border: "1px solid #e0dbd0", borderRadius: 6, cursor: "pointer" },
  issueTabActive: { background: "#5C6B2E", color: "#fff", border: "1px solid #5C6B2E" },
  issueTabDone: { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" },
  verifyBtn: { padding: "9px 28px", fontSize: 14, fontWeight: 700, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  verifyBtnDisabled: { padding: "9px 28px", fontSize: 14, fontWeight: 700, background: "#e8e3da", color: "#bbb", border: "none", borderRadius: 6, cursor: "not-allowed" },

  contentArea: { display: "flex", gap: 16, alignItems: "flex-start" },

  indicatorPanel: { width: 160, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 },
  indicatorBtn: { width: "100%", padding: "14px", textAlign: "left", background: "#fff", border: "1px solid #e8e3da", borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, position: "relative" },
  indicatorBtnActive: { background: "#5C6B2E", border: "1px solid #5C6B2E" },
  indicatorBtnDone: { background: "#f0fdf4", border: "1px solid #bbf7d0" },
  indicatorCheck: { position: "absolute", top: 10, right: 10, fontSize: 12, color: "#16a34a", fontWeight: 700 },

  dataPanel: { flex: 1, background: "#fff", border: "1px solid #e8e3da", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  dataTabs: { display: "flex", borderBottom: "1px solid #e8e3da", overflowX: "auto" },
  dataTab: { flexShrink: 0, padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, background: "#faf8f4", border: "none", borderRight: "1px solid #e8e3da", cursor: "pointer", minWidth: 120, position: "relative" },
  dataTabActive: { background: "#fff", borderBottom: "2px solid #5C6B2E" },
  dataTabDone: { background: "#f0fdf4" },
  anomalyTabBadge: { position: "absolute", top: 8, right: 8, background: "#dc2626", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 5px" },

  dpArea: { padding: "20px 24px" },
  dpHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  dpTitle: { fontSize: 16, fontWeight: 700, color: "#1a1a1a", display: "block" },
  dpSubtitle: { fontSize: 12, color: "#aaa", display: "block", marginTop: 2 },
  anomalyAlert: { display: "block", fontSize: 12, color: "#d97706", fontWeight: 600, marginTop: 4 },
  doneBadge: { fontSize: 12, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 12px" },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 20 },
  th: { background: "#f5f3ed", border: "1px solid #e8e3da", padding: "10px 14px", fontWeight: 600, color: "#555", textAlign: "left", fontSize: 12 },
  td: { border: "1px solid #eee", padding: "11px 14px", color: "#333", transition: "background 0.1s" },
  riskDot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", marginLeft: 6, verticalAlign: "middle" },
  riskBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20 },

  confirmRow: { display: "flex", justifyContent: "flex-end" },
  confirmBtn: { padding: "9px 28px", fontSize: 13, fontWeight: 600, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  confirmBtnDisabled: { padding: "9px 28px", fontSize: 13, fontWeight: 600, background: "#e8e3da", color: "#888", border: "none", borderRadius: 6, cursor: "not-allowed" },

  // 팝업
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  popupBox: { background: "#fff", borderRadius: 12, padding: "28px 32px", width: 600, maxWidth: "92vw", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" },
  popupHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  popupBreadcrumb: { fontSize: 12, color: "#aaa", margin: "0 0 4px" },
  popupTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: 18, color: "#aaa", cursor: "pointer" },
  popupDivider: { height: 1, background: "#e8e3da", marginBottom: 16 },
  riskBox: { display: "inline-flex", alignItems: "center", borderRadius: 6, padding: "6px 14px", marginBottom: 14 },
  llmBox: { background: "#fafaf8", border: "1px solid #e8e3da", borderRadius: 8, padding: "14px 16px", marginBottom: 16 },
  llmLabel: { fontSize: 11, fontWeight: 700, color: "#5C6B2E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" },
  llmText: { fontSize: 13, color: "#444", lineHeight: 1.75, margin: 0 },
  popupTable: { width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 14 },
  popupTh: { background: "#f5f3ed", border: "1px solid #e8e3da", padding: "10px", fontWeight: 600, textAlign: "center", color: "#555", fontSize: 12 },
  popupTd: { border: "1px solid #e8e3da", padding: "12px 10px", textAlign: "center", color: "#333" },
  tableInput: { width: "80%", padding: "6px 10px", fontSize: 14, border: "1px solid #ccc", borderRadius: 4, textAlign: "center", outline: "none" },
  reasonLabel: { fontSize: 13, fontWeight: 600, color: "#333", margin: "0 0 6px" },
  textarea: { width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid #ccc", borderRadius: 6, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 },
  popupBtns: { display: "flex", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { padding: "9px 22px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#444", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" },
  confirmPopupBtn: { padding: "9px 22px", fontSize: 13, fontWeight: 600, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
};