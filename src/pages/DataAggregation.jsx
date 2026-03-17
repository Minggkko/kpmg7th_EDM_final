import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const aggregatedData = [
  {
    category: "환경 (E)",
    color: "#84934A",
    bgColor: "rgba(132,147,74,0.07)",
    score: 72,
    items: [
      { metric: "탄소 배출량", value: "12,450 tCO₂e", status: "확정", source: "원본 데이터" },
      { metric: "에너지 사용량", value: "84,200 MWh", status: "확정", source: "원본 데이터" },
      { metric: "용수 사용량", value: "19,200 톤", status: "수정됨", source: "담당자 재입력" },
    ],
  },
  {
    category: "사회 (S)",
    color: "#4a7c93",
    bgColor: "rgba(74,124,147,0.07)",
    score: 68,
    items: [
      { metric: "임직원 수", value: "2,340 명", status: "확정", source: "원본 데이터" },
      { metric: "산업재해율", value: "0.42%", status: "확정", source: "원본 데이터" },
      { metric: "여성 임원 비율", value: "18.2%", status: "신규입력", source: "담당자 입력" },
    ],
  },
  {
    category: "지배구조 (G)",
    color: "#7c4a93",
    bgColor: "rgba(124,74,147,0.07)",
    score: 81,
    items: [
      { metric: "이사회 독립성", value: "62.5%", status: "확정", source: "원본 데이터" },
      { metric: "윤리 위반 건수", value: "3 건", status: "증빙완료", source: "증빙자료 첨부" },
      { metric: "투명한 경영", value: "A등급", status: "확정", source: "원본 데이터" },
    ],
  },
];

const statusStyle = {
  확정: { bg: "#ecfdf5", color: "#065f46" },
  수정됨: { bg: "#fffbeb", color: "#92400e" },
  신규입력: { bg: "rgba(132,147,74,0.12)", color: "#84934A" },
  증빙완료: { bg: "#eff6ff", color: "#1e40af" },
};

