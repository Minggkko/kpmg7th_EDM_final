import { useNavigate } from "react-router-dom";
import {
  Leaf,
  ClipboardList,
  BarChart3,
  Upload,
  Settings,
  FileText,
  BookOpen,
  Database,
  ShieldCheck
} from "lucide-react";

const steps = [
  { label: "E/S/G 선택", path: "/esg-select", step: "esg", icon: Leaf },
  { label: "중대성 이슈 선택", path: "/issue-select", step: "issue", icon: ClipboardList },
  { label: "대시보드", path: "/dashboard", step: "dashboard", icon: BarChart3 },
  { label: "데이터 업로드", path: "/data-upload", step: "upload", icon: Upload },
  { label: "표준화 데이터 조회", path: "/standard-data", step: "standard", icon: Database },
  { label: "정합성 검증", path: "/consistency-check", step: "consistency", icon: ShieldCheck },
  { label: "데이터 분석", path: "/data-process", step: "process", icon: Settings },
  { label: "레포트 생성", path: "/report-generate", step: "report", icon: FileText },
  { label: "정합성 검증", path: "/consistency-check", step: "consistency", icon: ShieldCheck }
];

const extra = [
  { label: "가이드", path: "/guide", icon: BookOpen },
  { label: "설정", path: "/settings", icon: Settings }
];

function Sidebar({ currentStep }) {

  const navigate = useNavigate();
  const currentIndex = steps.findIndex(s => s.step === currentStep);

  return (
    <aside style={styles.sidebar}>

      <div style={styles.logo}>
        ESG Report
      </div>

      <nav style={styles.nav}>

        {steps.map((s, i) => {

          const Icon = s.icon;

          const isActive = s.step === currentStep;
          const isDone = i < currentIndex;

          return (
            <button
              key={s.step}
              style={{
                ...styles.item,
                ...(isActive ? styles.active : {})
              }}
              onClick={() => navigate(s.path)}
            >

              <Icon size={18} style={styles.icon}/>

              <span style={styles.label}>
                {s.label}
              </span>

              {isDone && (
                <span style={styles.check}>
                  ✓
                </span>
              )}

            </button>
          );
        })}

        <div style={styles.divider}/>

        {extra.map(e => {

          const Icon = e.icon;

          return (
            <button
              key={e.label}
              style={styles.item}
              onClick={() => navigate(e.path)}
            >

              <Icon size={18} style={styles.icon}/>

              <span style={styles.label}>
                {e.label}
              </span>

            </button>
          );
        })}

      </nav>

    </aside>
  );
}

const styles = {

  sidebar: {
    width: 260,
    minHeight: "100vh",
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    padding: "30px 20px",
    display: "flex",
    flexDirection: "column"
  },

  logo: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 30,
    color: "#111827"
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },

  item: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "13px 16px",
    borderRadius: 12,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 15,
    color: "#64748b",
    textAlign: "left",
    width: "100%",
    transition: "all 0.2s"
  },

  active: {
    background: "#F0FDF4",
    color: "#166534",
    fontWeight: 600
  },

  icon: {
    minWidth: 20
  },

  label: {
    flex: 1
  },

  check: {
    color: "#22C55E",
    fontSize: 16,
    fontWeight: 700
  },

  divider: {
    height: 1,
    background: "#e5e7eb",
    margin: "16px 0"
  }
};

export default Sidebar;