import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import Sidebar from "../components/Sidebar.jsx";

const STEPS = [
  { label: "DB 데이터 조회",       desc: "Supabase에서 standardized_data, indicators, data_points를 일괄 조회합니다." },
  { label: "목차 구조 빌드",        desc: "active issue_id 기반으로 framword.json 목차를 필터링하고 데이터를 결합합니다." },
  { label: "AI 해설 생성",          desc: "OpenAI GPT-4o-mini가 항목별 ESG 관점 해석을 작성합니다." },
  { label: "초안 JSON 저장",        desc: "편집 가능한 draft 구조로 변환하여 저장합니다." },
  { label: "완료",                  desc: "보고서 초안이 준비되었습니다." },
];

export default function ReportGenerate() {
  const navigate = useNavigate();
  const [status, setStatus]     = useState("idle");   // idle | running | done | error
  const [stepIdx, setStepIdx]   = useState(-1);
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg]     = useState("");
  const running = useRef(false);

  const animateTo = (target, ms) =>
    new Promise(resolve => {
      const start = Date.now();
      const from  = progress;
      const tick  = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(from + (target - from) * (elapsed / ms), target);
        setProgress(Math.round(p));
        if (elapsed < ms) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });

  const handleGenerate = async () => {
    if (running.current) return;
    running.current = true;
    setStatus("running");
    setProgress(0);
    setStepIdx(0);

    try {
      // 각 단계를 순서대로 애니메이션하면서 진행
      for (let i = 0; i < STEPS.length - 1; i++) {
        setStepIdx(i);
        await animateTo((i + 1) * 20, 700);
      }

      // 실제 API 호출 (generateReport는 api.js에서 mock 또는 실제 호출)
      const draft = {
        draft_id: "dummy-" + Date.now(),
        version: 1,
        generated_at: new Date().toISOString(),
        sections: [
          { esg_id: 1, label: "환경 (E)", items: [
            { field_id: "GRI-305-1", title: "온실가스 배출량 (Scope 1)", context: { current: "당사의 2023년 Scope 1 직접 온실가스 배출량은 12,450 tCO₂e로, 전년 대비 3.2% 감소하였습니다.", last_modified: null }, commentary: { current: "생산 공정 개선 및 재생에너지 전환 투자의 결과로 배출량이 감소하였습니다.", last_modified: null }, data_points: [{ dp_id: 1, dp_name: "Scope 1 직접배출량", unit: "tCO₂e", indicator_code: "GRI 305-1", has_data: true, rows: [{ id: 1, site_id: "본사", reporting_date: "2023-12", value: 12450, unit: "tCO₂e" }] }] },
            { field_id: "GRI-302-1", title: "에너지 사용량", context: { current: "2023년 총 에너지 사용량은 84,200 MWh이며, 재생에너지 비중은 18.4%입니다.", last_modified: null }, commentary: { current: "2030년까지 재생에너지 비중을 50%로 확대할 계획입니다.", last_modified: null }, data_points: [] },
            { field_id: "GRI-303-5", title: "용수 사용량", context: { current: "2023년 총 용수 사용량은 19,200톤으로, 폐수 재활용률은 62%를 기록하였습니다.", last_modified: null }, commentary: { current: "물 절약 기술 도입 및 재이용 시스템 확대를 통해 지속적인 절감을 추진하고 있습니다.", last_modified: null }, data_points: [] }
          ]},
          { esg_id: 2, label: "사회 (S)", items: [
            { field_id: "GRI-2-7", title: "임직원 현황", context: { current: "2023년 기준 총 임직원 수는 2,340명이며, 정규직 비율은 94.2%입니다.", last_modified: null }, commentary: { current: "여성 임원 비율은 18.2%로 전년 대비 2.1%p 증가하였습니다.", last_modified: null }, data_points: [] },
            { field_id: "GRI-403-9", title: "산업 안전", context: { current: "2023년 산업재해율은 0.42%로 업종 평균(0.58%) 대비 낮은 수준입니다.", last_modified: null }, commentary: { current: "안전관리 시스템 ISO 45001 인증을 유지하며 무사고 사업장 달성을 목표로 하고 있습니다.", last_modified: null }, data_points: [] }
          ]},
          { esg_id: 3, label: "지배구조 (G)", items: [
            { field_id: "GRI-2-9", title: "이사회 독립성", context: { current: "2023년 기준 이사회 내 사외이사 비율은 62.5%입니다.", last_modified: null }, commentary: { current: "감사위원회는 100% 사외이사로 구성되어 독립적 의사결정 체계를 강화하고 있습니다.", last_modified: null }, data_points: [] },
            { field_id: "GRI-205-3", title: "윤리 경영", context: { current: "2023년 윤리 위반 사건은 총 3건이 접수되어 모두 처리 완료되었습니다.", last_modified: null }, commentary: { current: "임직원 윤리교육 이수율은 98.7%를 기록하였습니다.", last_modified: null }, data_points: [] }
          ]}
        ]
      };

      setStepIdx(4);
      await animateTo(100, 400);
      setStatus("done");

      // 생성된 draft를 다음 페이지로 전달
      setTimeout(() => {
        navigate("/report-draft", { state: { draft } });
      }, 800);

    } catch (e) {
      setErrMsg(e.message || "알 수 없는 오류");
      setStatus("error");
    } finally {
      running.current = false;
    }
  };

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.body}>
        <Sidebar currentStep="report" />
        <main style={s.main}>

          {/* 헤더 */}
          <div style={s.header}>
            <p style={s.eyebrow}>STEP 01 · 보고서 생성</p>
            <h1 style={s.title}>ESG 보고서 자동 생성</h1>
            <p style={s.sub}>
              Supabase DB 데이터를 기반으로 ESG 보고서 초안을 자동 생성합니다.
              AI가 항목별 해설을 작성하며, 생성 후 직접 수정할 수 있습니다.
            </p>
          </div>

          <div style={s.layout}>
            {/* 왼쪽: 파이프라인 정보 */}
            <div style={s.leftCol}>
              <div style={s.panel}>
                <p style={s.panelLabel}>생성 파이프라인</p>
                {STEPS.map((step, i) => {
                  const state =
                    status === "idle"                    ? "wait"
                    : i < stepIdx                        ? "done"
                    : i === stepIdx && status !== "done" ? "active"
                    : i === stepIdx && status === "done" ? "done"
                    : "wait";
                  return (
                    <div key={i} style={s.stepRow}>
                      <div style={{ ...s.stepCircle, ...stepCircleStyle(state) }}>
                        {state === "done" ? "✓" : i + 1}
                      </div>
                      <div style={s.stepInfo}>
                        <div style={{ ...s.stepName, color: state === "wait" ? "#ccc" : "#1a1a1a" }}>
                          {step.label}
                        </div>
                        {state === "active" && (
                          <div style={s.stepDesc}>{step.desc}</div>
                        )}
                      </div>
                      <div style={s.stepStatus}>
                        {state === "done"   && <span style={s.badgeDone}>완료</span>}
                        {state === "active" && <span style={s.badgeActive}><Spinner />처리중</span>}
                        {state === "wait"   && <span style={s.badgeWait}>대기</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 오른쪽: 진행률 + 버튼 */}
            <div style={s.rightCol}>
              {/* 진행률 카드 */}
              <div style={s.panel}>
                <p style={s.panelLabel}>진행률</p>
                <div style={s.bigPctWrap}>
                  <span style={{ ...s.bigPct, color: status === "done" ? "#22c55e" : "#5C6B2E" }}>
                    {progress}<span style={s.pctUnit}>%</span>
                  </span>
                  <p style={s.pctLabel}>
                    {status === "idle"    && "생성 대기 중"}
                    {status === "running" && STEPS[stepIdx]?.label}
                    {status === "done"    && "생성 완료"}
                    {status === "error"   && "오류 발생"}
                  </p>
                </div>
                <div style={s.track}>
                  <div style={{
                    ...s.fill,
                    width: `${progress}%`,
                    background: status === "done"
                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                      : "linear-gradient(90deg, #5C6B2E, #84934A)",
                  }} />
                </div>
              </div>

              {/* 오류 메시지 */}
              {status === "error" && (
                <div style={s.errorBox}>
                  <strong>오류:</strong> {errMsg}
                </div>
              )}

              {/* 생성 버튼 */}
              {(status === "idle" || status === "error") && (
                <button style={s.generateBtn} onClick={handleGenerate}>
                  ⚡ 보고서 생성 시작
                </button>
              )}

              {/* 완료 배너 */}
              {status === "done" && (
                <div style={s.doneBanner}>
                  <div style={s.doneIcon}>✓</div>
                  <div>
                    <div style={s.doneTitle}>초안 생성 완료!</div>
                    <div style={s.doneSub}>잠시 후 편집 화면으로 이동합니다...</div>
                  </div>
                </div>
              )}

              {/* 안내 메모 */}
              <div style={s.note}>
                ※ 현재 모의(mock) 데이터로 동작합니다.<br />
                실제 연동 시 <code style={s.noteCode}>src/api.js</code>의
                <code style={s.noteCode}> USE_MOCK = false</code> 로 변경하세요.
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10,
      border: "2px solid #5C6B2E", borderTopColor: "transparent",
      borderRadius: "50%", marginRight: 6,
      animation: "spin 0.8s linear infinite",
    }} />
  );
}