function ScoreBar({ value, color }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#888" }}>ESG 점수</span>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}점</span>
      </div>
      <div style={{ height: 8, background: "#f0f0ee", borderRadius: 99 }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function DataAggregation({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";
  const [confirmed, setConfirmed] = useState(false);

  const totalScore = Math.round(aggregatedData.reduce((acc, d) => acc + d.score, 0) / aggregatedData.length);
  const totalItems = aggregatedData.reduce((acc, d) => acc + d.items.length, 0);
  const modifiedItems = aggregatedData.reduce((acc, d) => acc + d.items.filter(i => i.status !== "확정").length, 0);

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="data-aggregation" />
        <main style={s.main}>

          <div style={s.header}>
            <div>
              <h1 style={s.title}>데이터 취합 화면</h1>
              <p style={s.sub}>수집·수정된 모든 ESG 데이터를 최종 확인하고 분석을 시작하세요.</p>
            </div>
            <div style={s.fileBadge}>📄 {fileName}</div>
          </div>

          {/* Overview Cards */}
          <div style={s.overviewRow}>
            <div style={{ ...s.overCard, background: "rgba(132,147,74,0.08)" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#84934A" }}>{totalScore}</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>종합 ESG 점수</div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>/ 100점</div>
            </div>
            <div style={{ ...s.overCard, background: "#f8f8f6" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#333" }}>{totalItems}</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>총 데이터 항목</div>
            </div>
            <div style={{ ...s.overCard, background: "#fffbeb" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#92400e" }}>{modifiedItems}</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>수정/추가된 항목</div>
            </div>
            <div style={{ ...s.overCard, background: "#ecfdf5" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#065f46" }}>{totalItems - modifiedItems}</div>
              <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>원본 확정 항목</div>
            </div>
          </div>

          {/* Category Panels */}
          {aggregatedData.map((cat) => (
            <div key={cat.category} style={{ ...s.catPanel, borderTop: `4px solid ${cat.color}` }}>
              <div style={s.catHeader}>
                <div style={s.catLeft}>
                  <div style={{ ...s.catDot, background: cat.color }} />
                  <span style={s.catTitle}>{cat.category}</span>
                  <span style={s.catCount}>{cat.items.length}개 항목</span>
                </div>
                <div style={{ minWidth: 200 }}>
                  <ScoreBar value={cat.score} color={cat.color} />
                </div>
              </div>

              <div style={s.itemTable}>
                <div style={s.tableHead}>
                  <span style={s.colMetric}>지표명</span>
                  <span style={s.colValue}>확정 값</span>
                  <span style={s.colStatus}>상태</span>
                  <span style={s.colSource}>데이터 출처</span>
                </div>
                {cat.items.map((item, i) => (
                  <div key={i} style={{ ...s.tableRow, background: i % 2 === 0 ? "white" : "#fafaf8" }}>
                    <span style={{ ...s.colMetric, fontWeight: 600 }}>{item.metric}</span>
                    <span style={{ ...s.colValue, fontWeight: 700 }}>{item.value}</span>
                    <span style={s.colStatus}>
                      <span style={{ ...s.statusBadge, ...statusStyle[item.status] }}>{item.status}</span>
                    </span>
                    <span style={{ ...s.colSource, color: "#777", fontSize: 13 }}>{item.source}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Confirm */}
          {!confirmed ? (
            <div style={s.confirmBox}>
              <div style={s.confirmLeft}>
                <div style={s.confirmTitle}>데이터 취합 완료 확인</div>
                <div style={s.confirmSub}>
                  총 {totalItems}개 항목 중 {modifiedItems}개가 수정·추가되었습니다. 최종 확인 후 ESG 점수 계산을 시작합니다.
                </div>
              </div>
              <button style={s.priBtn} onClick={() => setConfirmed(true)}>
                최종 확인 및 분석 시작 →
              </button>
            </div>
          ) : (
            <div style={s.doneBox}>
              <span style={s.doneIcon}>✓</span>
              <div>
                <div style={s.doneTitle}>취합 완료 — ESG 점수 계산 중...</div>
                <div style={s.doneSub}>분석이 완료되면 대시보드에서 결과를 확인하실 수 있습니다.</div>
              </div>
              <button style={s.priBtn} onClick={() => navigate("/analysis-dashboard", { state: { fileName } })}>
                대시보드 보기 →
              </button>
            </div>
          )}

          <div style={{ ...s.bottom, marginTop: 20 }}>
            <button style={s.secBtn} onClick={() => navigate(-1)}>← 이전</button>
          </div>

        </main>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#f8f9fa", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "44px 48px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  sub: { fontSize: 14, color: "#777" },
  fileBadge: { background: "#ecfdf5", color: "#065f46", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500 },
  overviewRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 },
  overCard: { borderRadius: 14, padding: "22px 24px" },
  catPanel: { background: "white", borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 18 },
  catHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  catLeft: { display: "flex", alignItems: "center", gap: 10 },
  catDot: { width: 12, height: 12, borderRadius: "50%" },
  catTitle: { fontSize: 16, fontWeight: 700, color: "#222" },
  catCount: { fontSize: 12, color: "#aaa", background: "#f5f5f3", padding: "3px 10px", borderRadius: 20 },
  itemTable: { borderRadius: 10, overflow: "hidden", border: "1px solid #f0f0ee" },
  tableHead: { display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr", padding: "10px 16px", background: "#f8f8f6", borderBottom: "1px solid #eee" },
  tableRow: { display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr", padding: "12px 16px", borderBottom: "1px solid #f5f5f3" },
  colMetric: { fontSize: 13, color: "#888", fontWeight: 600 },
  colValue: { fontSize: 13, color: "#333" },
  colStatus: { fontSize: 13, color: "#333" },
  colSource: { fontSize: 13 },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6 },
  confirmBox: { background: "white", borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  confirmLeft: {},
  confirmTitle: { fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 },
  confirmSub: { fontSize: 13, color: "#777" },
  doneBox: { background: "#ecfdf5", borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", gap: 16, marginBottom: 8 },
  doneIcon: { width: 44, height: 44, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  doneTitle: { fontSize: 15, fontWeight: 700, color: "#065f46", marginBottom: 2 },
  doneSub: { fontSize: 13, color: "#065f46", opacity: 0.7 },
  bottom: { display: "flex", justifyContent: "flex-start", gap: 12 },
  secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
  priBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
};

export default DataAggregation;