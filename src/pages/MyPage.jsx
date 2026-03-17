import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

if (!document.head.querySelector("#mp-style")) {
  const tag = document.createElement("style");
  tag.id = "mp-style";
  tag.innerHTML = `
    @keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
  `;
  document.head.appendChild(tag);
}

const STANDARD_COLOR = {
  GRI:  { bg: "#EEFBE6", color: "#3A6B1A", border: "#B5E0A0" },
  ISSB: { bg: "#EBF2FF", color: "#1A4FAB", border: "#A0C4FF" },
  ESRS: { bg: "#FFF5E6", color: "#A85C00", border: "#FFD08A" },
  SASB: { bg: "#F3EEFF", color: "#6A2DB8", border: "#C9ABFF" },
};

export default function MyPage({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("esg_report_history") || "[]");
    setReports(data);
    if (data.length > 0) setSelected(data[0]);
  }, []);

  const deleteReport = (id) => {
    const updated = reports.filter(r => r.id !== id);
    localStorage.setItem("esg_report_history", JSON.stringify(updated));
    setReports(updated);
    if (selected?.id === id) setSelected(updated[0] || null);
  };

  const std = selected ? (STANDARD_COLOR[selected.standard] || STANDARD_COLOR.GRI) : {};

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="mypage" />
        <main style={s.main}>

          {/* Header */}
          <div style={s.header}>
            <div>
              <p style={s.eyebrow}>마이페이지</p>
              <h1 style={s.title}>보고서 히스토리</h1>
              <p style={s.sub}>생성된 ESG 보고서 초안을 조회하고 관리합니다.</p>
            </div>
            <button style={s.newBtn} onClick={() => navigate("/upload")}>
              + 새 보고서 생성
            </button>
          </div>

          {reports.length === 0 ? (
            <div style={s.empty}>
              <div style={s.emptyIcon}>📄</div>
              <div style={s.emptyTitle}>아직 생성된 보고서가 없습니다</div>
              <div style={s.emptySub}>보고서를 생성하면 여기에 자동으로 저장됩니다.</div>
              <button style={s.emptyBtn} onClick={() => navigate("/upload")}>
                첫 보고서 만들기 →
              </button>
            </div>
          ) : (
            <div style={s.layout}>

              {/* 왼쪽: 목록 */}
              <div style={s.listCol}>
                <div style={s.listHeader}>
                  <span style={s.listTitle}>전체 보고서</span>
                  <span style={s.listCount}>{reports.length}건</span>
                </div>
                <div style={s.list}>
                  {reports.map((r, i) => {
                    const c = STANDARD_COLOR[r.standard] || STANDARD_COLOR.GRI;
                    const isActive = selected?.id === r.id;
                    return (
                      <div
                        key={r.id}
                        style={{
                          ...s.listItem,
                          borderLeft: isActive ? "3px solid #5C6B2E" : "3px solid transparent",
                          background: isActive ? "#FAFDF5" : "white",
                          animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both`,
                        }}
                        onClick={() => { setSelected(r); setActiveSection(null); }}
                      >
                        <div style={s.listItemTop}>
                          <span style={{ ...s.stdPill, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                            {r.standard}
                          </span>
                          <span style={s.listDate}>{r.dateStr}</span>
                        </div>
                        <div style={{ ...s.listFileName, color: isActive ? "#2d3a1a" : "#444" }}>
                          {r.fileName}
                        </div>
                        <div style={s.listSectionCount}>
                          {Object.keys(r.generatedSections || {}).length}개 섹션 생성
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 오른쪽: 상세 */}
              {selected && (
                <div style={s.detailCol}>
                  {/* 상단 메타 */}
                  <div style={s.detailHeader}>
                    <div style={s.detailMeta}>
                      <span style={{ ...s.stdPillLg, background: std.bg, color: std.color, border: `1px solid ${std.border}` }}>
                        {selected.standard}
                      </span>
                      <span style={s.detailDate}>{selected.dateStr}</span>
                    </div>
                    <div style={s.detailTitleRow}>
                      <h2 style={s.detailTitle}>{selected.fileName}</h2>
                      <button style={s.deleteBtn} onClick={() => deleteReport(selected.id)}>삭제</button>
                    </div>
                    <div style={s.detailRule} />
                  </div>

                  {/* 섹션 탭 */}
                  <div style={s.sectionTabs}>
                    {Object.entries(selected.generatedSections || {}).map(([id]) => {
                      const label = {
                        env_carbon: "온실가스", env_energy: "에너지", env_water: "용수",
                        soc_employee: "임직원", soc_safety: "안전",
                        gov_board: "이사회", gov_ethics: "윤리경영",
                      }[id] || id;
                      const isAct = activeSection === id;
                      return (
                        <button
                          key={id}
                          style={{
                            ...s.tabBtn,
                            background: isAct ? "#5C6B2E" : "white",
                            color: isAct ? "white" : "#666",
                            border: isAct ? "1.5px solid #5C6B2E" : "1.5px solid #e0ddd6",
                          }}
                          onClick={() => setActiveSection(isAct ? null : id)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 섹션 내용 */}
                  <div style={s.sectionList}>
                    {Object.entries(selected.generatedSections || {}).map(([id, text]) => {
                      const isOpen = activeSection === null || activeSection === id;
                      if (!isOpen) return null;
                      const label = {
                        env_carbon: "온실가스 배출량", env_energy: "에너지 사용량", env_water: "용수 사용량",
                        soc_employee: "임직원 현황", soc_safety: "산업 안전",
                        gov_board: "이사회 독립성", gov_ethics: "윤리 경영",
                      }[id] || id;
                      const category = {
                        env_carbon: "환경 (E)", env_energy: "환경 (E)", env_water: "환경 (E)",
                        soc_employee: "사회 (S)", soc_safety: "사회 (S)",
                        gov_board: "지배구조 (G)", gov_ethics: "지배구조 (G)",
                      }[id] || "";
                      return (
                        <div key={id} style={{ ...s.sectionCard, animation: "fadeSlideIn 0.3s ease" }}>
                          <div style={s.sectionCardTop}>
                            <span style={s.sectionCategory}>{category}</span>
                            <span style={s.sectionName}>{label}</span>
                          </div>
                          <p style={s.sectionText}>{text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#F7F5F0", fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "48px 56px" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: "#5C6B2E", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Mono',monospace" },
  title: { fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 6, margin: 0 },
  sub: { fontSize: 14, color: "#888", marginTop: 6 },
  newBtn: { background: "#2d3a1a", color: "#A8C070", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" },

  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 12 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: "#333" },
  emptySub: { fontSize: 13, color: "#aaa" },
  emptyBtn: { marginTop: 12, background: "#5C6B2E", color: "white", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" },

  layout: { display: "flex", gap: 24, alignItems: "flex-start" },

  // List
  listCol: { width: 280, flexShrink: 0 },
  listHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#2d3a1a", borderRadius: "10px 10px 0 0" },
  listTitle: { fontSize: 11, fontWeight: 700, color: "#A8C070", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" },
  listCount: { fontSize: 11, color: "#6B8040", fontFamily: "'DM Mono',monospace" },
  list: { background: "white", border: "1px solid #E8E3DA", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" },
  listItem: { padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", borderBottom: "1px solid #f5f2ec" },
  listItemTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  stdPill: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, fontFamily: "'DM Mono',monospace" },
  listDate: { fontSize: 10, color: "#bbb", fontFamily: "'DM Mono',monospace" },
  listFileName: { fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  listSectionCount: { fontSize: 11, color: "#aaa" },

  // Detail
  detailCol: { flex: 1 },
  detailHeader: { marginBottom: 24 },
  detailMeta: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  stdPillLg: { fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, fontFamily: "'DM Mono',monospace" },
  detailDate: { fontSize: 11, color: "#aaa", fontFamily: "'DM Mono',monospace" },
  detailTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  detailTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  deleteBtn: { background: "white", color: "#ef4444", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  detailRule: { height: 1, background: "linear-gradient(90deg, #5C6B2E, #C8D4A0, transparent)" },

  sectionTabs: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  tabBtn: { padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" },

  sectionList: { display: "flex", flexDirection: "column", gap: 14 },
  sectionCard: { background: "white", border: "1px solid #E8E3DA", borderRadius: 12, padding: "20px 24px" },
  sectionCardTop: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  sectionCategory: { fontSize: 10, fontWeight: 700, color: "#5C6B2E", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono',monospace" },
  sectionName: { fontSize: 15, fontWeight: 700, color: "#1a1a1a" },
  sectionText: { fontSize: 14, color: "#444", lineHeight: 1.9, borderLeft: "3px solid #5C6B2E", paddingLeft: 16, background: "#FAFDF5", padding: "12px 16px", borderRadius: "0 6px 6px 0" },
};