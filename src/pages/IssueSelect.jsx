import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const issueData = {
  environment: [
    { title: "탄소 배출", desc: "온실가스 관리 및 배출 저감 전략" },
    { title: "에너지 사용", desc: "에너지 효율화와 사용량 관리" },
    { title: "폐기물 관리", desc: "폐기물 감축 및 재활용 체계" },
    { title: "수자원 관리", desc: "수자원 사용과 오염 방지 대응" },
  ],
  social: [
    { title: "노동권", desc: "근로 조건, 복지, 노동환경 개선" },
    { title: "다양성 및 포용", desc: "다양성 확대와 조직 문화 개선" },
    { title: "지역사회 영향", desc: "지역사회 기여 및 사회적 책임" },
    { title: "산업 안전", desc: "산업재해 예방과 안전관리 체계" },
  ],
  governance: [
    { title: "윤리 경영", desc: "준법, 반부패, 윤리규정 운영" },
    { title: "이사회 독립성", desc: "이사회 구성과 의사결정 투명성" },
    { title: "데이터 보안", desc: "정보보호 및 보안 리스크 대응" },
    { title: "투명한 경영", desc: "공시, 내부통제, 책임경영 강화" },
  ],
};

const typeMeta = {
  environment: {
    letter: "E",
    label: "Environment",
    desc: "기후/배출/에너지/자원",
  },
  social: {
    letter: "S",
    label: "Social",
    desc: "산업안전/인권/공급망",
  },
  governance: {
    letter: "G",
    label: "Governance",
    desc: "이사회/내부통제/윤리",
  },
};

function IssueSelect({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type");

  const currentMeta = typeMeta[type];
  const issues = useMemo(() => issueData[type] || [], [type]);

  const [selected, setSelected] = useState([]);

  const toggleIssue = (issueTitle) => {
    setSelected((prev) =>
      prev.includes(issueTitle)
        ? prev.filter((item) => item !== issueTitle)
        : [...prev, issueTitle]
    );
  };

  const handlePrev = () => {
    navigate("/esg-select");
  };

  const handleNext = () => {
    if (selected.length === 0) return;

    navigate("/dashboard", {
    state: {
    type,
    issues: selected
  }
  }); 
  };

  if (!type || !currentMeta) {
    return (
      <div style={styles.page}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={styles.body}>
          <Sidebar currentStep="issue-select" />
          <main style={styles.main}>
            <div style={styles.emptyWrap}>
              <h1 style={styles.title}>중대성 이슈 선택</h1>
              <p style={styles.emptyText}>
                먼저 ESG 영역을 선택한 뒤 이 페이지로 이동해줘.
              </p>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={() => navigate("/esg-select")}
              >
                ESG 선택으로 이동
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={styles.body}>
        <Sidebar currentStep="issue-select" />

        <main style={styles.main}>
          <div style={styles.topBar}>
            <div style={styles.titleArea}>
              <h1 style={styles.title}>중대성 이슈 선택</h1>
              <p style={styles.titleSub}>
                선택된 영역에 맞는 중대성 이슈를 고르고 다음 단계로 이동합니다.
              </p>
            </div>
            <div style={styles.bottomRow}>
              <button type="button" style={styles.secondaryBtn} onClick={handlePrev}>
                이전: E/S/G 선택
              </button>
              <button
                type="button"
                style={{
                  ...styles.primaryBtn,
                  opacity: selected.length > 0 ? 1 : 0.45,
                  cursor: selected.length > 0 ? "pointer" : "not-allowed",
                }}
                disabled={selected.length === 0}
                onClick={handleNext}
              >
                다음: 대시보드 →
              </button>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.selectedTypeCard}>
              <div style={styles.selectedTypeHeader}>
                <div style={styles.selectedTypeBadge}>{currentMeta.letter}</div>
                <div>
                  <div style={styles.selectedTypeLabel}>{currentMeta.label}</div>
                  <div style={styles.selectedTypeDesc}>{currentMeta.desc}</div>
                </div>
              </div>
            </div>

            <p style={styles.panelLabel}>이슈 목록</p>

            <div style={styles.issueList}>
              {issues.map((issue) => {
                const active = selected.includes(issue.title);

                return (
                  <button
                    key={issue.title}
                    type="button"
                    onClick={() => toggleIssue(issue.title)}
                    style={{
                      ...styles.issueCard,
                      borderColor: active ? "#41431b" : "#e5e5e5",
                      background: active ? "rgba(65,67,27,0.06)" : "white",
                    }}
                  >
                    <div style={styles.issueLeft}>
                      <div
                        style={{
                          ...styles.checkCircle,
                          background: active ? "#41431b" : "white",
                          color: active ? "white" : "#41431b",
                          borderColor: "#41431b",
                        }}
                      >
                        {active ? "✓" : ""}
                      </div>

                      <div style={styles.issueTextWrap}>
                        <div style={styles.issueTitle}>{issue.title}</div>
                        <div style={styles.issueDesc}>{issue.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p style={styles.panelNote}>
              » 발표용 데모에서는 복수 선택 가능 / 실제 서비스에서는 추천 이슈 연동 가능
            </p>
          </div>


        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#faf8f0",
    fontFamily: "'Inter', sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  body: {
    display: "flex",
    flex: 1,
  },
  main: {
    flex: 1,
    padding: "44px 48px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    position: "sticky",
    top: 0,
    background: "#faf8f0",
    zIndex: 100,
    padding: "16px 0",
    marginBottom: 24,
    borderBottom: "1px solid #e8e3da",
  },
  titleArea: {
    marginBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 6,
    letterSpacing: "0.02em",
  },
  titleSub: {
    fontSize: 14,
    color: "#777",
  },
  panel: {
    background: "white",
    borderRadius: 16,
    padding: "32px 36px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    marginBottom: 28,
  },
  selectedTypeCard: {
    border: "1.5px solid #c8c9a8",
    background: "rgba(65,67,27,0.05)",
    borderRadius: 14,
    padding: "18px 20px",
    marginBottom: 24,
  },
  selectedTypeHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  selectedTypeBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "#41431b",
    color: "white",
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTypeLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: "#222",
  },
  selectedTypeDesc: {
    fontSize: 13,
    color: "#777",
    marginTop: 2,
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 18,
  },
  issueList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  issueCard: {
    width: "100%",
    border: "1.5px solid",
    borderRadius: 12,
    padding: "18px 18px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textAlign: "left",
  },
  issueLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1.5px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  issueTextWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  issueTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#222",
  },
  issueDesc: {
    fontSize: 13,
    color: "#7a7a7a",
    lineHeight: 1.5,
  },
  panelNote: {
    marginTop: 20,
    fontSize: 12,
    color: "#bbb",
  },
  bottomRow: {
    display: "flex",
    gap: 12,
    flexShrink: 0,
  },
  secondaryBtn: {
    background: "white",
    border: "1.5px solid #ccc",
    borderRadius: 8,
    padding: "10px 22px",
    fontSize: 14,
    fontWeight: 500,
    color: "#444",
    cursor: "pointer",
  },
  primaryBtn: {
    background: "#41431b",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    transition: "background 0.2s",
  },
  emptyWrap: {
    paddingTop: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
    marginTop: 8,
    marginBottom: 18,
  },
};

export default IssueSelect;