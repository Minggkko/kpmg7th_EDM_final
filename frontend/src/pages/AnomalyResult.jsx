import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// ─── 더미 데이터 ────────────────────────────────────────────────────
const DUMMY_ANOMALY = [
  { id: 1, dpName: "온실가스 배출량 (Scope 1)", unit: "tCO₂e", risk: "높음", prevValue: 100, llmReason: "전년 대비 51.2% 급증하여 통계적 이상치로 탐지되었습니다. 동종 업계 평균 증가율(+3.8%)을 크게 상회하며, 내부 생산량 증가율(+5.1%)과도 불일치합니다. 설비 변경, 연료 전환, 또는 측정 오류 여부를 확인해 주세요.", checked: false },
  { id: 2, dpName: "에너지원별 사용량 - 전력", unit: "MWh", risk: "중간", prevValue: 200, llmReason: "전력 사용량이 전년 대비 21.6% 증가하였습니다. 생산 증가율(+5.1%)과 비교 시 괴리가 크며, 하계 냉방 수요 증가 또는 신규 설비 도입 여부를 검토할 필요가 있습니다.", checked: false },
  { id: 3, dpName: "용수 사용량", unit: "톤", risk: "높음", prevValue: 300, llmReason: "용수 사용량이 전년 대비 119% 이상 급증하여 데이터 입력 오류 가능성이 높습니다. 단위(톤 vs 리터) 혼동 또는 측정 기간 오류를 우선 점검해 주세요.", checked: false },
  { id: 4, dpName: "산업재해율", unit: "%", risk: "낮음", prevValue: 0.42, llmReason: "산업재해율이 0.00%로 기록되었습니다. 업종 평균(0.45%) 대비 이례적으로 낮으며, 미보고 사고가 있거나 집계 기준이 변경되었을 가능성을 확인해 주세요.", checked: false },
  { id: 5, dpName: "폐기물 반출량 - 일반폐기물", unit: "톤", risk: "중간", prevValue: 890, llmReason: "일반폐기물 반출량이 전년 대비 39% 증가하였습니다. 생산량 증가율(+5.1%)에 비해 과도한 증가로 판단되며, 폐기물 분류 기준 변경 여부를 확인해 주세요.", checked: false },
];

const DUMMY_CONSISTENCY = [
  { id: 1, dpName: "온실가스 배출량 (Scope 1)", unit: "tCO₂e", error: "타입 오류", inputValue: 1000, evidenceValue: 1050, checked: false },
  { id: 2, dpName: "에너지원별 사용량 - 전력", unit: "MWh", error: "범위 초과", inputValue: 850, evidenceValue: 920, checked: false },
  { id: 3, dpName: "용수 사용량", unit: "톤", error: "필수값 없음", inputValue: null, evidenceValue: 340, checked: false },
];

const DUMMY_UNVERIFIED = [
  { id: 1, dpName: "온실가스 배출량 (Scope 3)", unit: "tCO₂e", value: "2,450", info: "협력사 제출 자료 미수령으로 인해 증빙자료가 없습니다. 해당 수치는 내부 추정값으로 입력되었습니다.", checked: false },
  { id: 2, dpName: "재생에너지 사용 비율", unit: "%", value: "18.4", info: "인증서 유효기간이 만료되어 증빙자료로 인정되지 않습니다. 갱신 후 재첨부가 필요합니다.", checked: false },
  { id: 3, dpName: "여성 임원 비율", unit: "%", value: "12.5", info: "내부 인사 자료가 첨부되지 않았습니다. HR팀에 자료 제공을 요청하세요.", checked: false },
  { id: 4, dpName: "용수 재이용률", unit: "%", value: "34.2", info: "측정 기관의 공식 보고서가 아직 수령되지 않았습니다.", checked: false },
  { id: 5, dpName: "사회공헌 투자액", unit: "백만원", value: "1,200", info: "증빙 서류가 현재 작성 중입니다. 완료 후 첨부해 주세요.", checked: false },
];

// ─── 컬러 토큰 ───────────────────────────────────────────────────────
const C = {
  olive:       "#41431B",
  oliveFaint:  "rgba(65,67,27,0.08)",
  sage:        "#AEB784",
  sageFaint:   "#EEF2E3",
  bg:          "#FAF8F0",
  surface:     "#FFFFFF",
  surfaceWarm: "#F7F5EE",
  border:      "#E4DFD2",
  borderLight: "#EDE9DF",
  textPrimary: "#1A1A14",
  textSec:     "#6B6860",
  textTer:     "#A8A49A",
};

