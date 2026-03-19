import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";

const SECTION_COLORS = {
  1: { bg: "#ecfdf5", border: "#bbf7d0", label: "#065f46" }, // 환경 E - green
  2: { bg: "#eff6ff", border: "#bfdbfe", label: "#1e40af" }, // 사회 S - blue
  3: { bg: "#fdf4ff", border: "#e9d5ff", label: "#6b21a8" }, // 지배구조 G - purple
};
const DEFAULT_COLOR = { bg: "#f8fafc", border: "#e2e8f0", label: "#334155" };

export default function ReportDraft() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [draft, setDraft]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [editingKey, setEditingKey] = useState(null); // "fieldId_context" | "fieldId_commentary"
  const [saving, setSaving]         = useState(false);
  const [modCount, setModCount]     = useState(0);
  const [expandedSections, setExpandedSections] = useState({ 1: true, 2: true, 3: true });

  // Load draft from navigation state or API
  useEffect(() => {
    const stateDraft = location.state?.draft;
    if (stateDraft) {
      setDraft(stateDraft);
      setLoading(false);
    } else {
      setDraft({
        draft_id: "dummy-001",
        version: 1,
        generated_at: new Date().toISOString(),
        sections: [
          {
            esg_id: 1,
            label: "환경 (E)",
            items: [
              {
                field_id: "GRI-305-1",
                title: "온실가스 배출량 (Scope 1)",
                context: { current: "당사의 2023년 Scope 1 직접 온실가스 배출량은 12,450 tCO₂e로, 전년 대비 3.2% 감소하였습니다.", last_modified: null },
                commentary: { current: "생산 공정 개선 및 재생에너지 전환 투자의 결과로 배출량이 감소하였습니다. 2030년까지 탄소중립 달성을 목표로 추가 감축 계획을 수립 중입니다.", last_modified: null },
                data_points: [{ dp_id: 1, dp_name: "Scope 1 직접배출량", unit: "tCO₂e", indicator_code: "GRI 305-1", has_data: true, rows: [{ id: 1, site_id: "본사", reporting_date: "2023-12", value: 12450, unit: "tCO₂e" }] }]
              },
              {
                field_id: "GRI-302-1",
                title: "에너지 사용량",
                context: { current: "2023년 총 에너지 사용량은 84,200 MWh이며, 이 중 재생에너지 비중은 18.4%입니다.", last_modified: null },
                commentary: { current: "당사는 2030년까지 재생에너지 비중을 50%로 확대할 계획입니다. 태양광 설비 추가 도입과 에너지 효율화 설비 투자를 지속하고 있습니다.", last_modified: null },
                data_points: [{ dp_id: 2, dp_name: "총 에너지 소비량", unit: "MWh", indicator_code: "GRI 302-1", has_data: true, rows: [{ id: 2, site_id: "본사", reporting_date: "2023-12", value: 84200, unit: "MWh" }] }]
              },
              {
                field_id: "GRI-303-5",
                title: "용수 사용량",
                context: { current: "2023년 총 용수 사용량은 19,200톤으로, 수자원 절감 설비 도입을 통해 전년 대비 효율이 개선되었습니다.", last_modified: null },
                commentary: { current: "폐수 재활용률은 62%를 기록하였으며, 물 절약 기술 도입 및 재이용 시스템 확대를 통해 지속적인 절감을 추진하고 있습니다.", last_modified: null },
                data_points: []
              }
            ]
          },
          {
            esg_id: 2,
            label: "사회 (S)",
            items: [
              {
                field_id: "GRI-2-7",
                title: "임직원 현황",
                context: { current: "2023년 기준 총 임직원 수는 2,340명이며, 정규직 비율은 94.2%입니다.", last_modified: null },
                commentary: { current: "여성 임원 비율은 18.2%로 전년 대비 2.1%p 증가하였으며, 다양성 확대 정책을 지속적으로 추진하고 있습니다.", last_modified: null },
                data_points: [{ dp_id: 3, dp_name: "총 임직원 수", unit: "명", indicator_code: "GRI 2-7", has_data: true, rows: [{ id: 3, site_id: "전사", reporting_date: "2023-12", value: 2340, unit: "명" }] }]
              },
              {
                field_id: "GRI-403-9",
                title: "산업 안전",
                context: { current: "2023년 산업재해율은 0.42%로, 업종 평균(0.58%) 대비 낮은 수준을 유지하고 있습니다.", last_modified: null },
                commentary: { current: "안전관리 시스템 ISO 45001 인증을 유지하며 무사고 사업장 달성을 목표로 하고 있습니다.", last_modified: null },
                data_points: []
              }
            ]
          },
          {
            esg_id: 3,
            label: "지배구조 (G)",
            items: [
              {
                field_id: "GRI-2-9",
                title: "이사회 독립성",
                context: { current: "2023년 기준 이사회 내 사외이사 비율은 62.5%로, 이사회의 독립적 의사결정 체계를 강화하고 있습니다.", last_modified: null },
                commentary: { current: "감사위원회는 100% 사외이사로 구성되어 있으며, ESG 전문위원회를 신설하여 지속가능경영 의사결정 체계를 강화하였습니다.", last_modified: null },
                data_points: []
              },
              {
                field_id: "GRI-205-3",
                title: "윤리 경영",
                context: { current: "2023년 윤리 위반 사건은 총 3건이 접수되었으며, 모두 내부 윤리위원회 심의를 거쳐 처리 완료되었습니다.", last_modified: null },
                commentary: { current: "임직원 윤리교육 이수율은 98.7%를 기록하였으며, 익명 신고 채널을 강화하여 내부 감시 기능을 제고하였습니다.", last_modified: null },
                data_points: []
              }
            ]
          }
        ]
      }); setLoading(false);
    }
  }, []);

  // Count modifications
  useEffect(() => {
    if (!draft) return;
    let count = 0;
    for (const sec of draft.sections) {
      for (const item of sec.items) {
        if (item.context.last_modified)    count++;
        if (item.commentary.last_modified) count++;
      }
    }
    setModCount(count);
  }, [draft]);

  const toggleSection = (esgId) => {
    setExpandedSections(prev => ({ ...prev, [esgId]: !prev[esgId] }));
  };

  const handleEdit = (fieldId, fieldType, value) => {
    setDraft(prev => ({
      ...prev,
      sections: prev.sections.map(sec => ({
        ...sec,
        items: sec.items.map(item =>
          item.field_id === fieldId
            ? {
                ...item,
                [fieldType]: {
                  ...item[fieldType],
                  current:       value,
                  last_modified: new Date().toISOString().slice(0, 19),
                },
              }
            : item
        ),
      })),
    }));
  };

  const handleBlur = async (fieldId, fieldType, value) => {
    setEditingKey(null);
    setSaving(true);
    try {
      // mock save
    } catch (_) {
      // silent — mock always succeeds
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    navigate("/report-download", { state: { draft } });
  };

  if (loading) return <LoadingScreen />;
  if (!draft)  return <ErrorScreen />;

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.body}>
        <Sidebar currentStep="report" />
        <main style={s.main}>

          {/* 헤더 */}
          <div style={s.header}>
            <p style={s.eyebrow}>STEP 02 · 초안 편집</p>
            <div style={s.headerRow}>
              <div>
                <h1 style={s.title}>ESG 보고서 초안 편집</h1>
                <p style={s.sub}>
                  항목별 평가 맥락과 AI 해설을 직접 수정할 수 있습니다.
                  데이터 포인트는 읽기 전용으로 표시됩니다.
                </p>
              </div>
              <div style={s.headerMeta}>
                {saving && <span style={s.savingBadge}>저장 중...</span>}
                {modCount > 0 && (
                  <span style={s.modBadge}>{modCount}개 항목 수정됨</span>
                )}
                <button style={s.confirmBtn} onClick={handleConfirm}>
                  저장 형식 선택 →
                </button>
              </div>
            </div>
          </div>

          {/* 섹션별 렌더 */}
          {draft.sections.map(sec => {
            const color = SECTION_COLORS[sec.esg_id] || DEFAULT_COLOR;
            return (
              <div key={sec.esg_id} style={s.section}>
                {/* 섹션 헤더 */}
                <button
                  style={{ ...s.sectionHeader, background: color.bg, borderColor: color.border, width: "100%", cursor: "pointer" }}
                  onClick={() => toggleSection(sec.esg_id)}
                >
                  <span style={{ ...s.sectionLabel, color: color.label }}>{sec.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={s.sectionCount}>{sec.items.length}개 항목</span>
                    <span style={{ fontSize: 12, color: color.label }}>{expandedSections[sec.esg_id] ? "▲" : "▽"}</span>
                  </div>
                </button>

                {/* 아이템 목록 */}
                {expandedSections[sec.esg_id] && sec.items.map(item => (
                  <ItemCard
                    key={item.field_id}
                    item={item}
                    color={color}
                    editingKey={editingKey}
                    setEditingKey={setEditingKey}
                    onEdit={handleEdit}
                    onBlur={handleBlur}
                  />
                ))}
              </div>
            );
          })}



        </main>
      </div>
    </div>
  );
}

