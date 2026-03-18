import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const formats = [
  {
    id: "word",
    icon: "📄",
    label: "Word",
    ext: ".docx",
    desc: "편집 가능한 문서 형식. 추가 수정이 필요할 때 적합합니다.",
    color: "#1e40af",
    bg: "#eff6ff",
  },
  {
    id: "excel",
    icon: "📊",
    label: "Excel",
    ext: ".xlsx",
    desc: "데이터 테이블 및 수치 중심 정리. 내부 검토용으로 활용하세요.",
    color: "#065f46",
    bg: "#ecfdf5",
  },
  {
    id: "ppt",
    icon: "📑",
    label: "PowerPoint",
    ext: ".pptx",
    desc: "경영진 보고 및 IR용 프레젠테이션 형식입니다.",
    color: "#92400e",
    bg: "#fffbeb",
  },
  {
    id: "pdf",
    icon: "🗂️",
    label: "PDF",
    ext: ".pdf",
    desc: "최종 배포용 고정 형식. 외부 공시 및 제출용으로 사용하세요.",
    color: "#991b1b",
    bg: "#fef2f2",
  },
];

const standards = ["GRI", "ISSB", "ESRS", "SASB"];

const previewSections = [
  { label: "표지 / 목차", pages: "1-2p" },
  { label: "CEO 메시지", pages: "3p" },
  { label: "환경 (E) — 탄소·에너지·용수", pages: "4-8p" },
  { label: "사회 (S) — 안전·인권·다양성", pages: "9-13p" },
  { label: "지배구조 (G) — 이사회·윤리", pages: "14-17p" },
  { label: "ESG 데이터 요약표", pages: "18-20p" },
  { label: "GRI Content Index", pages: "21-22p" },
];

