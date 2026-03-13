import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const standards = ["GRI", "ISSB", "ESRS", "SASB"];

const draftSections = [
  {
    id: "env",
    category: "환경 (E)",
    color: "#005F02",
    icon: "🌿",
    items: [
      {
        metric: "온실가스 배출량",
        standard: "GRI 305-1",
        draft:
          "당사의 2023년 Scope 1 직접 온실가스 배출량은 12,450 tCO₂e로, 전년 대비 3.2% 감소하였습니다. 이는 생산 공정 개선 및 재생에너지 전환 투자의 결과입니다.",
      },
      {
        metric: "에너지 사용량",
        standard: "GRI 302-1",
        draft:
          "2023년 총 에너지 사용량은 84,200 MWh이며, 이 중 재생에너지 비중은 18.4%입니다. 당사는 2030년까지 재생에너지 비중을 50%로 확대할 계획입니다.",
      },
      {
        metric: "용수 사용량",
        standard: "GRI 303-5",
        draft:
          "2023년 총 용수 사용량은 19,200톤으로, 수자원 절감 설비 도입을 통해 전년 대비 효율이 개선되었습니다. 폐수 재활용률은 62%를 기록하였습니다.",
      },
    ],
  },
  {
    id: "soc",
    category: "사회 (S)",
    color: "#427A43",
    icon: "👥",
    items: [
      {
        metric: "임직원 현황",
        standard: "GRI 2-7",
        draft:
          "2023년 기준 총 임직원 수는 2,340명이며, 정규직 비율은 94.2%입니다. 여성 임원 비율은 18.2%로 전년 대비 2.1%p 증가하였으며, 다양성 확대 정책을 지속적으로 추진하고 있습니다.",
      },
      {
        metric: "산업 안전",
        standard: "GRI 403-9",
        draft:
          "2023년 산업재해율은 0.42%로, 업종 평균(0.58%) 대비 낮은 수준을 유지하고 있습니다. 안전관리 시스템 ISO 45001 인증을 유지하며 무사고 사업장 달성을 목표로 하고 있습니다.",
      },
    ],
  },
  {
    id: "gov",
    category: "지배구조 (G)",
    color: "#C0B87A",
    icon: "🏛️",
    items: [
      {
        metric: "이사회 독립성",
        standard: "GRI 2-9",
        draft:
          "2023년 기준 이사회 내 사외이사 비율은 62.5%로, 이사회의 독립적 의사결정 체계를 강화하고 있습니다. 감사위원회는 100% 사외이사로 구성되어 있습니다.",
      },
      {
        metric: "윤리 경영",
        standard: "GRI 205-3",
        draft:
          "2023년 윤리 위반 사건은 총 3건이 접수되었으며, 모두 내부 윤리위원회 심의를 거쳐 처리 완료되었습니다. 임직원 윤리교육 이수율은 98.7%를 기록하였습니다.",
      },
    ],
  },
];

