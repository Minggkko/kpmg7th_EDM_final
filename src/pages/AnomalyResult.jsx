import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const anomalies = [
    {
    id: 1,
    severity: "high",
    category: "환경",
    metric: "용수 사용량",
    value: "31,800 톤",
    expected: "18,000 ~ 22,000 톤",
    deviation: "+68%",
    reason: "전년 대비 68% 급증 — 계절적 요인 또는 생산량 증가 여부 확인 필요",
    action: "데이터 재입력 요청",
    },
    {
    id: 2,
    severity: "high",
    category: "지배구조",
    metric: "윤리 위반 건수",
    value: "3 건",
    expected: "0 ~ 1 건",
    deviation: "+200%",
    reason: "업종 평균 대비 3배 이상 — 세부 사건 내역 및 처리 결과 보고 필요",
    action: "증빙자료 업로드 요청",
    },
    {
    id: 3,
    severity: "medium",
    category: "사회",
    metric: "여성 임원 비율",
    value: "누락",
    expected: "데이터 필수",
    deviation: "—",
    reason: "GRI 405-1 필수 공시 항목 누락 — 보고서 적합성에 영향",
    action: "데이터 입력 요청",
    },
];

const sevColor = {
    high: { bg: "#fef2f2", border: "#fca5a5", badge: "#991b1b", badgeBg: "#fef2f2", label: "심각" },
    medium: { bg: "#fffbeb", border: "#fcd34d", badge: "#92400e", badgeBg: "#fffbeb", label: "주의" },
    low: { bg: "#f0fdf4", border: "#86efac", badge: "#065f46", badgeBg: "#ecfdf5", label: "낮음" },
};

function AnomalyResult({ isLoggedIn, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();
    const fileName = location.state?.fileName || "uploaded_file.pdf";
    const [expanded, setExpanded] = useState(null);

    return (
        <div style={s.page}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={s.body}>
            <Sidebar currentStep="anomaly-result" />
            <main style={s.main}>

            <div style={s.header}>
                <div>
                <h1 style={s.title}>이상치 탐지 결과 확인</h1>
                <p style={s.sub}>AI가 탐지한 이상치 및 누락 항목을 확인하고 조치를 결정하세요.</p>
                </div>
                <div style={s.fileBadge}>📄 {fileName}</div>
            </div>

            {/* Summary */}
            <div style={s.summaryRow}>
                <div style={{ ...s.sCard, background: "#fef2f2" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#991b1b" }}>
                    {anomalies.filter(a => a.severity === "high").length}
                </span>
                <span style={{ fontSize: 13, color: "#555", marginTop: 4 }}>심각 이상치</span>
                </div>
                <div style={{ ...s.sCard, background: "#fffbeb" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#92400e" }}>
                    {anomalies.filter(a => a.severity === "medium").length}
                </span>
                <span style={{ fontSize: 13, color: "#555", marginTop: 4 }}>주의 항목</span>
                </div>
                <div style={{ ...s.sCard, background: "#ecfdf5" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#065f46" }}>
                    {anomalies.filter(a => a.severity === "low").length}
                </span>
                <span style={{ fontSize: 13, color: "#555", marginTop: 4 }}>낮은 위험</span>
                </div>
                <div style={{ ...s.sCard, background: "rgba(132,147,74,0.08)" }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#84934A" }}>8</span>
                <span style={{ fontSize: 13, color: "#555", marginTop: 4 }}>정상 항목</span>
                </div>
            </div>

            {/* Anomaly Cards */}
            <div style={s.listWrap}>
                {anomalies.map((a) => {
                const c = sevColor[a.severity];
                const open = expanded === a.id;
                return (
                    <div
                    key={a.id}
                    style={{ ...s.aCard, borderColor: c.border, background: open ? c.bg : "white" }}
                    >
                    <div style={s.aTop} onClick={() => setExpanded(open ? null : a.id)}>
                        <div style={s.aLeft}>
                        <span style={{ ...s.sevBadge, color: c.badge, background: c.badgeBg }}>
                            ● {c.label}
                        </span>
                        <span style={s.aCatBadge}>{a.category}</span>
                        <span style={s.aMetric}>{a.metric}</span>
                        </div>
                        <div style={s.aRight}>
                        {a.deviation !== "—" && (
                            <span style={{ ...s.devBadge, color: c.badge }}>{a.deviation}</span>
                        )}
                        <span style={s.expandBtn}>{open ? "▲" : "▼"}</span>
                        </div>
                    </div>

                    {open && (
                        <div style={s.aDetail}>
                        <div style={s.detailGrid}>
                            <div style={s.detailItem}>
                            <div style={s.detailLabel}>감지된 값</div>
                            <div style={{ ...s.detailVal, color: c.badge, fontWeight: 700 }}>{a.value}</div>
                            </div>
                            <div style={s.detailItem}>
                            <div style={s.detailLabel}>예상 범위</div>
                            <div style={s.detailVal}>{a.expected}</div>
                            </div>
                            <div style={{ ...s.detailItem, gridColumn: "span 2" }}>
                            <div style={s.detailLabel}>탐지 사유</div>
                            <div style={s.detailVal}>{a.reason}</div>
                            </div>
                        </div>
                        <div style={s.actionRow}>
                            <span style={s.actionLabel}>권장 조치</span>
                            <button style={s.actionBtn}>{a.action} →</button>
                        </div>
                        </div>
                    )}
                    </div>
                );
                })}
            </div>

            <div style={s.bottom}>
                <button style={s.secBtn} onClick={() => navigate(-1)}>← 이전</button>
                <button
                style={s.priBtn}
                onClick={() => navigate("/data-input-request", { state: { fileName } })}
                >
                데이터 입력 요청 →
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
    summaryRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 },
    sCard: { borderRadius: 14, padding: "20px 24px", display: "flex", flexDirection: "column" },
    listWrap: { display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 },
    aCard: { borderRadius: 14, border: "1.5px solid", overflow: "hidden", transition: "all 0.2s" },
    aTop: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", cursor: "pointer" },
    aLeft: { display: "flex", alignItems: "center", gap: 10 },
    aRight: { display: "flex", alignItems: "center", gap: 12 },
    sevBadge: { fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 6 },
    aCatBadge: { fontSize: 12, color: "#84934A", background: "rgba(132,147,74,0.1)", padding: "3px 10px", borderRadius: 6, fontWeight: 600 },
    aMetric: { fontSize: 15, fontWeight: 700, color: "#222" },
    devBadge: { fontSize: 14, fontWeight: 800 },
    expandBtn: { fontSize: 12, color: "#aaa" },
    aDetail: { padding: "0 20px 20px" },
    detailGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "rgba(0,0,0,0.02)", borderRadius: 10, padding: "16px", marginBottom: 14 },
    detailItem: {},
    detailLabel: { fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
    detailVal: { fontSize: 14, color: "#333" },
    actionRow: { display: "flex", alignItems: "center", gap: 12 },
    actionLabel: { fontSize: 13, color: "#555" },
    actionBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    bottom: { display: "flex", justifyContent: "flex-end", gap: 12 },
    secBtn: { background: "white", border: "1.5px solid #ccc", borderRadius: 8, padding: "10px 22px", fontSize: 14, fontWeight: 500, color: "#444", cursor: "pointer" },
    priBtn: { background: "#84934A", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
};

export default AnomalyResult;