function ReportDownload({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";
  const generatedSections = location.state?.generatedSections || {};
  const stateStandard = location.state?.standard || null;

  const [selectedFormats, setSelectedFormats] = useState(["pdf"]);
  const [selectedStandard, setSelectedStandard] = useState("GRI");
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const toggleFormat = (id) => {
    setSelectedFormats((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleDownload = async () => {
    if (selectedFormats.length === 0) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf").then(m => ({ jsPDF: m.jsPDF })),
      ]);

      const today = new Date();
      const dateStr = `${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2,"0")}. ${String(today.getDate()).padStart(2,"0")}.`;

      const container = document.createElement("div");
      container.style.cssText = `
        position:fixed; left:-9999px; top:0;
        width:794px; background:white; padding:60px 64px;
        font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;
        color:#1a1a1a; font-size:14px; line-height:1.85; box-sizing:border-box;
      `;
      const esgSections = [
        { id: "env_carbon", category: "환경 (E)", metric: "온실가스 배출량", standard: "GRI 305-1", data: { value: "12,450 tCO₂e", change: "-3.2%", year: 2023 } },
        { id: "env_energy", category: "환경 (E)", metric: "에너지 사용량", standard: "GRI 302-1", data: { value: "84,200 MWh", renewable: "18.4%", year: 2023 } },
        { id: "env_water", category: "환경 (E)", metric: "용수 사용량", standard: "GRI 303-5", data: { value: "19,200 톤", recycleRate: "62%", year: 2023 } },
        { id: "soc_employee", category: "사회 (S)", metric: "임직원 현황", standard: "GRI 2-7", data: { total: "2,340명", female: "18.2%", permanent: "94.2%", year: 2023 } },
        { id: "soc_safety", category: "사회 (S)", metric: "산업 안전", standard: "GRI 403-9", data: { rate: "0.42%", avg: "0.58%", year: 2023 } },
        { id: "gov_board", category: "지배구조 (G)", metric: "이사회 독립성", standard: "GRI 2-9", data: { independence: "62.5%", audit: "100%", year: 2023 } },
        { id: "gov_ethics", category: "지배구조 (G)", metric: "윤리 경영", standard: "GRI 205-3", data: { violations: "3건", training: "98.7%", year: 2023 } },
      ];
      const hasContent = Object.keys(generatedSections).length > 0;

      container.innerHTML = `
        <div style="width:100%;height:6px;background:#5C6B2E;margin-bottom:40px;border-radius:2px;"></div>
        <div style="font-size:10px;color:#5C6B2E;font-weight:700;letter-spacing:0.1em;margin-bottom:8px;">지속가능경영보고서 · ${selectedStandard} 기준 · 초안</div>
        <div style="font-size:28px;font-weight:700;color:#1a1a1a;margin-bottom:6px;">ESG 보고서 초안</div>
        <div style="font-size:13px;color:#666;margin-bottom:4px;">${selectedStandard} 기준 ESG 지속가능경영보고서 초안입니다.</div>
        <div style="font-size:11px;color:#aaa;margin-bottom:28px;">생성일: ${dateStr} &nbsp;|&nbsp; 원본 파일: ${fileName}</div>
        <div style="height:1px;background:linear-gradient(90deg,#5C6B2E,#C8D4A0,transparent);margin-bottom:32px;"></div>

        ${hasContent ? `
          ${esgSections.map(sec => `
            <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #eee;">
              <div style="font-size:10px;font-weight:700;color:#5C6B2E;letter-spacing:0.1em;margin-bottom:3px;">${sec.category}</div>
              <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${sec.standard}</div>
              <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">${sec.metric}</div>
              <div style="background:#FAFDF5;border-left:4px solid #5C6B2E;padding:12px 16px;border-radius:0 6px 6px 0;font-size:13px;color:#333;line-height:1.85;margin-bottom:10px;">
                ${generatedSections[sec.id] || "초안이 생성되지 않았습니다."}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${Object.entries(sec.data).map(([k,v]) => `<span style="background:#f5f5f0;border:1px solid #e0ddd6;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;">${k}: ${v}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        ` : `
          <div style="font-size:16px;font-weight:700;margin-bottom:16px;">목차</div>
          ${previewSections.map((sec, i) => `
            <div style="display:flex;justify-content:space-between;padding:10px 14px;margin-bottom:6px;background:${i%2===0?'#fafaf8':'white'};border-radius:6px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="width:22px;height:22px;border-radius:50%;background:rgba(92,107,46,0.12);color:#5C6B2E;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${i+1}</span>
                <span style="font-size:13px;font-weight:500;">${sec.label}</span>
              </div>
              <span style="font-size:12px;color:#aaa;">${sec.pages}</span>
            </div>
          `).join("")}
        `}

        <div style="margin-top:32px;padding:14px 18px;background:#FAFDF5;border:1px solid #A8C070;border-radius:8px;font-size:11px;color:#5C6B2E;line-height:1.7;">
          ※ 본 초안은 AI가 자동 생성한 내용으로, 공식 제출 전 ESG 전문가의 검토 및 수정이 반드시 필요합니다.<br/>
          생성 기준서: ${selectedStandard} &nbsp;|&nbsp; 생성일: ${dateStr}
        </div>
        <div style="margin-top:28px;padding-top:12px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#bbb;">
          <span>ESG 지속가능경영보고서 초안</span><span>${dateStr}</span>
        </div>
      `;
      document.body.appendChild(container);
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 400));

      const canvas = await html2canvas(container, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff", width: 794,
      });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/png");
      for (const fmtId of selectedFormats) {
        const fmt = formats.find(f => f.id === fmtId);
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pdfW = 210, pdfH = 297;
        const imgH = (canvas.height * pdfW) / canvas.width;
        let posY = 0;
        while (posY < imgH) {
          if (posY > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -posY, pdfW, imgH);
          posY += pdfH;
        }
        const todayStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,"0")}${String(today.getDate()).padStart(2,"0")}`;
        pdf.save(`ESG_보고서_${selectedStandard}_${todayStr}.pdf`);
      }

      setDownloading(false);
      setDone(true);
    } catch (e) {
      console.error("다운로드 오류:", e);
      alert("다운로드 중 오류: " + e.message);
      setDownloading(false);
    }
  };

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
              <h1 style={s.title}>보고서 다운로드</h1>
              <p style={s.sub}>원하는 형식과 기준서를 선택하고 보고서를 다운로드하세요.</p>
            </div>
          </div>

          <div style={s.twoCol}>

            {/* Left: Options */}
            <div style={s.leftCol}>

              {/* Standard */}
              <div style={s.panel}>
                <p style={s.panelLabel}>기준서 선택</p>
                <div style={s.stdGrid}>
                  {standards.map((std) => (
                    <button
                      key={std}
                      style={{
                        ...s.stdCard,
                        borderColor: selectedStandard === std ? "#84934A" : "#e0e0e0",
                        background: selectedStandard === std ? "rgba(132,147,74,0.07)" : "white",
                      }}
                      onClick={() => setSelectedStandard(std)}
                    >
                      <div style={{ ...s.stdCheck, background: selectedStandard === std ? "#84934A" : "white", borderColor: "#84934A", color: "white" }}>
                        {selectedStandard === std ? "✓" : ""}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: selectedStandard === std ? "#84934A" : "#333" }}>{std}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Format */}
              <div style={s.panel}>
                <p style={s.panelLabel}>다운로드 형식 (복수 선택 가능)</p>
                <div style={s.formatList}>
                  {formats.map((fmt) => {
                    const active = selectedFormats.includes(fmt.id);
                    return (
                      <button
                        key={fmt.id}
                        style={{
                          ...s.formatCard,
                          borderColor: active ? fmt.color : "#e0e0e0",
                          background: active ? fmt.bg : "white",
                        }}
                        onClick={() => toggleFormat(fmt.id)}
                      >
                        <div style={s.fmtLeft}>
                          <span style={s.fmtIcon}>{fmt.icon}</span>
                          <div>
                            <div style={s.fmtTitle}>
                              {fmt.label}
                              <span style={{ ...s.fmtExt, color: fmt.color }}>{fmt.ext}</span>
                            </div>
                            <div style={s.fmtDesc}>{fmt.desc}</div>
                          </div>
                        </div>
                        <div style={{ ...s.fmtCheck, background: active ? fmt.color : "white", borderColor: fmt.color, color: "white" }}>
                          {active ? "✓" : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Download Button */}
              {!done ? (
                <button
                  style={{
                    ...s.downloadBtn,
                    opacity: selectedFormats.length === 0 || downloading ? 0.6 : 1,
                    cursor: selectedFormats.length === 0 ? "not-allowed" : "pointer",
                  }}
                  disabled={selectedFormats.length === 0 || downloading}
                  onClick={handleDownload}
                >
                  {downloading ? (
                    <span>⏳ 생성 중...</span>
                  ) : (
                    <span>⬇ 보고서 다운로드 ({selectedFormats.length}개 형식)</span>
                  )}
                </button>
              ) : (
                <div style={s.doneBox}>
                  <span style={s.doneIcon}>✓</span>
                  <div>
                    <div style={s.doneTitle}>다운로드 완료!</div>
                    <div style={s.doneSub}>
                      {selectedStandard} 기준 보고서 {selectedFormats.length}개 파일이 저장되었습니다.
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Right: Preview */}
            <div style={s.rightCol}>
              <div style={s.panel}>
                <p style={s.panelLabel}>보고서 구성 미리보기</p>
                <div style={s.previewHeader}>
                  <div style={s.previewCover}>
                    <div style={s.previewLogo}>EDM</div>
                    <div style={s.previewReportTitle}>ESG 지속가능경영보고서</div>
                    <div style={s.previewYear}>2023</div>
                    <div style={s.previewStd}>{selectedStandard} 기준</div>
                  </div>
                </div>
                <div style={s.tocList}>
                  {previewSections.map((sec, i) => (
                    <div key={i} style={s.tocItem}>
                      <div style={s.tocLeft}>
                        <span style={s.tocNum}>{i + 1}</span>
                        <span style={s.tocLabel}>{sec.label}</span>
                      </div>
                      <span style={s.tocPages}>{sec.pages}</span>
                    </div>
                  ))}
                </div>
                <div style={s.previewMeta}>
                  <span>총 22페이지</span>
                  <span>·</span>
                  <span>{selectedStandard} Content Index 포함</span>
                </div>
              </div>
            </div>

          </div>

          <div style={s.bottomRow}>
            <button style={s.secBtn} onClick={() => navigate(-1)}>← 초안으로 돌아가기</button>
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
  header: { marginBottom: 28 },
  eyebrow: { fontSize: 12, fontWeight: 600, color: "#84934A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  title: { fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  sub: { fontSize: 14, color: "#777" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 },
  leftCol: { display: "flex", flexDirection: "column", gap: 20 },
  rightCol: {},
  panel: { background: "white", borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" },
  panelLabel: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 },
  stdGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  stdCard: { display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, border: "1.5px solid", cursor: "pointer", background: "white", textAlign: "left" },
  stdCheck: { width: 20, height: 20, borderRadius: "50%", border: "1.5px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  formatList: { display: "flex", flexDirection: "column", gap: 10 },
  formatCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 10, border: "1.5px solid", cursor: "pointer", textAlign: "left" },
  fmtLeft: { display: "flex", alignItems: "center", gap: 12 },
  fmtIcon: { fontSize: 22 },
  fmtTitle: { fontSize: 14, fontWeight: 700, color: "#222", display: "flex", alignItems: "center", gap: 6, marginBottom: 2 },
  fmtExt: { fontSize: 12, fontWeight: 600 },
  fmtDesc: { fontSize: 12, color: "#888", lineHeight: 1.4 },
  fmtCheck: { width: 22, height: 22, borderRadius: "50%", border: "1.5px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  downloadBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 12, padding: "16px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", textAlign: "center" },
  doneBox: { background: "#ecfdf5", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 },
  doneIcon: { width: 40, height: 40, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  doneTitle: { fontSize: 15, fontWeight: 700, color: "#065f46" },
  doneSub: { fontSize: 13, color: "#065f46", opacity: 0.75, marginTop: 2 },
  previewHeader: { marginBottom: 16 },
  previewCover: { background: "linear-gradient(135deg, #1a2e0f 0%, #84934A 100%)", borderRadius: 12, padding: "24px", textAlign: "center", color: "white" },
  previewLogo: { fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: "0.1em", marginBottom: 8 },
  previewReportTitle: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  previewYear: { fontSize: 28, fontWeight: 900, marginBottom: 4 },
  previewStd: { fontSize: 12, color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.15)", display: "inline-block", padding: "3px 12px", borderRadius: 20 },
  tocList: { display: "flex", flexDirection: "column", gap: 2 },
  tocItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "#fafaf8" },
  tocLeft: { display: "flex", alignItems: "center", gap: 10 },
  tocNum: { width: 22, height: 22, borderRadius: "50%", background: "rgba(132,147,74,0.12)", color: "#84934A", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tocLabel: { fontSize: 13, color: "#333", fontWeight: 500 },
  tocPages: { fontSize: 12, color: "#aaa" },
  previewMeta: { display: "flex", gap: 6, fontSize: 12, color: "#aaa", marginTop: 14, justifyContent: "center" },
  bottomRow: { display: "flex", justifyContent: "flex-start", gap: 12 },
  secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
};

export default ReportDownload;