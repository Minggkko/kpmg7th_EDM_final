import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "./Dashboard.css";

const typeMeta = {
  environment: { letter: "E", label: "Environment" },
  social:       { letter: "S", label: "Social" },
  governance:   { letter: "G", label: "Governance" },
};

const ESG_SCORE = 82;
const DASH_OFFSET = 283 - (283 * ESG_SCORE) / 100;

const trendData = [
  { label: "탄소 배출 감소율",   value: 74 },
  { label: "에너지 효율 개선",   value: 61 },
  { label: "공급망 리스크 대응", value: 88 },
];

const benchmarks = [
  { val: "82", label: "내 점수" },
  { val: "76", label: "업종 평균" },
  { val: "91", label: "업종 최고" },
];

function Dashboard({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { type, issues } = location.state || {};
  const meta = typeMeta[type];

  return (
    <div style={styles.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={styles.body}>
        <Sidebar currentStep="dashboard" />
        <main style={styles.main}>

          <div style={styles.header}>
            <p style={styles.eyebrow}>분석 결과 요약</p>
            <h1 style={styles.title}>ESG Dashboard</h1>
            <p style={styles.desc}>선택된 ESG 영역과 중대성 이슈를 기반으로 분석을 진행합니다.</p>
          </div>

          <div style={styles.topRow}>

            <div style={{ ...styles.card, ...styles.cardTall }} className="dash-card">
              <p style={styles.cardLabel}>ESG 영역</p>
              {meta ? (
                <div style={styles.typeBlock}>
                  <div style={styles.letterBadge}>{meta.letter}</div>
                  <div>
                    <div style={styles.typeLabel}>{meta.label}</div>
                    <div style={styles.typeSub}>{type}</div>
                  </div>
                </div>
              ) : (
                <p style={styles.empty}>선택된 영역 없음</p>
              )}
            </div>

            <div style={{ ...styles.card, ...styles.cardTall, flex: 2 }} className="dash-card">
              <p style={styles.cardLabel}>선택된 이슈</p>
              <div style={styles.tagWrap}>
                {issues && issues.length > 0 ? (
                  issues.map(issue => (
                    <span key={issue} className="issue-tag">{issue}</span>
                  ))
                ) : (
                  <p style={styles.empty}>선택된 이슈 없음</p>
                )}
              </div>
              {issues && issues.length > 0 && (
                <p style={styles.issueCount}>{issues.length}개 이슈 선택됨</p>
              )}
            </div>

            <div style={{ ...styles.card, ...styles.cardTall }} className="dash-card">
              <p style={styles.cardLabel}>ESG Score</p>
              <div style={{ position: "relative", width: 100, height: 100, margin: "8px auto 0" }}>
                <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e3dbbb" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="#41431b" strokeWidth="8"
                    strokeDasharray="283"
                    strokeDashoffset={DASH_OFFSET}
                    strokeLinecap="round"
                  />
                </svg>
                <span style={{
                  position: "absolute", top: "50%", left: "50%",
                  transform: "translate(-50%, -50%)",
                  fontSize: 26, fontWeight: 700, color: "#41431b",
                  lineHeight: 1,
                }}>
                  {ESG_SCORE}
                </span>
              </div>
              <p className="score-label">Demo Score</p>
              <div className="score-compare">
                {benchmarks.map(b => (
                  <div key={b.label} className="score-compare-item">
                    <span className="score-compare-val">{b.val}</span>
                    <span className="score-compare-label">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div style={styles.bottomGrid}>

            <div style={{ ...styles.card, flex: 2 }} className="dash-card">
              <p style={styles.cardLabel}>항목별 이행률</p>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {trendData.map(item => (
                  <div key={item.label} style={{
                    background: "#faf8f0",
                    border: "1px solid #e3dbbb",
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#444" }}>{item.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#41431b", fontFamily: "'DM Mono', monospace" }}>{item.value}%</span>
                    </div>
                    <div style={{ height: 6, background: "#e3dbbb", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        width: `${item.value}%`,
                        background: "linear-gradient(90deg, #41431b, #aeb784)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...styles.card, flex: 1 }} className="dash-card">
              <p style={styles.cardLabel}>다음 단계</p>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { step: "01", text: "데이터 업로드" },
                  { step: "02", text: "이슈별 지표 입력" },
                  { step: "03", text: "보고서 생성" },
                ].map(s => (
                  <div key={s.step} style={styles.stepItem}>
                    <span style={styles.stepNum}>{s.step}</span>
                    <span style={styles.stepText}>{s.text}</span>
                  </div>
                ))}
              </div>
              <button
                style={styles.primaryBtn}
                onClick={() => navigate("/data-upload", { state: { type, issues } })}
                onMouseEnter={e => e.currentTarget.style.background = "#2e3012"}
                onMouseLeave={e => e.currentTarget.style.background = "#41431b"}
              >
                데이터 업로드 시작 →
              </button>
            </div>

          </div>

        </main>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#faf8f0", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "44px 48px" },
  header: { marginBottom: 32 },
  eyebrow: { fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#aeb784", marginBottom: 6 },
  title: { fontSize: 26, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 },
  desc: { fontSize: 14, color: "#777" },
  topRow: { display: "flex", gap: 18, marginBottom: 18, flexWrap: "wrap" },
  bottomGrid: { display: "flex", gap: 18, flexWrap: "wrap" },
  card: { background: "white", padding: "24px 26px", borderRadius: 16, boxShadow: "0 2px 16px rgba(0,0,0,0.05)", flex: 1, minWidth: 200 },
  cardTall: { minHeight: 200 },
  cardLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa", marginBottom: 14 },
  typeBlock: { display: "flex", alignItems: "center", gap: 14, marginTop: 4 },
  letterBadge: { width: 44, height: 44, borderRadius: 12, background: "#41431b", color: "#faf8f0", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  typeLabel: { fontSize: 17, fontWeight: 700, color: "#222" },
  typeSub: { fontSize: 12, color: "#aeb784", marginTop: 2, textTransform: "capitalize" },
  tagWrap: { display: "flex", gap: 8, flexWrap: "wrap" },
  issueCount: { marginTop: 14, fontSize: 12, color: "#bbb" },
  empty: { marginTop: 10, fontSize: 13, color: "#aaa" },
  stepItem: { display: "flex", alignItems: "center", gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 8, background: "rgba(174,183,132,0.2)", color: "#41431b", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepText: { fontSize: 13, color: "#444", fontWeight: 500 },
  primaryBtn: { marginTop: 22, width: "100%", background: "#41431b", color: "#faf8f0", border: "none", padding: "12px 0", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 14, transition: "background 0.2s" },
};

export default Dashboard;