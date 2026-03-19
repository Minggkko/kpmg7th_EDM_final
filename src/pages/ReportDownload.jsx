import { useState } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { useNavigate, useLocation } from "react-router-dom";
import { FileText, Download } from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";

const FORMATS = [
  {
    id: "pdf",
    label: "PDF",
    ext: "pdf",
    desc: "Adobe PDF 형식으로 저장합니다. 인쇄 및 배포에 적합합니다.",
    color: "#dc2626",
    bg:    "#fef2f2",
    border:"#fca5a5",
  },
  {
    id: "docx",
    label: "Word (DOCX)",
    ext: "docx",
    desc: "Microsoft Word 형식으로 저장합니다. 추가 편집이 가능합니다.",
    color: "#1d4ed8",
    bg:    "#eff6ff",
    border:"#bfdbfe",
  },
  {
    id: "hwp",
    label: "한글 (HWP)",
    ext: "hwp",
    desc: "한글 워드프로세서 형식으로 저장합니다.",
    color: "#065f46",
    bg:    "#ecfdf5",
    border:"#bbf7d0",
  },
];

export default function ReportDownload() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const draft     = location.state?.draft;

  const [selectedFmt, setSelectedFmt] = useState("pdf");
  const [status, setStatus]           = useState("idle"); // idle | loading | done | error
  const [errMsg, setErrMsg]           = useState("");

  const handleExport = async () => {
    if (status === "loading") return;
    setStatus("loading");
    setErrMsg("");

    try {
      if (selectedFmt === "docx") {
        await exportDocx(draft);
      } else {
        // PDF, HWP는 추후 백엔드 연동 예정
        alert(`${selectedFmt.toUpperCase()} 형식은 준비 중입니다.`);
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch (e) {
      setErrMsg(e.message || "내보내기 실패");
      setStatus("error");
    }
  };

  const exportDocx = async (draft) => {
    if (!draft) throw new Error("초안 데이터가 없습니다.");

    const children = [];

    // 표지
    children.push(
      new Paragraph({
        text: "ESG 지속가능경영 보고서",
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `생성일: ${draft.generated_at?.slice(0,10) ?? ""}`, color: "888888", size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
      }),
    );

    // 섹션별 내용
    for (const sec of draft.sections ?? []) {
      children.push(
        new Paragraph({
          text: sec.label,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "5C6B2E" } },
        })
      );

      for (const item of sec.items ?? []) {
        // 항목 제목
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[${item.field_id}] `, color: "5C6B2E", bold: true, size: 22 }),
              new TextRun({ text: item.title, bold: true, size: 24 }),
            ],
            spacing: { before: 300, after: 100 },
          })
        );

        // 평가 맥락
        children.push(
          new Paragraph({ children: [new TextRun({ text: "▶ 평가 맥락", bold: true, size: 20, color: "444444" })], spacing: { before: 100, after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: item.context?.current ?? "", size: 20, color: "333333" })], spacing: { after: 100 }, indent: { left: 300 } }),
        );

        // AI 해설
        children.push(
          new Paragraph({ children: [new TextRun({ text: "▶ AI 해설", bold: true, size: 20, color: "444444" })], spacing: { before: 100, after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: item.commentary?.current ?? "", size: 20, color: "333333" })], spacing: { after: 200 }, indent: { left: 300 } }),
        );
      }
    }

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `ESG_보고서_${new Date().toISOString().slice(0,10)}.docx`);
  };

  const selectedInfo = FORMATS.find(f => f.id === selectedFmt);

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.body}>
        <Sidebar currentStep="report" />
        <main style={s.main}>

          {/* 헤더 */}
          <div style={s.header}>
            <p style={s.eyebrow}>STEP 03 · 저장 형식 선택</p>
            <h1 style={s.title}>보고서 저장</h1>
            <p style={s.sub}>
              원하는 파일 형식을 선택하고 다운로드하세요.
              {draft?.draft_id && (
                <span style={s.draftId}> Draft ID: {draft.draft_id.slice(0, 8)}...</span>
              )}
            </p>
          </div>

          <div style={s.layout}>
            {/* 왼쪽: 형식 선택 */}
            <div style={s.leftCol}>
              <div style={s.panel}>
                <p style={s.panelLabel}>저장 형식</p>
                {FORMATS.map(fmt => (
                  <button
                    key={fmt.id}
                    style={{
                      ...s.fmtCard,
                      borderColor:   selectedFmt === fmt.id ? fmt.color : "#e5e7eb",
                      background:    selectedFmt === fmt.id ? fmt.bg    : "white",
                      boxShadow:     selectedFmt === fmt.id ? `0 0 0 2px ${fmt.color}22` : "none",
                    }}
                    onClick={() => { setSelectedFmt(fmt.id); setStatus("idle"); }}
                  >
                    <div style={{ ...s.fmtDot, background: fmt.color }} />
                    <div style={s.fmtInfo}>
                      <div style={{ ...s.fmtLabel, color: selectedFmt === fmt.id ? fmt.color : "#1a1a1a" }}>
                        {fmt.label}
                      </div>
                      <div style={s.fmtDesc}>{fmt.desc}</div>
                    </div>
                    {selectedFmt === fmt.id && (
                      <div style={{ ...s.fmtCheck, color: fmt.color }}>✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 오른쪽: 다운로드 */}
            <div style={s.rightCol}>
              {/* 요약 카드 */}
              <div style={s.panel}>
                <p style={s.panelLabel}>내보내기 정보</p>
                <div style={s.summaryRow}>
                  <span style={s.summaryKey}>파일 형식</span>
                  <span style={{ ...s.summaryVal, color: selectedInfo.color, fontWeight: 700 }}>
                    .{selectedInfo.ext.toUpperCase()}
                  </span>
                </div>
                <div style={s.summaryRow}>
                  <span style={s.summaryKey}>섹션 수</span>
                  <span style={s.summaryVal}>{draft?.sections?.length ?? "—"}</span>
                </div>
                <div style={s.summaryRow}>
                  <span style={s.summaryKey}>생성일</span>
                  <span style={s.summaryVal}>
                    {draft?.generated_at?.slice(0, 10) ?? "—"}
                  </span>
                </div>
                <div style={s.summaryRow}>
                  <span style={s.summaryKey}>버전</span>
                  <span style={s.summaryVal}>v{draft?.version ?? 1}</span>
                </div>
              </div>

              {/* 오류 */}
              {status === "error" && (
                <div style={s.errorBox}>
                  <strong>오류:</strong> {errMsg}
                </div>
              )}

              {/* 완료 배너 */}
              {status === "done" && (
                <div style={s.doneBanner}>
                  <div style={s.doneIcon}>✓</div>
                  <div>
                    <div style={s.doneTitle}>다운로드 완료!</div>
                    <div style={s.doneSub}>파일이 저장되었습니다.</div>
                  </div>
                </div>
              )}

              {/* 다운로드 버튼 */}
              <button
                style={{
                  ...s.downloadBtn,
                  opacity: status === "loading" ? 0.7 : 1,
                  cursor:  status === "loading" ? "not-allowed" : "pointer",
                }}
                onClick={handleExport}
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <LoadingSpinner /> 내보내는 중...
                  </>
                ) : (
                  <>
                    <Download size={16} style={{ marginRight: 8 }} />
                    {selectedInfo.label}로 다운로드
                  </>
                )}
              </button>

              {/* 처음으로 버튼 */}
              <button style={s.restartBtn} onClick={() => navigate("/report-generate")}>
                ↩ 새 보고서 생성
              </button>


            </div>
          </div>

          {/* 드래프트 미리보기 (접힘) */}
          {draft && <DraftPreview draft={draft} />}

        </main>
      </div>
    </div>
  );
}

/* ─────────── DraftPreview ─────────── */
function DraftPreview({ draft }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={s.previewWrap}>
      <button style={s.previewToggle} onClick={() => setOpen(v => !v)}>
        <FileText size={14} style={{ marginRight: 6 }} />
        초안 내용 {open ? "접기" : "펼치기"}
        <span style={{ marginLeft: 6, fontSize: 10, color: "#aaa" }}>
          ({draft.sections.reduce((a, sec) => a + sec.items.length, 0)}개 항목)
        </span>
      </button>
      {open && (
        <div style={s.previewBody}>
          {draft.sections.map(sec => (
            <div key={sec.esg_id} style={s.previewSection}>
              <div style={s.previewSecLabel}>{sec.label}</div>
              {sec.items.map(item => (
                <div key={item.field_id} style={s.previewItem}>
                  <div style={s.previewItemTitle}>
                    <span style={s.previewFid}>{item.field_id}</span>
                    {item.title}
                  </div>
                  <div style={s.previewText}>{item.commentary.current}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <span style={{
      display: "inline-block", width: 12, height: 12,
      border: "2px solid white", borderTopColor: "transparent",
      borderRadius: "50%", marginRight: 8, verticalAlign: "middle",
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

// spinner keyframe
if (typeof document !== "undefined" && !document.getElementById("dl-spin")) {
  const tag = document.createElement("style");
  tag.id = "dl-spin";
  tag.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(tag);
}

const s = {
  page: { minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "44px 48px" },

  header:  { marginBottom: 32 },
  eyebrow: { fontSize: 12, fontWeight: 600, color: "#5C6B2E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  title:   { fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  sub:     { fontSize: 14, color: "#777", lineHeight: 1.6, margin: 0 },
  draftId: { fontSize: 12, color: "#aaa", fontFamily: "monospace" },

  layout:   { display: "flex", gap: 24, alignItems: "flex-start" },
  leftCol:  { flex: 1 },
  rightCol: { width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 },

  panel:      { background: "white", borderRadius: 16, padding: "22px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  panelLabel: { fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #f0f0f0" },

  fmtCard:  { display: "flex", alignItems: "flex-start", gap: 12, width: "100%", padding: "14px 16px", borderRadius: 12, border: "1.5px solid", marginBottom: 10, cursor: "pointer", textAlign: "left", background: "white", transition: "all 0.15s" },
  fmtDot:   { width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 4 },
  fmtInfo:  { flex: 1 },
  fmtLabel: { fontSize: 14, fontWeight: 700, marginBottom: 3 },
  fmtDesc:  { fontSize: 12, color: "#888", lineHeight: 1.5 },
  fmtCheck: { fontSize: 16, fontWeight: 700, flexShrink: 0 },

  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f5f5f3" },
  summaryKey: { fontSize: 12, color: "#888" },
  summaryVal: { fontSize: 12, color: "#1a1a1a" },

  downloadBtn: { display: "flex", alignItems: "center", justifyContent: "center", background: "#5C6B2E", color: "white", border: "none", borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, width: "100%", textAlign: "center" },
  restartBtn:  { display: "block", width: "100%", padding: "10px", fontSize: 13, color: "#888", background: "none", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" },

  doneBanner: { background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 },
  doneIcon:   { width: 36, height: 36, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  doneTitle:  { fontSize: 14, fontWeight: 700, color: "#065f46" },
  doneSub:    { fontSize: 12, color: "#065f46", opacity: 0.7, marginTop: 2 },

  errorBox: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#991b1b" },

  note:     { fontSize: 11, color: "#aaa", lineHeight: 1.7, padding: "12px 14px", background: "#fafaf8", border: "1px solid #e8e3da", borderRadius: 8 },
  noteCode: { fontSize: 10, background: "#ede9e0", padding: "1px 5px", borderRadius: 3, color: "#5C6B2E" },

  previewWrap:    { marginTop: 32 },
  previewToggle:  { display: "flex", alignItems: "center", background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#5C6B2E", cursor: "pointer", fontWeight: 600 },
  previewBody:    { marginTop: 12, background: "white", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  previewSection: { marginBottom: 20 },
  previewSecLabel: { fontSize: 12, fontWeight: 700, color: "#5C6B2E", marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #f0f0ee" },
  previewItem:    { marginBottom: 14, paddingLeft: 12, borderLeft: "3px solid #e5e7eb" },
  previewItemTitle: { fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 },
  previewFid:     { fontSize: 10, color: "#84934A", background: "rgba(132,147,74,0.1)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 },
  previewText:    { fontSize: 12, color: "#666", lineHeight: 1.6 },
};