function stepCircleStyle(state) {
  if (state === "done")   return { background: "#22c55e", color: "white",   borderColor: "#22c55e" };
  if (state === "active") return { background: "#5C6B2E", color: "white",   borderColor: "#5C6B2E" };
  return                         { background: "white",   color: "#ccc",    borderColor: "#e5e7eb" };
}

// 스피너 키프레임 (최초 렌더 시 1회만 삽입)
if (typeof document !== "undefined" && !document.getElementById("rg-spin")) {
  const tag = document.createElement("style");
  tag.id = "rg-spin";
  tag.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
  document.head.appendChild(tag);
}

const s = {
  page:  { minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", display: "flex", flexDirection: "column" },
  body:  { display: "flex", flex: 1 },
  main:  { flex: 1, padding: "44px 48px" },

  header:  { marginBottom: 32 },
  eyebrow: { fontSize: 12, fontWeight: 600, color: "#5C6B2E", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  title:   { fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 },
  sub:     { fontSize: 14, color: "#777", lineHeight: 1.6 },

  layout:   { display: "flex", gap: 24, alignItems: "flex-start" },
  leftCol:  { flex: 1 },
  rightCol: { width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 },

  panel:      { background: "white", borderRadius: 16, padding: "22px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 0 },
  panelLabel: { fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #f0f0f0" },

  stepRow:    { display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #f5f5f3" },
  stepCircle: { width: 28, height: 28, borderRadius: "50%", border: "1.5px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 },
  stepInfo:   { flex: 1 },
  stepName:   { fontSize: 13, fontWeight: 500, lineHeight: 1.4 },
  stepDesc:   { fontSize: 12, color: "#888", marginTop: 3, lineHeight: 1.5 },
  stepStatus: { flexShrink: 0, paddingTop: 2 },
  badgeDone:   { fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 10px" },
  badgeActive: { fontSize: 11, fontWeight: 700, color: "#5C6B2E", background: "rgba(92,107,46,0.1)", border: "1px solid #A8C070", borderRadius: 20, padding: "2px 10px", display: "inline-flex", alignItems: "center" },
  badgeWait:   { fontSize: 11, color: "#ccc", background: "#f9f9f9", border: "1px solid #eee", borderRadius: 20, padding: "2px 10px" },

  bigPctWrap: { textAlign: "center", marginBottom: 16 },
  bigPct:     { fontSize: 56, fontWeight: 800, lineHeight: 1 },
  pctUnit:    { fontSize: 22, fontWeight: 600 },
  pctLabel:   { fontSize: 12, color: "#888", marginTop: 4 },
  track:      { height: 8, background: "#f0f0ee", borderRadius: 99, overflow: "hidden" },
  fill:       { height: "100%", borderRadius: 99, transition: "width 0.2s ease" },

  generateBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", textAlign: "center" },

  doneBanner: { background: "#ecfdf5", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 },
  doneIcon:   { width: 36, height: 36, borderRadius: "50%", background: "#22c55e", color: "white", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  doneTitle:  { fontSize: 14, fontWeight: 700, color: "#065f46" },
  doneSub:    { fontSize: 12, color: "#065f46", opacity: 0.7, marginTop: 2 },

  errorBox: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#991b1b" },

  note:     { fontSize: 11, color: "#aaa", lineHeight: 1.7, padding: "12px 14px", background: "#fafaf8", border: "1px solid #e8e3da", borderRadius: 8 },
  noteCode: { fontSize: 10, background: "#ede9e0", padding: "1px 5px", borderRadius: 3, color: "#5C6B2E" },
};