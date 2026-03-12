import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const mockData = [
  { id: 1, category: "환경", metric: "탄소 배출량", value: "12,450", unit: "tCO₂e", year: 2023, status: "정상" },
  { id: 2, category: "환경", metric: "에너지 사용량", value: "84,200", unit: "MWh", year: 2023, status: "정상" },
  { id: 3, category: "환경", metric: "용수 사용량", value: "31,800", unit: "톤", year: 2023, status: "이상치" },
  { id: 4, category: "사회", metric: "임직원 수", value: "2,340", unit: "명", year: 2023, status: "정상" },
  { id: 5, category: "사회", metric: "산업재해율", value: "0.42", unit: "%", year: 2023, status: "정상" },
  { id: 6, category: "사회", metric: "여성 임원 비율", value: "18.2", unit: "%", year: 2023, status: "누락" },
  { id: 7, category: "지배구조", metric: "이사회 독립성", value: "62.5", unit: "%", year: 2023, status: "정상" },
  { id: 8, category: "지배구조", metric: "윤리 위반 건수", value: "3", unit: "건", year: 2023, status: "이상치" },
];

const statusStyle = {
  정상: { background: "#ecfdf5", color: "#065f46" },
  이상치: { background: "#fef2f2", color: "#991b1b" },
  누락: { background: "#fffbeb", color: "#92400e" },
};

const catColor = {
  환경: "#84934A",
  사회: "#4a7c93",
  지배구조: "#7c4a93",
};

function DataViewPage({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";
  const [filter, setFilter] = useState("전체");

  const categories = ["전체", "환경", "사회", "지배구조"];
  const filtered = filter === "전체" ? mockData : mockData.filter(d => d.category === filter);

  const counts = {
    전체: mockData.length,
    정상: mockData.filter(d => d.status === "정상").length,
    이상치: mockData.filter(d => d.status === "이상치").length,
    누락: mockData.filter(d => d.status === "누락").length,
  };

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="data-view" />
        <main style={s.main}>

          <div style={s.header}>
            <div>
              <h1 style={s.title}>데이터 조회</h1>
              <p style={s.sub}>업로드된 파일에서 추출된 ESG 데이터를 확인합니다.</p>
            </div>
            <div style={s.fileBadge}>📄 {fileName}</div>
          </div>

          {/* Summary Cards */}
          <div style={s.cardRow}>
            {[
              { label: "전체 항목", value: counts.전체, color: "#84934A", bg: "rgba(132,147,74,0.08)" },
              { label: "정상", value: counts.정상, color: "#065f46", bg: "#ecfdf5" },
              { label: "이상치 감지", value: counts.이상치, color: "#991b1b", bg: "#fef2f2" },
              { label: "데이터 누락", value: counts.누락, color: "#92400e", bg: "#fffbeb" },
            ].map((c) => (
              <div key={c.label} style={{ ...s.summaryCard, background: c.bg }}>
                <div style={{ ...s.summaryNum, color: c.color }}>{c.value}</div>
                <div style={s.summaryLabel}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div style={s.tabs}>
            {categories.map(cat => (
              <button
                key={cat}
                style={{
                  ...s.tab,
                  background: filter === cat ? "#84934A" : "white",
                  color: filter === cat ? "white" : "#555",
                  borderColor: filter === cat ? "#84934A" : "#e0e0e0",
                }}
                onClick={() => setFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>#</th>
                  <th style={s.th}>카테고리</th>
                  <th style={s.th}>지표명</th>
                  <th style={s.th}>값</th>
                  <th style={s.th}>단위</th>
                  <th style={s.th}>연도</th>
                  <th style={s.th}>상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={s.td}>{row.id}</td>
                    <td style={s.td}>
                      <span style={{ ...s.catBadge, background: catColor[row.category] + "18", color: catColor[row.category] }}>
                        {row.category}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontWeight: 500 }}>{row.metric}</td>
                    <td style={{ ...s.td, fontWeight: 700 }}>{row.value}</td>
                    <td style={{ ...s.td, color: "#888" }}>{row.unit}</td>
                    <td style={s.td}>{row.year}</td>
                    <td style={s.td}>
                      <span style={{ ...s.statusBadge, ...statusStyle[row.status] }}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={s.bottom}>
            <button style={s.secBtn} onClick={() => navigate(-1)}>← 이전</button>
            <button
              style={s.priBtn}
              onClick={() => navigate("/anomaly-result", { state: { fileName } })}
            >
              이상치 탐지 결과 확인 →
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#F5F5F3", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "44px 48px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  sub: { fontSize: 14, color: "#777" },
  fileBadge: { background: "#ecfdf5", color: "#065f46", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500 },
  cardRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 },
  summaryCard: { borderRadius: 14, padding: "20px 24px" },
  summaryNum: { fontSize: 32, fontWeight: 800, marginBottom: 4 },
  summaryLabel: { fontSize: 13, color: "#555" },
  tabs: { display: "flex", gap: 8, marginBottom: 16 },
  tab: { padding: "8px 18px", borderRadius: 8, border: "1.5px solid", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  tableWrap: { background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 28 },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f8f8f6" },
  th: { padding: "14px 18px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #eee" },
  td: { padding: "14px 18px", fontSize: 14, color: "#333", borderBottom: "1px solid #f0f0f0" },
  catBadge: { padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 },
  statusBadge: { padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600 },
  bottom: { display: "flex", justifyContent: "flex-end", gap: 12 },
  secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
  priBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

export default DataViewPage;