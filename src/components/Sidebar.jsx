import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  FileText,
  BookOpen,
  Database,
  ShieldCheck,
  ListChecks,
  AlertTriangle,
  FileQuestion
} from "lucide-react";

const steps = [
  { label: "중대이슈 표준목록", path: "/materiality",       step: "materiality",  icon: ListChecks },
  { label: "표준화 데이터 조회", path: "/standard-data",    step: "standard",     icon: Database },
  { label: "이상치 검증",       path: "/anomaly-result",   step: "anomaly",      icon: AlertTriangle },
  { label: "정합성 검증",       path: "/consistency-check",step: "consistency",  icon: ShieldCheck },
  { label: "미증빙자료 검증",   path: "/unverified-result",step: "unverified",   icon: FileQuestion },
  { label: "분석 대시보드",     path: "/analysis-dashboard",step: "analysis",    icon: BarChart3 },
  { label: "레포트 생성",       path: "/report-generate",  step: "report",       icon: FileText },
];

const extra = [
  { label: "가이드", path: "/guide", icon: BookOpen },
];

function Sidebar({ currentStep }) {
  const navigate = useNavigate();
  const currentIndex = steps.findIndex(s => s.step === currentStep);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>ESG Report</div>
      <nav style={styles.nav}>
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.step === currentStep;
          const isDone = i < currentIndex;
          return (
            <button
              key={s.step}
              style={{ ...styles.item, ...(isActive ? styles.active : {}) }}
              onClick={() => navigate(s.path)}
            >
              <Icon size={18} style={styles.icon} />
              <span style={styles.label}>{s.label}</span>
              {isDone && <span style={styles.check}>✓</span>}
            </button>
          );
        })}
        <div style={styles.divider} />
        {extra.map(e => {
          const Icon = e.icon;
          return (
            <button key={e.label} style={styles.item} onClick={() => navigate(e.path)}>
              <Icon size={18} style={styles.icon} />
              <span style={styles.label}>{e.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

const styles = {
  sidebar: { width: 220, minHeight: "100vh", background: "#ffffff", borderRight: "1px solid #e5e7eb", padding: "30px 16px", display: "flex", flexDirection: "column" },
  logo: { fontSize: 18, fontWeight: 700, marginBottom: 28, color: "#111827", paddingLeft: 8 },
  nav: { display: "flex", flexDirection: "column", gap: 4 },
  item: { display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#64748b", textAlign: "left", width: "100%", transition: "all 0.2s" },
  active: { background: "#F0FDF4", color: "#166534", fontWeight: 600 },
  icon: { minWidth: 18, flexShrink: 0 },
  label: { flex: 1 },
  check: { color: "#22C55E", fontSize: 14, fontWeight: 700 },
  divider: { height: 1, background: "#e5e7eb", margin: "12px 0" },
};

export default Sidebar;