function ReportDraft({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";

  const [selectedStandard, setSelectedStandard] = useState("GRI");
  const [editingId, setEditingId] = useState(null);
  const [edits, setEdits] = useState({});
  const [expandedSection, setExpandedSection] = useState("env");

  const getText = (sectionId, itemIdx, original) => {
    const key = `${sectionId}-${itemIdx}`;
    return edits[key] !== undefined ? edits[key] : original;
  };

  const handleEdit = (sectionId, itemIdx, value) => {
    const key = `${sectionId}-${itemIdx}`;
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const totalItems = draftSections.reduce((a, s) => a + s.items.length, 0);
  const editedItems = Object.keys(edits).filter((k) => edits[k] !== undefined).length;

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="report" />
        <main style={s.main}>

          {/* Header */}
          <div style={s.header}>
            <div>
              <p style={s.eyebrow}>SR 보고서</p>
              <h1 style={s.title}>보고서 초안 조회 / 수정</h1>
              <p style={s.sub}>AI가 ESG 데이터를 기반으로 보고서 초안을 자동 생성했습니다. 내용을 검토하고 수정하세요.</p>
            </div>
            <button
              style={s.nextBtn}
              onClick={() => navigate("/report-download", { state: { fileName } })}
            >
              다운로드 →
            </button>
          </div>

          {/* Status Bar */}
          <div style={s.statusRow}>
            <div style={s.statusCard}>
              <span style={s.statusNum}>{totalItems}</span>
              <span style={s.statusLabel}>총 공시 항목</span>
            </div>
            <div style={s.statusCard}>
              <span style={{ ...s.statusNum, color: "#84934A" }}>{editedItems}</span>
              <span style={s.statusLabel}>수정된 항목</span>
            </div>
            <div style={s.statusCard}>
              <span style={{ ...s.statusNum, color: "#065f46" }}>{totalItems - editedItems}</span>
              <span style={s.statusLabel}>AI 초안 유지</span>
            </div>
            {/* Standard Selector */}
            <div style={s.standardWrap}>
              <span style={s.standardLabel}>기준서</span>
              <div style={s.standardTabs}>
                {standards.map((std) => (
                  <button
                    key={std}
                    style={{
                      ...s.stdTab,
                      background: selectedStandard === std ? "#84934A" : "white",
                      color: selectedStandard === std ? "white" : "#555",
                      borderColor: selectedStandard === std ? "#84934A" : "#e0e0e0",
                    }}
                    onClick={() => setSelectedStandard(std)}
                  >
                    {std}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Draft Sections */}
          {draftSections.map((section) => (
            <div key={section.id} style={s.sectionWrap}>
              {/* Section Header */}
              <button
                style={{ ...s.sectionHeader, borderLeft: `4px solid ${section.color}` }}
                onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              >
                <div style={s.sectionLeft}>
                  <span style={s.sectionIcon}>{section.icon}</span>
                  <span style={{ ...s.sectionTitle, color: section.color }}>{section.category}</span>
                  <span style={s.sectionCount}>{section.items.length}개 항목</span>
                </div>
                <span style={s.chevron}>{expandedSection === section.id ? "▲" : "▼"}</span>
              </button>

              {expandedSection === section.id && (
                <div style={s.itemList}>
                  {section.items.map((item, idx) => {
                    const key = `${section.id}-${idx}`;
                    const isEditing = editingId === key;
                    const currentText = getText(section.id, idx, item.draft);
                    const isEdited = edits[key] !== undefined;

                    return (
                      <div key={idx} style={{ ...s.itemCard, borderLeft: `3px solid ${section.color}30` }}>
                        <div style={s.itemHeader}>
                          <div style={s.itemLeft}>
                            <span style={{ ...s.metricName }}>{item.metric}</span>
                            <span style={s.standardBadge}>{item.standard}</span>
                            {isEdited && <span style={s.editedBadge}>수정됨</span>}
                          </div>
                          <button
                            style={isEditing ? s.saveBtn : s.editBtn}
                            onClick={() => setEditingId(isEditing ? null : key)}
                          >
                            {isEditing ? "저장" : "수정"}
                          </button>
                        </div>

                        {isEditing ? (
                          <textarea
                            style={s.textarea}
                            value={currentText}
                            rows={4}
                            onChange={(e) => handleEdit(section.id, idx, e.target.value)}
                          />
                        ) : (
                          <p style={s.draftText}>{currentText}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div style={s.bottomRow}>
            <button style={s.secBtn} onClick={() => navigate(-1)}>← 이전</button>
            <button
              style={s.nextBtn}
              onClick={() => navigate("/report-download", { state: { fileName } })}
            >
              보고서 다운로드 →
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
  eyebrow: { fontSize: 12, fontWeight: 600, color: "#84934A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  sub: { fontSize: 14, color: "#777" },
  statusRow: { display: "flex", alignItems: "center", gap: 16, marginBottom: 28, background: "white", borderRadius: 14, padding: "18px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  statusCard: { display: "flex", flexDirection: "column", gap: 4, paddingRight: 20, borderRight: "1px solid #f0f0ee" },
  statusNum: { fontSize: 26, fontWeight: 800, color: "#1a1a1a" },
  statusLabel: { fontSize: 12, color: "#888" },
  standardWrap: { display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" },
  standardLabel: { fontSize: 13, color: "#555", fontWeight: 500 },
  standardTabs: { display: "flex", gap: 6 },
  stdTab: { padding: "6px 14px", borderRadius: 8, border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  sectionWrap: { marginBottom: 16 },
  sectionHeader: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", borderRadius: 12, padding: "16px 20px", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", textAlign: "left" },
  sectionLeft: { display: "flex", alignItems: "center", gap: 10 },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { fontSize: 16, fontWeight: 700 },
  sectionCount: { fontSize: 12, color: "#aaa", background: "#f5f5f3", padding: "3px 10px", borderRadius: 20 },
  chevron: { fontSize: 12, color: "#aaa" },
  itemList: { background: "white", borderRadius: "0 0 12px 12px", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginTop: 2 },
  itemCard: { padding: "16px 18px", borderRadius: 10, background: "#fafaf8", borderLeft: "3px solid" },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  itemLeft: { display: "flex", alignItems: "center", gap: 8 },
  metricName: { fontSize: 14, fontWeight: 700, color: "#1a1a1a" },
  standardBadge: { fontSize: 11, color: "#84934A", background: "rgba(132,147,74,0.12)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 },
  editedBadge: { fontSize: 11, color: "#92400e", background: "#fffbeb", padding: "2px 8px", borderRadius: 6, fontWeight: 600 },
  draftText: { fontSize: 14, color: "#444", lineHeight: 1.75, margin: 0 },
  textarea: { width: "100%", padding: "12px", borderRadius: 8, border: "1.5px solid #84934A", fontSize: 14, color: "#333", lineHeight: 1.7, resize: "vertical", outline: "none", boxSizing: "border-box", background: "white" },
  editBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#555", cursor: "pointer" },
  saveBtn: { background: "#84934A", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "white", cursor: "pointer" },
  bottomRow: { display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 },
  secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
  nextBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

export default ReportDraft;