const RISK_COLOR = {
  높음: { color: "#C0392B", bg: "#FDF2F0", dot: "#E74C3C" },
  중간: { color: "#B8650A", bg: "#FDF6EC", dot: "#E67E22" },
  낮음: { color: "#4A6020", bg: C.sageFaint, dot: C.sage },
};

const ERROR_COLOR = {
  "타입 오류":   { color: "#C0392B", bg: "#FDF2F0", dot: "#E74C3C" },
  "범위 초과":   { color: "#B8650A", bg: "#FDF6EC", dot: "#E67E22" },
  "필수값 없음": { color: "#C0392B", bg: "#FDF2F0", dot: "#E74C3C" },
};

const TABS = ["이상치 탐지", "정합성 탐지", "미증빙 자료"];

export default function AnomalyResult({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("이상치 탐지");

  // 이상치
  const [anomalyItems, setAnomalyItems] = useState(DUMMY_ANOMALY);
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  // 정합성
  const [consItems, setConsItems] = useState(DUMMY_CONSISTENCY);
  const [selectedCons, setSelectedCons] = useState(null);

  // 미증빙
  const [unverItems, setUnverItems] = useState(DUMMY_UNVERIFIED);
  const [selectedUnver, setSelectedUnver] = useState(null);
  const [unverReason, setUnverReason] = useState("");

  const anomalyDone = anomalyItems.filter(i => i.checked).length;
  const consDone    = consItems.filter(i => i.checked).length;
  const unverDone   = unverItems.filter(i => i.checked).length;
  const totalDone   = anomalyDone + consDone + unverDone;
  const totalCount  = anomalyItems.length + consItems.length + unverItems.length;
  const allChecked  = totalDone === totalCount;

  // ── 이상치 소명 페이지 ───────────────────────────────────────────
  const diff = newValue !== "" && !isNaN(Number(newValue))
    ? Number(newValue) - selectedAnomaly?.prevValue
    : null;

  const handleAnomalyConfirm = () => {
    setAnomalyItems(prev => prev.map(i =>
      i.id === selectedAnomaly.id
        ? { ...i, checked: true, modifiedValue: newValue || null, modifiedReason: reason || null }
        : i
    ));
    setSelectedAnomaly(null);
  };

  if (selectedAnomaly) {
    return (
      <div style={s.root}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={s.body}>
          <Sidebar />
          <main style={s.main}>
            <div style={s.pageHeader}>
              <div>
                <p style={s.breadcrumb}>데이터 검증 · 이상치 탐지</p>
                <h1 style={s.pageTitle}>{selectedAnomaly.dpName}</h1>
                <p style={s.pageDesc}>이상치 추론 내역을 확인하고 소명해 주세요.</p>
              </div>
              <div style={s.actionBtns}>
                <button style={s.outlineBtn} onClick={() => setSelectedAnomaly(null)}>뒤로</button>
                <button style={s.outlineBtn}>확인 요청</button>
                <button style={s.btnPrimary} onClick={handleAnomalyConfirm}>확인</button>
              </div>
            </div>
            <div style={s.divider} />
            <div style={s.sectionBox}>
              <div style={s.sectionHeader}>이상치 추론 (LLM) 내역</div>
              <div style={s.sectionBody}>
                <p style={s.llmText}>{selectedAnomaly.llmReason}</p>
              </div>
            </div>
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
                    <td style={s.td}>{selectedAnomaly.prevValue.toLocaleString()}</td>
                    <td style={s.td}>
                      <input style={s.tableInput} placeholder="[입력]" value={newValue} onChange={e => setNewValue(e.target.value)} />
                    </td>
                    <td style={{ ...s.td, color: diff != null ? (diff > 0 ? "#C0392B" : C.olive) : C.textTer, fontWeight: diff != null ? 600 : 400 }}>
                      {diff != null ? (diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()) : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p style={s.reasonLabel}>이유</p>
              <textarea style={s.textarea} placeholder="[이유를 입력하세요]" value={reason} onChange={e => setReason(e.target.value)} rows={4} />
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── 미증빙 소명 페이지 ───────────────────────────────────────────
  const handleUnverConfirm = () => {
    setUnverItems(prev => prev.map(i =>
      i.id === selectedUnver.id ? { ...i, checked: true } : i
    ));
    setSelectedUnver(null);
  };

  if (selectedUnver) {
    return (
      <div style={s.root}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={s.body}>
          <Sidebar />
          <main style={s.main}>
            <div style={s.sectionBox}>
              <div style={s.sectionHeader}>
                <span>{selectedUnver.dpName}의 미증빙 자료 소명</span>
                <div style={s.headerBtns}>
                  <button style={s.iconBtn} title="담당자에게 요청">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8H14M9.5 3.5L14 8L9.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button style={s.outlineBtn} onClick={() => setSelectedUnver(null)}>뒤로</button>
                  <button style={s.btnPrimary} onClick={handleUnverConfirm}>확정</button>
                </div>
              </div>
              <div style={s.sectionBody}>
                <p style={s.llmText}>{selectedUnver.info}</p>
                <div style={s.valuePill}>
                  <span style={s.valuePillLabel}>현재 입력값</span>
                  <span style={s.valuePillVal}>{selectedUnver.value} <span style={{ fontSize: 13, fontWeight: 400, color: C.textSec }}>{selectedUnver.unit}</span></span>
                </div>
              </div>
            </div>
            <div style={s.editBox}>
              <p style={s.reasonLabel}>이유</p>
              <textarea style={s.textarea} placeholder="[이유를 입력하세요]" value={unverReason} onChange={e => setUnverReason(e.target.value)} rows={5} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button style={s.btnPrimary} onClick={handleUnverConfirm}>확정</button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── 목록 화면 (3탭) ─────────────────────────────────────────────
  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>

          <div style={s.pageHeader}>
            <div>
              <p style={s.breadcrumb}>데이터 검증</p>
              <h1 style={s.pageTitle}>데이터 검증</h1>
              <p style={s.pageDesc}>AI가 탐지한 이상치 및 정합성 오류 항목을 검토하고 소명해 주세요.</p>
            </div>
            <div style={s.headerRight}>
              <div style={s.progressCircle}>
                <span style={s.progressNum}>
                  <span style={{ color: C.olive }}>{totalDone}</span>
                  <span style={{ color: C.textTer }}>/{totalCount}</span>
                </span>
              </div>
              <p style={s.progressLabel}>검토 완료</p>
            </div>
          </div>

          <div style={s.divider} />

          {/* 탭 + 버튼 */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, marginBottom: 0 }}>
            <div style={{ display: "flex" }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  style={activeTab === tab ? s.tabActive : s.tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                  <span style={activeTab === tab ? s.tabBadgeActive : s.tabBadge}>
                    {tab === "이상치 탐지" ? anomalyItems.length : tab === "정합성 탐지" ? consItems.length : unverItems.length}
                  </span>
                </button>
              ))}
            </div>
            {activeTab === "미증빙 자료" ? (
              <button
                style={unverItems.every(i => i.checked) ? s.btnPrimary : s.btnDisabled}
                disabled={!unverItems.every(i => i.checked)}
                onClick={() => navigate("/sr-report")}
              >
                확정
              </button>
            ) : (
              <button
                style={allChecked ? s.btnPrimary : s.btnDisabled}
                disabled={!allChecked}
                onClick={() => navigate("/sr-report")}
              >
                다음 단계로
              </button>
            )}
          </div>

          {/* 이상치 탐지 리스트 */}
          {activeTab === "이상치 탐지" && (
            <div style={s.listWrap}>
              <div style={s.colHeader}>
                <span style={s.colDp}>데이터 포인트</span>
                <span style={s.colRisk}>위험도</span>
                <span style={s.colStatus}>상태</span>
              </div>
              {anomalyItems.map(item => (
                <div key={item.id} style={s.listRow}
                  onClick={() => { setSelectedAnomaly(item); setNewValue(""); setReason(""); }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceWarm)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
                >
                  <div style={s.colDp}>
                    <span style={s.dpName}>{item.dpName}</span>
                    <span style={s.dpUnit}>{item.unit}</span>
                  </div>
                  <div style={s.colRisk}>
                    <span style={{ ...s.riskBadge, color: RISK_COLOR[item.risk].color, background: RISK_COLOR[item.risk].bg }}>
                      <span style={{ ...s.riskDot, background: RISK_COLOR[item.risk].dot }} />
                      {item.risk}
                    </span>
                  </div>
                  <div style={s.colStatus}>
                    {item.checked ? <span style={s.statusDone}>✓ 완료</span> : <><span style={s.statusNeed}>검토 필요</span><span style={s.arrow}>→</span></>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 정합성 탐지 리스트 */}
          {activeTab === "정합성 탐지" && (
            <div style={s.listWrap}>
              <div style={s.colHeader}>
                <span style={s.colDp}>데이터 포인트</span>
                <span style={{ flex: 1 }}>검증 결과</span>
                <span style={s.colStatus}>상태</span>
              </div>
              {consItems.map(item => (
                <div key={item.id} style={s.listRow}
                  onClick={() => setSelectedCons(item)}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceWarm)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
                >
                  <div style={s.colDp}>
                    <span style={s.dpName}>{item.dpName}</span>
                    <span style={s.dpUnit}>{item.unit}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ ...s.riskBadge, color: ERROR_COLOR[item.error].color, background: ERROR_COLOR[item.error].bg }}>
                      <span style={{ ...s.riskDot, background: ERROR_COLOR[item.error].dot }} />
                      검증 실패 · {item.error}
                    </span>
                  </div>
                  <div style={s.colStatus}>
                    {item.checked ? <span style={s.statusDone}>✓ 완료</span> : <><span style={s.statusNeed}>검토 필요</span><span style={s.arrow}>→</span></>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 미증빙 자료 리스트 */}
          {activeTab === "미증빙 자료" && (
            <div style={s.listWrap}>
              <div style={s.colHeader}>
                <span style={s.colDp}>데이터 포인트</span>
                <span style={{ flex: 1.2 }}>입력값</span>
                <span style={s.colStatus}>상태</span>
              </div>
              {unverItems.map(item => (
                <div key={item.id} style={s.listRow}
                  onClick={() => { setSelectedUnver(item); setUnverReason(""); }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceWarm)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
                >
                  <div style={s.colDp}>
                    <span style={s.dpName}>{item.dpName}</span>
                    <span style={s.dpUnit}>{item.unit}</span>
                  </div>
                  <div style={{ flex: 1.2 }}>
                    <span style={s.dpName}>{item.value}</span>
                  </div>
                  <div style={s.colStatus}>
                    {item.checked ? <span style={s.statusDone}>✓ 완료</span> : <><span style={s.statusNeed}>검토 필요</span><span style={s.arrow}>→</span></>}
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>
      </div>

      {/* 정합성 소명 팝업 모달 */}
      {selectedCons && (
        <div style={s.modalOverlay} onClick={() => setSelectedCons(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div>
                <p style={s.modalTitle}>정합성 소명</p>
                <p style={s.modalSub}>{selectedCons.dpName} · 검증 실패 - {selectedCons.error}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setSelectedCons(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>입력값</th>
                    <th style={s.th}>증빙자료</th>
                    <th style={s.th}>추출값</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...s.td, color: "#C0392B", fontWeight: 600, fontSize: 18 }}>{selectedCons.inputValue != null ? selectedCons.inputValue.toLocaleString() : "—"}</td>
                    <td style={{ ...s.td, color: C.olive, fontWeight: 600, fontSize: 18 }}>{selectedCons.evidenceValue.toLocaleString()}</td>
                    <td style={{ ...s.td, color: C.textPrimary, fontWeight: 600, fontSize: 18 }}>{selectedCons.inputValue != null ? selectedCons.inputValue.toLocaleString() : "—"}</td>
                  </tr>
                </tbody>
              </table>
              <div style={s.warnBox}>
                <span style={{ marginRight: 8 }}>⚠</span>
                입력값과 증빙자료 값이 일치하지 않습니다. 확인 요청하시겠습니까?
              </div>
            </div>
            <div style={s.modalFooter}>
              <button style={s.outlineBtn} onClick={() => setSelectedCons(null)}>취소</button>
              <button style={s.btnPrimary} onClick={() => {
                setConsItems(prev => prev.map(i => i.id === selectedCons.id ? { ...i, checked: true } : i));
                setSelectedCons(null);
              }}>확인 요청</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스타일 ─────────────────────────────────────────────────────────
const s = {
  root: { minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  body: { display: "flex" },
  main: { flex: 1, padding: "40px 48px", maxWidth: 1000 },

  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  breadcrumb: { fontSize: 12, color: C.textTer, margin: "0 0 6px" },
  pageTitle: { fontSize: 28, fontWeight: 700, color: C.textPrimary, margin: "0 0 6px" },
  pageDesc: { fontSize: 14, color: C.textSec, margin: 0 },
  headerRight: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  progressCircle: { width: 64, height: 64, borderRadius: "50%", border: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface },
  progressNum: { fontSize: 16, fontWeight: 700 },
  progressLabel: { fontSize: 12, color: C.textTer, margin: 0 },
  actionBtns: { display: "flex", gap: 10, alignItems: "center", marginTop: 8 },
  divider: { height: 1, background: C.border, marginBottom: 24 },

  tab: { padding: "10px 20px", fontSize: 14, fontWeight: 500, color: C.textTer, background: "none", border: "none", cursor: "pointer", borderBottom: "2px solid transparent", marginBottom: 0, display: "flex", alignItems: "center", gap: 8 },
  tabActive: { padding: "10px 20px", fontSize: 14, fontWeight: 700, color: C.olive, background: "none", border: "none", cursor: "pointer", borderBottom: `2px solid ${C.olive}`, marginBottom: 0, display: "flex", alignItems: "center", gap: 8 },
  tabBadge: { fontSize: 11, background: C.borderLight, color: C.textTer, borderRadius: 10, padding: "1px 7px" },
  tabBadgeActive: { fontSize: 11, background: C.oliveFaint, color: C.olive, borderRadius: 10, padding: "1px 7px" },

  listWrap: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginTop: 16, marginBottom: 24 },
  colHeader: { display: "flex", alignItems: "center", padding: "10px 24px", background: C.surfaceWarm, borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textTer, fontWeight: 500 },
  listRow: { display: "flex", alignItems: "center", padding: "18px 24px", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer", transition: "background 0.12s", background: C.surface },
  colDp: { flex: 3, display: "flex", flexDirection: "column", gap: 3 },
  colRisk: { flex: 1, display: "flex", alignItems: "center" },
  colStatus: { flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  dpName: { fontSize: 15, fontWeight: 500, color: C.textPrimary },
  dpUnit: { fontSize: 12, color: C.textTer },
  riskBadge: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20 },
  riskDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  statusNeed: { fontSize: 13, fontWeight: 500, color: "#B8650A" },
  statusDone: { fontSize: 13, fontWeight: 600, color: C.olive },
  arrow: { fontSize: 14, color: C.textTer },

  btnPrimary:  { padding: "8px 20px", fontSize: 13, fontWeight: 600, background: C.olive, color: "#FAF8F0", border: "none", borderRadius: 6, cursor: "pointer" },
  btnDisabled: { padding: "8px 20px", fontSize: 13, fontWeight: 600, background: C.border, color: C.textTer, border: "none", borderRadius: 6, cursor: "not-allowed" },
  outlineBtn:  { padding: "8px 20px", fontSize: 13, fontWeight: 500, background: C.surface, color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" },

  sectionBox: { border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16, background: C.surface },
  sectionHeader: { background: C.surfaceWarm, borderBottom: `1px solid ${C.border}`, padding: "14px 20px", fontSize: 14, fontWeight: 700, color: C.textPrimary, display: "flex", justifyContent: "space-between", alignItems: "center" },
  headerBtns: { display: "flex", gap: 10, alignItems: "center" },
  sectionBody: { padding: "20px 24px" },
  llmText: { fontSize: 14, color: C.textSec, lineHeight: 1.9, margin: "0 0 16px" },
  valuePill: { display: "inline-flex", alignItems: "center", gap: 10, background: C.surfaceWarm, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px" },
  valuePillLabel: { fontSize: 12, color: C.textTer, fontWeight: 500 },
  valuePillVal: { fontSize: 18, fontWeight: 700, color: C.textPrimary },

  editBox: { border: `1px solid ${C.border}`, borderRadius: 8, padding: "20px 24px", background: C.surface },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 20, fontSize: 14 },
  th: { background: C.surfaceWarm, border: `1px solid ${C.border}`, padding: "10px", fontWeight: 600, textAlign: "center", color: C.textSec },
  td: { border: `1px solid ${C.border}`, padding: "12px", textAlign: "center", color: C.textPrimary },
  tableInput: { width: "80%", padding: "6px 10px", fontSize: 14, border: `1px solid ${C.border}`, borderRadius: 4, textAlign: "center", outline: "none", background: C.bg, fontFamily: "inherit", color: C.textPrimary },
  reasonLabel: { fontSize: 14, fontWeight: 600, color: C.textPrimary, margin: "0 0 8px" },
  textarea: { width: "100%", padding: "12px 14px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: C.bg, color: C.textPrimary },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modalBox: { background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, width: 520, maxWidth: "92vw", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" },
  modalHeader: { padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: C.surfaceWarm },
  modalTitle: { fontSize: 15, fontWeight: 700, color: C.textPrimary, margin: "0 0 4px" },
  modalSub: { fontSize: 12, color: C.textSec, margin: 0 },
  closeBtn: { width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: "none", cursor: "pointer", color: C.textSec, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" },
  modalBody: { padding: 20 },
  modalFooter: { padding: "14px 20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 8 },
  warnBox: { marginTop: 14, padding: "11px 14px", background: "#FDF2F0", border: "1px solid #F5C6C0", borderRadius: 8, fontSize: 13, color: "#C0392B", lineHeight: 1.6 },

  iconBtn: { width: 34, height: 34, borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, cursor: "pointer", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" },
};