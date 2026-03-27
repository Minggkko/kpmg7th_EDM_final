import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  FileText,
  BookOpen,
  Database,
  ShieldCheck,
  Settings,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const ESG_DATA_STEPS = ["standard", "outlier"];

const steps = [
  { label: "중대 이슈 선택",  path: "/materiality",          step: "materiality", icon: ClipboardList },
  // ESG 데이터 그룹 (group: true)
  { label: "표준화 데이터 조회", path: "/standard-data",        step: "standard",    icon: Database,     group: true },
  { label: "이상치·정합성 검증", path: "/outlier-verification", step: "outlier",     icon: ShieldCheck,  group: true },
  { label: "보고서 생성",        path: "/report-generate",      step: "report",      icon: FileText },
];

const stepOrder = steps.map(s => s.step);

const extra = [
  { label: "가이드", path: "/guide",    icon: BookOpen },
  { label: "설정",   path: "/settings", icon: Settings },
];

function Sidebar({ currentStep }) {
  const navigate = useNavigate();

  const [maxAllowed, setMaxAllowed] = useState(() => {
    const stored = parseInt(sessionStorage.getItem("esgMaxStep") || "-1");
    const curIdx = stepOrder.indexOf(currentStep);
    if (curIdx > stored) {
      sessionStorage.setItem("esgMaxStep", String(curIdx));
      return curIdx;
    }
    return stored;
  });

  // ESG 데이터 그룹: 현재 스텝이 그룹 내에 있으면 자동 펼침
  const [esgDataOpen, setEsgDataOpen] = useState(
    ESG_DATA_STEPS.includes(currentStep)
  );

  useEffect(() => {
    const curIdx = stepOrder.indexOf(currentStep);
    if (curIdx > maxAllowed) {
      setMaxAllowed(curIdx);
      sessionStorage.setItem("esgMaxStep", String(curIdx));
    }
    // 현재 스텝이 그룹 내면 자동 펼침
    if (ESG_DATA_STEPS.includes(currentStep)) {
      setEsgDataOpen(true);
    }
  }, [currentStep]);

  const currentIndex = steps.findIndex(s => s.step === currentStep);

  // ESG 데이터 그룹의 잠금 여부: 첫 번째 서브메뉴(standard)의 인덱스 기준
  const standardIdx = stepOrder.indexOf("standard");
  const isGroupLocked = standardIdx > maxAllowed;

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>ESG Report</div>

      <nav style={styles.nav}>

        {/* 중대 이슈 선택 */}
        {steps.filter(s => !s.group).slice(0, 1).map((s) => {
          const i = stepOrder.indexOf(s.step);
          const Icon = s.icon;
          const isActive = s.step === currentStep;
          const isDone   = i < currentIndex;
          const isLocked = i > maxAllowed;

          return (
            <button
              key={s.step}
              style={{
                ...styles.item,
                ...(isActive ? styles.active : {}),
                ...(isLocked ? styles.locked : {}),
              }}
              onClick={() => { if (!isLocked) navigate(s.path); }}
              disabled={isLocked}
              title={isLocked ? "이전 단계를 먼저 완료해주세요" : s.label}
            >
              <Icon size={18} style={{ ...styles.icon, opacity: isLocked ? 0.35 : 1 }} />
              <span style={{ ...styles.label, opacity: isLocked ? 0.4 : 1 }}>{s.label}</span>
              {isDone && !isLocked && <span style={styles.check}>✓</span>}
              {isLocked && <span style={styles.lockIcon}>🔒</span>}
            </button>
          );
        })}

        {/* ESG 데이터 그룹 */}
        <div>
          {/* 그룹 헤더 */}
          <button
            style={{
              ...styles.item,
              ...(isGroupLocked ? styles.locked : {}),
              ...(ESG_DATA_STEPS.includes(currentStep) ? styles.groupActive : {}),
            }}
            onClick={() => { if (!isGroupLocked) setEsgDataOpen(p => !p); }}
            disabled={isGroupLocked}
            title={isGroupLocked ? "이전 단계를 먼저 완료해주세요" : "ESG 데이터"}
          >
            <Layers size={18} style={{ ...styles.icon, opacity: isGroupLocked ? 0.35 : 1 }} />
            <span style={{ ...styles.label, opacity: isGroupLocked ? 0.4 : 1, fontWeight: 600 }}>
              ESG 데이터
            </span>
            {isGroupLocked
              ? <span style={styles.lockIcon}>🔒</span>
              : esgDataOpen
                ? <ChevronDown size={15} style={{ color: "#64748b" }} />
                : <ChevronRight size={15} style={{ color: "#64748b" }} />
            }
          </button>

          {/* 서브 메뉴 */}
          {esgDataOpen && !isGroupLocked && (
            <div style={styles.subMenu}>
              {steps.filter(s => s.group).map(s => {
                const i = stepOrder.indexOf(s.step);
                const Icon = s.icon;
                const isActive = s.step === currentStep;
                const isDone   = i < currentIndex;
                const isLocked = i > maxAllowed;

                return (
                  <button
                    key={s.step}
                    style={{
                      ...styles.item,
                      ...styles.subItem,
                      ...(isActive ? styles.active : {}),
                      ...(isLocked ? styles.locked : {}),
                    }}
                    onClick={() => { if (!isLocked) navigate(s.path); }}
                    disabled={isLocked}
                    title={isLocked ? "이전 단계를 먼저 완료해주세요" : s.label}
                  >
                    <Icon size={16} style={{ ...styles.icon, opacity: isLocked ? 0.35 : 1 }} />
                    <span style={{ ...styles.label, fontSize: 13, opacity: isLocked ? 0.4 : 1 }}>
                      {s.label}
                    </span>
                    {isDone && !isLocked && <span style={styles.check}>✓</span>}
                    {isLocked && <span style={styles.lockIcon}>🔒</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 보고서 생성 */}
        {steps.filter(s => !s.group).slice(1).map(s => {
          const i = stepOrder.indexOf(s.step);
          const Icon = s.icon;
          const isActive = s.step === currentStep;
          const isDone   = i < currentIndex;
          const isLocked = i > maxAllowed;

          return (
            <button
              key={s.step}
              style={{
                ...styles.item,
                ...(isActive ? styles.active : {}),
                ...(isLocked ? styles.locked : {}),
              }}
              onClick={() => { if (!isLocked) navigate(s.path); }}
              disabled={isLocked}
              title={isLocked ? "이전 단계를 먼저 완료해주세요" : s.label}
            >
              <Icon size={18} style={{ ...styles.icon, opacity: isLocked ? 0.35 : 1 }} />
              <span style={{ ...styles.label, opacity: isLocked ? 0.4 : 1 }}>{s.label}</span>
              {isDone && !isLocked && <span style={styles.check}>✓</span>}
              {isLocked && <span style={styles.lockIcon}>🔒</span>}
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
  sidebar: {
    width: 260,
    minHeight: "100vh",
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    padding: "30px 20px",
    display: "flex",
    flexDirection: "column",
  },
  logo: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 30,
    color: "#84934A",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
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
    color: "#475569",
    textAlign: "left",
    width: "100%",
    transition: "all 0.2s",
  },
  subItem: {
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
  },
  subMenu: {
    marginLeft: 16,
    marginTop: 2,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    borderLeft: "2px solid #e5e7eb",
    paddingLeft: 8,
  },
  active: {
    background: "#F0FDF4",
    color: "#166534",
    fontWeight: 600,
  },
  groupActive: {
    background: "#f8fdf5",
    color: "#166534",
  },
  locked: {
    cursor: "not-allowed",
    background: "transparent",
  },
  icon: {
    minWidth: 20,
  },
  label: {
    flex: 1,
  },
  check: {
    color: "#22C55E",
    fontSize: 16,
    fontWeight: 700,
  },
  lockIcon: {
    fontSize: 11,
    opacity: 0.35,
  },
  divider: {
    height: 1,
    background: "#e5e7eb",
    margin: "16px 0",
  },
};

export default Sidebar;
