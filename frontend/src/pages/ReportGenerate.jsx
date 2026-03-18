import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// 보고서를 localStorage에 저장
function saveReportToHistory({ fileName, standard, generatedSections, dateStr }) {
  const prev = JSON.parse(localStorage.getItem("esg_report_history") || "[]");
  const newEntry = {
    id: Date.now(),
    fileName,
    standard,
    generatedSections,
    dateStr,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem("esg_report_history", JSON.stringify([newEntry, ...prev].slice(0, 20)));
}

if (!document.head.querySelector("#rg-style")) {
  const tag = document.createElement("style");
  tag.id = "rg-style";
  tag.innerHTML = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
  `;
  document.head.appendChild(tag);
}



const esgSections = [
  { id: "env_carbon", category: "환경 (E)", metric: "온실가스 배출량", standard: "GRI 305-1", data: { value: "12,450 tCO₂e", change: "-3.2%", year: 2023 } },
  { id: "env_energy", category: "환경 (E)", metric: "에너지 사용량", standard: "GRI 302-1", data: { value: "84,200 MWh", renewable: "18.4%", year: 2023 } },
  { id: "env_water", category: "환경 (E)", metric: "용수 사용량", standard: "GRI 303-5", data: { value: "19,200 톤", recycleRate: "62%", year: 2023 } },
  { id: "soc_employee", category: "사회 (S)", metric: "임직원 현황", standard: "GRI 2-7", data: { total: "2,340명", female: "18.2%", permanent: "94.2%", year: 2023 } },
  { id: "soc_safety", category: "사회 (S)", metric: "산업 안전", standard: "GRI 403-9", data: { rate: "0.42%", avg: "0.58%", year: 2023 } },
  { id: "gov_board", category: "지배구조 (G)", metric: "이사회 독립성", standard: "GRI 2-9", data: { independence: "62.5%", audit: "100%", year: 2023 } },
  { id: "gov_ethics", category: "지배구조 (G)", metric: "윤리 경영", standard: "GRI 205-3", data: { violations: "3건", training: "98.7%", year: 2023 } },
];

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

async function generateSectionDraft(section, standard) {
  const dataStr = Object.entries(section.data).map(([k, v]) => `${k}: ${v}`).join(", ");
  const prompt = `당신은 ESG 지속가능경영보고서 전문 작성가입니다.
아래 데이터를 바탕으로 ${standard} 기준의 보고서 본문 초안을 작성해 주세요.
[섹션] ${section.category} > ${section.metric} (${section.standard})
[데이터] ${dataStr}
요구사항: 2~3문장, 100자 내외, 수치를 자연스럽게 서술에 포함, 공시 보고서 문체 (격식체, ~습니다), 제목/번호 없이 본문만 출력`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 200 }),
  });
  if (!res.ok) throw new Error("OpenAI API 오류");
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

const steps = [
  { label: "ESG 데이터 불러오기",    code: "STEP 01", desc: "분석 완료된 E·S·G 데이터를 보고서 엔진에 로드합니다." },
  { label: "기준서 매핑",            code: "STEP 02", desc: "GRI·ISSB·ESRS·SASB 항목별 공시 요건에 데이터를 매핑합니다." },
  { label: "AI 초안 작성",           code: "STEP 03", desc: "GPT-4o가 각 중대성 이슈별 서술문을 생성합니다." },
  { label: "지표 검증 및 교차 확인", code: "STEP 04", desc: "데이터 수치와 서술 내용의 일관성을 검토합니다." },
  { label: "보고서 구조 완성",       code: "STEP 05", desc: "목차·표지·부록을 포함한 최종 초안을 구성합니다." },
];

const standards = ["GRI", "ISSB", "ESRS", "SASB"];

function ReportGenerate({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";
  const selectedStandard = location.state?.standard || "GRI";

  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [generatedSections, setGeneratedSections] = useState({});
  const [error, setError] = useState(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const run = async () => {
      try {
        setCurrentStep(0); await animateProgress(0, 20, 800);
        setCurrentStep(1); await animateProgress(20, 40, 800);
        setCurrentStep(2);
        const results = {};
        for (let i = 0; i < esgSections.length; i++) {
          const section = esgSections[i];
          const draft = await generateSectionDraft(section, selectedStandard);
          results[section.id] = draft;
          setProgress(40 + Math.round(((i + 1) / esgSections.length) * 30));
        }
        setGeneratedSections(results);
        setCurrentStep(3); await animateProgress(70, 90, 800);
        setCurrentStep(4); await animateProgress(90, 100, 600);
        setDone(true);
        saveReportToHistory({ fileName, standard: selectedStandard, generatedSections: results, dateStr: new Date().toLocaleDateString("ko-KR") });
      } catch (e) {
        console.error(e);
        setError("API 호출 중 오류가 발생했습니다. API 키를 확인해 주세요.");
        setDone(true);
      }
    };
    run();
  }, []);

  const animateProgress = (from, to, duration) =>
    new Promise((resolve) => {
      const steps = to - from;
      const interval = duration / steps;
      let current = from;
      const timer = setInterval(() => {
        current++;
        setProgress(current);
        if (current >= to) { clearInterval(timer); resolve(); }
      }, interval);
    });

  const getStepStatus = (idx) => {
    if (idx < currentStep) return "done";
    if (idx === currentStep) return "active";
    return "waiting";
  };

  const today = new Date();
  const dateStr = `${today.getFullYear()}. ${String(today.getMonth() + 1).padStart(2, "0")}. ${String(today.getDate()).padStart(2, "0")}.`;

  const [downloading, setDownloading] = useState(false);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf").then(m => ({ jsPDF: m.jsPDF })),
      ]);

      // 브라우저에서 한국어 폰트 그대로 캡처하기 위해 숨김 div 렌더링
      const container = document.createElement("div");
      container.style.cssText = `
        position:fixed; left:-9999px; top:0;
        width:794px; background:white; padding:60px 64px;
        font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;
        color:#1a1a1a; font-size:14px; line-height:1.85; box-sizing:border-box;
      `;
      container.innerHTML = `
        <div style="width:100%;height:6px;background:#5C6B2E;margin-bottom:40px;border-radius:2px;"></div>
        <div style="font-size:10px;color:#5C6B2E;letter-spacing:0.1em;font-weight:700;margin-bottom:8px;">지속가능경영보고서 · ${selectedStandard} 기준 · 초안</div>
        <div style="font-size:28px;font-weight:700;color:#1a1a1a;margin-bottom:6px;">ESG 보고서 초안</div>
        <div style="font-size:13px;color:#666;margin-bottom:4px;">GPT-4o 기반 AI 엔진이 ${selectedStandard} 공시 기준에 따라 자동 생성한 초안입니다.</div>
        <div style="font-size:11px;color:#aaa;margin-bottom:28px;">생성일: ${dateStr} &nbsp;|&nbsp; 원본 파일: ${fileName}</div>
        <div style="height:1px;background:linear-gradient(90deg,#5C6B2E,#a3b86c,transparent);margin-bottom:32px;"></div>
        ${esgSections.map(sec => `
          <div style="margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #eee;">
            <div style="font-size:10px;font-weight:700;color:#5C6B2E;letter-spacing:0.1em;margin-bottom:3px;">${sec.category}</div>
            <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${sec.standard}</div>
            <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">${sec.metric}</div>
            <div style="background:#f5f7ee;border-left:4px solid #5C6B2E;padding:12px 16px;border-radius:0 6px 6px 0;font-size:13px;color:#333;line-height:1.85;margin-bottom:10px;">
              ${generatedSections[sec.id] || "초안이 생성되지 않았습니다."}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${Object.entries(sec.data).map(([k,v]) => `<span style="background:#f5f5f0;border:1px solid #e0ddd6;border-radius:4px;padding:2px 8px;font-size:11px;color:#666;">${k}: ${v}</span>`).join("")}
            </div>
          </div>
        `).join("")}
        <div style="margin-top:32px;padding:14px 18px;background:#f5f7ee;border:1px solid #a3b86c;border-radius:8px;font-size:11px;color:#5C6B2E;line-height:1.7;">
          ※ 본 초안은 AI가 자동 생성한 내용으로, 공식 제출 전 ESG 전문가의 검토 및 수정이 반드시 필요합니다.<br/>
          생성 기준서: ${selectedStandard} &nbsp;|&nbsp; 생성 모델: GPT-4o &nbsp;|&nbsp; 생성일: ${dateStr}
        </div>
        <div style="margin-top:32px;padding-top:12px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#bbb;">
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
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = 210, pdfH = 297;
      const imgH = (canvas.height * pdfW) / canvas.width;
      let posY = 0;
      while (posY < imgH) {
        if (posY > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -posY, pdfW, imgH);
        posY += pdfH;
      }

      const fname = `ESG_보고서_초안_${selectedStandard}_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,"0")}${String(today.getDate()).padStart(2,"0")}.pdf`;
      pdf.save(fname);

    } catch (e) {
      console.error("PDF 생성 오류:", e);
      alert("PDF 생성 중 오류가 발생했습니다: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={s.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="report" />
        <main style={s.main}>

          {/* Document Header */}
          <div style={s.docHeader}>
            <div style={s.docMeta}>
              <span style={s.docType}>지속가능경영보고서</span>
              <span style={s.docSep}>|</span>
              <span style={s.docRef}>초안 생성 프로세스</span>
            </div>
            <div style={s.docTitleRow}>
              <h1 style={s.docTitle}>ESG 보고서 자동 생성</h1>
              <div style={s.docDate}>{dateStr}</div>
            </div>
            <p style={s.docSubtitle}>
              GPT-4o 기반 AI 엔진이 {selectedStandard} 공시 기준에 따라 보고서 초안을 작성하고 있습니다.
            </p>
            <div style={s.docRule} />
          </div>

          <div style={s.layout}>
            {/* Left Column — Progress */}
            <div style={s.leftCol}>

              {/* Standard Badge Panel */}
              <div style={s.panel}>
                <div style={s.panelLabel}>적용 기준서</div>
                <div style={s.standardGrid}>
                  {standards.map((std) => (
                    <div key={std} style={{
                      ...s.stdItem,
                      borderColor: std === selectedStandard ? "#5C6B2E" : "#ddd",
                      background: std === selectedStandard ? "#5C6B2E" : "white",
                      color: std === selectedStandard ? "white" : "#bbb",
                    }}>
                      {std}
                      {std === selectedStandard && <span style={s.stdCheck}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* File Panel */}
              <div style={s.panel}>
                <div style={s.panelLabel}>분석 파일</div>
                <div style={s.fileRow}>
                  <div style={s.fileIcon}>PDF</div>
                  <div style={s.fileName}>{fileName}</div>
                </div>
              </div>

              {/* Progress Panel */}
              <div style={s.panel}>
                <div style={s.panelLabel}>생성 진행률</div>
                <div style={s.bigProgress}>
                  <span style={{
                    ...s.bigPct,
                    color: done && !error ? "#22c55e" : "#5C6B2E"
                  }}>
                    {progress}<span style={s.bigPctUnit}>%</span>
                  </span>
                  <div style={s.progressLabel}>
                    {done
                      ? (error ? "오류 발생" : "생성 완료")
                      : `${steps[currentStep]?.code} 진행 중`}
                  </div>
                </div>
                <div style={s.progressTrack}>
                  <div style={{
                    ...s.progressFill,
                    width: `${progress}%`,
                    background: done && !error
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : "linear-gradient(90deg, #5C6B2E, #a3b86c)",
                  }} />
                </div>
                {currentStep === 2 && !done && (
                  <div style={s.sectionNote}>
                    <span style={s.blinkDot} />
                    초안 작성 중 — {Object.keys(generatedSections).length}/{esgSections.length} 섹션 완료
                  </div>
                )}
              </div>
            </div>

            {/* Right Column — Step Log */}
            <div style={s.rightCol}>
              <div style={s.logHeader}>
                <span style={s.logTitle}>처리 단계</span>
                <span style={s.logCount}>{Math.min(currentStep + 1, steps.length)} / {steps.length}</span>
              </div>

              <div style={s.stepTable}>
                {steps.map((step, idx) => {
                  const status = getStepStatus(idx);
                  return (
                    <div key={idx} style={{
                      ...s.stepRow,
                      borderBottom: idx < steps.length - 1 ? "1px solid #e8e3da" : "none",
                      background: status === "active" ? "#f5f7ee" : "white",
                      animation: status === "active" ? "fadeSlideIn 0.4s ease" : "none",
                    }}>
                      {/* Step Code */}
                      <div style={s.stepCodeCol}>
                        <span style={{
                          ...s.stepCode,
                          color: status === "done" ? "#22c55e"
                            : status === "active" ? "#5C6B2E"
                            : "#ccc",
                          fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
                        }}>
                          {step.code}
                        </span>
                      </div>

                      {/* Step Info */}
                      <div style={s.stepInfo}>
                        <div style={{
                          ...s.stepName,
                          color: status === "waiting" ? "#ccc"
                            : status === "done" ? "#374151"
                            : "#1a1a1a",
                        }}>
                          {step.label}
                        </div>
                        {status === "active" && (
                          <div style={s.stepDesc}>{step.desc}</div>
                        )}
                      </div>

                      {/* Status */}
                      <div style={s.stepStatusCol}>
                        {status === "done" ? (
                          <div style={s.statusDone}>완료</div>
                        ) : status === "active" ? (
                          <div style={s.statusActive}>
                            <span style={{
                              width: 12, height: 12,
                              border: "2px solid #5C6B2E",
                              borderTopColor: "transparent",
                              borderRadius: "50%",
                              display: "inline-block",
                              animation: "spin 0.8s linear infinite",
                              marginRight: 6,
                            }} />
                            처리중
                          </div>
                        ) : (
                          <div style={s.statusWait}>대기</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Completion Banner */}
              {done && (
                <div style={{
                  ...s.completionBanner,
                  borderColor: error ? "#fca5a5" : "#a3b86c",
                  background: error ? "#fff8f8" : "#f5f7ee",
                  animation: "fadeSlideIn 0.5s ease",
                }}>
                  <div style={s.bannerTop}>
                    <div style={{
                      ...s.bannerIcon,
                      background: error ? "#ef4444" : "#5C6B2E",
                    }}>
                      {error ? "!" : "✓"}
                    </div>
                    <div>
                      <div style={{ ...s.bannerTitle, color: error ? "#991b1b" : "#5C6B2E" }}>
                        {error ? "오류가 발생했습니다" : "초안 작성이 완료되었습니다"}
                      </div>
                      <div style={{ ...s.bannerSub, color: error ? "#b91c1c" : "#5C6B2E" }}>
                        {error || `${esgSections.length}개 항목 · ${selectedStandard} 기준 적용 완료`}
                      </div>
                    </div>
                  </div>
                  {!error && (
                    <div style={{ display: "flex", gap: 10 }}>
                    <button style={s.viewBtn} onClick={() =>
                      navigate("/report-download", { state: { fileName, standard: selectedStandard, generatedSections } })
                    }>
                      초안 검토하기 →
                    </button>
                    <button style={{ ...s.downloadBtn, opacity: downloading ? 0.7 : 1 }} onClick={downloadReport} disabled={downloading}>
                      {downloading ? "생성 중..." : "⬇ PDF 다운로드"}
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* Footer Note */}
              <div style={s.footerNote}>
                본 초안은 AI가 자동 생성한 내용으로, 공식 제출 전 전문가 검토가 필요합니다.
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "#FAF8F0",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "48px 56px" },

  // Document Header
  docHeader: { marginBottom: 36 },
  docMeta: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  docType: { fontSize: 11, fontWeight: 600, color: "#5C6B2E", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  docSep: { color: "#ccc", fontSize: 12 },
  docRef: { fontSize: 11, color: "#aaa", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  docTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },
  docTitle: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", margin: 0, letterSpacing: "-0.01em" },
  docDate: { fontSize: 12, color: "#999", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", paddingBottom: 4 },
  docSubtitle: { fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 20px" },
  docRule: { height: 1, background: "linear-gradient(90deg, #5C6B2E 0%, #a3b86c 60%, transparent 100%)" },

  // Layout
  layout: { display: "flex", gap: 28, alignItems: "flex-start" },
  leftCol: { width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 },
  rightCol: { flex: 1 },

  // Panels
  panel: {
    background: "white",
    border: "1px solid #e8e3da",
    borderRadius: 10,
    padding: "18px 20px",
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "#999",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: "1px solid #e8e3da",
  },

  // Standard
  standardGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  stdItem: {
    padding: "8px 12px",
    border: "1.5px solid",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: "0.06em",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  stdCheck: { fontSize: 10 },

  // File
  fileRow: { display: "flex", alignItems: "center", gap: 10 },
  fileIcon: {
    background: "#5C6B2E",
    color: "white",
    fontSize: 9,
    fontWeight: 700,
    padding: "4px 6px",
    borderRadius: 4,
    letterSpacing: "0.05em",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  fileName: { fontSize: 13, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  // Big Progress
  bigProgress: { textAlign: "center", marginBottom: 14 },
  bigPct: { fontSize: 52, fontWeight: 700, fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", lineHeight: 1 },
  bigPctUnit: { fontSize: 22 },
  progressLabel: { fontSize: 12, color: "#888", marginTop: 4, letterSpacing: "0.04em" },
  progressTrack: { height: 6, background: "#e8e3da", borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  progressFill: { height: "100%", borderRadius: 99, transition: "width 0.25s ease" },
  sectionNote: { display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "#5C6B2E", fontWeight: 500 },
  blinkDot: { width: 6, height: 6, borderRadius: "50%", background: "#5C6B2E", display: "inline-block", animation: "pulse 1.4s ease infinite" },

  // Step Table
  logHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
    padding: "12px 20px",
    background: "#5C6B2E",
    borderRadius: "10px 10px 0 0",
  },
  logTitle: { fontSize: 11, fontWeight: 700, color: "#a3b86c", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  logCount: { fontSize: 11, color: "#a3b86c", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },

  stepTable: {
    background: "white",
    border: "1px solid #e8e3da",
    borderTop: "none",
    borderRadius: "0 0 10px 10px",
    overflow: "hidden",
    marginBottom: 16,
  },
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    padding: "16px 20px",
    transition: "background 0.2s ease",
  },
  stepCodeCol: { width: 80, flexShrink: 0 },
  stepCode: { fontSize: 11, fontWeight: 500, letterSpacing: "0.05em" },
  stepInfo: { flex: 1, paddingRight: 12 },
  stepName: { fontSize: 14, fontWeight: 500, lineHeight: 1.3, marginBottom: 2 },
  stepDesc: { fontSize: 12, color: "#888", lineHeight: 1.5, marginTop: 4 },
  stepStatusCol: { flexShrink: 0, width: 80, textAlign: "right" },
  statusDone: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700, color: "#16a34a",
    background: "#f0fdf4", border: "1px solid #bbf7d0",
    borderRadius: 20, padding: "3px 10px",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  statusActive: {
    display: "inline-flex", alignItems: "center",
    fontSize: 11, fontWeight: 700, color: "#5C6B2E",
    background: "rgba(174,183,132,0.18)", border: "1px solid #a3b86c",
    borderRadius: 20, padding: "3px 10px",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  statusWait: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 500, color: "#ccc",
    background: "#f9f9f9", border: "1px solid #eee",
    borderRadius: 20, padding: "3px 10px",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },

  // Completion Banner
  completionBanner: {
    border: "1.5px solid",
    borderRadius: 10,
    padding: "20px 24px",
    marginBottom: 12,
  },
  bannerTop: { display: "flex", alignItems: "center", gap: 14, marginBottom: 16 },
  bannerIcon: {
    width: 40, height: 40, borderRadius: "50%", color: "white",
    fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  },
  bannerTitle: { fontSize: 15, fontWeight: 700, marginBottom: 3, fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  bannerSub: { fontSize: 12, fontWeight: 500 },
  viewBtn: {
    flex: 1,
    background: "#5C6B2E",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "11px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },

  downloadBtn: {
    flex: 1,
    background: "#fff",
    color: "#444",
    border: "1px solid #ccc",
    borderRadius: 6,
    padding: "11px 20px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  footerNote: {
    fontSize: 11,
    color: "#999",
    lineHeight: 1.6,
    padding: "12px 16px",
    background: "#f5f7ee",
    border: "1px solid #e8e3da",
    borderRadius: 8,
    fontStyle: "italic",
  },
};

export default ReportGenerate;