/* ─────────── ItemCard ─────────── */
function ItemCard({ item, editingKey, setEditingKey, onEdit, onBlur }) {
  const ctxKey  = `${item.field_id}_context`;
  const comKey  = `${item.field_id}_commentary`;
  const ctxMod  = !!item.context.last_modified;
  const comMod  = !!item.commentary.last_modified;

  return (
    <div style={s.card}>
      {/* 카드 헤더 */}
      <div style={s.cardHeader}>
        <span style={s.fieldId}>{item.field_id}</span>
        <h3 style={s.cardTitle}>{item.title}</h3>
        {(ctxMod || comMod) && <span style={s.modDot} title="수정됨" />}
      </div>

      {/* 평가 맥락 */}
      <EditableField
        label="평가 맥락"
        value={item.context.current}
        isEditing={editingKey === ctxKey}
        modified={ctxMod}
        lastModified={item.context.last_modified}
        onFocus={() => setEditingKey(ctxKey)}
        onChange={v => onEdit(item.field_id, "context", v)}
        onBlur={v => onBlur(item.field_id, "context", v)}
      />

      {/* AI 해설 */}
      <EditableField
        label="AI 해설"
        value={item.commentary.current}
        isEditing={editingKey === comKey}
        modified={comMod}
        lastModified={item.commentary.last_modified}
        onFocus={() => setEditingKey(comKey)}
        onChange={v => onEdit(item.field_id, "commentary", v)}
        onBlur={v => onBlur(item.field_id, "commentary", v)}
        tall
      />

      {/* 데이터 포인트 */}
      {item.data_points?.length > 0 && (
        <div style={s.dpSection}>
          <p style={s.dpLabel}>데이터 포인트</p>
          {item.data_points.map(dp => (
            <DataPointTable key={dp.dp_id} dp={dp} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── EditableField ─────────── */
function EditableField({ label, value, isEditing, modified, lastModified, onFocus, onChange, onBlur, tall }) {
  return (
    <div style={s.fieldWrap}>
      <div style={s.fieldLabelRow}>
        <span style={s.fieldLabel}>{label}</span>
        {modified && lastModified && (
          <span style={s.modTime}>수정됨 · {lastModified.slice(0, 16).replace("T", " ")}</span>
        )}
        {!isEditing && (
          <button style={s.editBtn} onClick={onFocus}>편집</button>
        )}
      </div>
      {isEditing ? (
        <textarea
          autoFocus
          style={{ ...s.textarea, minHeight: tall ? 96 : 56 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onBlur(e.target.value)}
        />
      ) : (
        <div
          style={{ ...s.fieldText, borderColor: modified ? "#A8C070" : "#f0f0ee" }}
          onClick={onFocus}
          title="클릭하여 편집"
        >
          {value || <span style={{ color: "#ccc" }}>—</span>}
        </div>
      )}
    </div>
  );
}

/* ─────────── DataPointTable ─────────── */
function DataPointTable({ dp }) {
  return (
    <div style={s.dpCard}>
      <div style={s.dpCardHeader}>
        <span style={s.dpName}>{dp.dp_name}</span>
        <span style={s.dpUnit}>{dp.unit}</span>
        <span style={s.dpIndicator}>{dp.indicator_code}</span>
      </div>

      {dp.has_data && dp.rows.length > 0 ? (
        <table style={s.table}>
          <thead>
            <tr>
              {["사이트", "보고일", "값", "단위"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dp.rows.map(row => (
              <tr key={row.id} style={s.tr}>
                <td style={s.td}>{row.site_id}</td>
                <td style={s.td}>{row.reporting_date?.slice(0, 7)}</td>
                <td style={{ ...s.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {typeof row.value === "number" ? row.value.toLocaleString() : row.value}
                </td>
                <td style={s.td}>{row.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={s.noData}>입력된 데이터가 없습니다.</div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: 14 }}>
        초안 불러오는 중...
      </div>
    </div>
  );
}

function ErrorScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#991b1b", fontSize: 14 }}>
        초안을 불러오지 못했습니다. 보고서 생성 단계부터 다시 시도해주세요.
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "0 48px 44px", maxWidth: 960 },

  header:    { position: "sticky", top: 64, zIndex: 10, background: "#FAF8F0", paddingTop: 28, paddingBottom: 16, marginBottom: 20, borderBottom: "1px solid #e8e3da", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  eyebrow:   { fontSize: 12, fontWeight: 600, color: "#5C6B2E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  headerRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  title:     { fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  sub:       { fontSize: 14, color: "#777", lineHeight: 1.6, margin: 0 },
  headerMeta: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 4 },
  savingBadge: { fontSize: 11, color: "#888", background: "#f0f0ee", borderRadius: 20, padding: "3px 10px" },
  modBadge:    { fontSize: 11, fontWeight: 700, color: "#5C6B2E", background: "rgba(92,107,46,0.1)", border: "1px solid #A8C070", borderRadius: 20, padding: "3px 10px" },
  confirmBtn:  { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" },

  section:       { marginBottom: 32 },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: 10, border: "1px solid", marginBottom: 12 },
  sectionLabel:  { fontSize: 14, fontWeight: 700 },
  sectionCount:  { fontSize: 12, color: "#888" },

  card:       { background: "white", borderRadius: 16, padding: "24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 16 },
  cardHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid #f5f5f3" },
  fieldId:    { fontSize: 10, fontWeight: 700, color: "#84934A", background: "rgba(132,147,74,0.1)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 },
  cardTitle:  { fontSize: 15, fontWeight: 700, color: "#1a1a1a", flex: 1, margin: 0 },
  modDot:     { width: 8, height: 8, borderRadius: "50%", background: "#84934A", flexShrink: 0 },

  fieldWrap:    { marginBottom: 16 },
  fieldLabelRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  fieldLabel:   { fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em" },
  modTime:      { fontSize: 10, color: "#84934A", marginLeft: "auto" },
  editBtn:      { fontSize: 10, color: "#84934A", background: "none", border: "1px solid #A8C070", borderRadius: 4, padding: "1px 7px", cursor: "pointer", marginLeft: "auto" },
  fieldText:    { fontSize: 13, color: "#333", lineHeight: 1.65, padding: "10px 12px", background: "#fafaf8", border: "1px solid", borderRadius: 8, cursor: "text", whiteSpace: "pre-wrap" },
  textarea:     { width: "100%", boxSizing: "border-box", fontSize: 13, color: "#1a1a1a", lineHeight: 1.65, padding: "10px 12px", background: "white", border: "1.5px solid #84934A", borderRadius: 8, resize: "vertical", outline: "none", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },

  dpSection: { marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0f0ee" },
  dpLabel:   { fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 },
  dpCard:    { background: "#fafaf8", borderRadius: 10, border: "1px solid #f0f0ee", marginBottom: 10, overflow: "hidden" },
  dpCardHeader: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #f0f0ee" },
  dpName:    { fontSize: 12, fontWeight: 600, color: "#444", flex: 1 },
  dpUnit:    { fontSize: 11, color: "#888", background: "#ede9e0", borderRadius: 4, padding: "1px 6px" },
  dpIndicator: { fontSize: 10, color: "#84934A", background: "rgba(132,147,74,0.1)", borderRadius: 4, padding: "1px 6px" },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th:    { padding: "6px 12px", background: "#f5f5f3", color: "#888", fontWeight: 600, textAlign: "left", fontSize: 11 },
  tr:    { borderBottom: "1px solid #f5f5f3" },
  td:    { padding: "6px 12px", color: "#444" },
  noData: { padding: "10px 12px", fontSize: 12, color: "#bbb", fontStyle: "italic" },

  bottomBar: { marginTop: 32, paddingTop: 24, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end" },
  confirmBtnLg: { background: "#84934A", color: "white", border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
};