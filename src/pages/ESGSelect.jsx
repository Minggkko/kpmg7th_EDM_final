import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

const categories = [
  {
    id: "environment",
    letter: "E",
    label: "Environment",
    desc: "기후/배출/에너지/자원",
  },
  {
    id: "social",
    letter: "S",
    label: "Social",
    desc: "산업안전/인권/공급망",
  },
  {
    id: "governance",
    letter: "G",
    label: "Governance",
    desc: "이사회/내부통제/윤리",
  },
];

function ESGSelect({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  const handleNext = () => {
    if (!selected) return;
    navigate(`/issue-select?type=${selected}`);
  };

  return (
    <div style={styles.page}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={styles.body}>
        <Sidebar currentStep="esg-select" />

        <main style={styles.main}>
          <div style={styles.titleArea}>
            <h1 style={styles.title}>E / S / G &nbsp; 영역 선택</h1>
            <p style={styles.titleSub}>
              분석할 영역을 선택하세요. (발표용 흐름에선 1개 선택을 가정)
            </p>
          </div>

          <div style={styles.panel}>
            <p style={styles.panelLabel}>영역</p>

            <div style={styles.cardRow}>
              {categories.map((cat) => {
                const isSelected = selected === cat.id;

                return (
                  <div
                    key={cat.id}
                    style={{
                      ...styles.card,
                      borderColor: isSelected ? "#41431b" : "#e0e0e0",
                      background: isSelected
                        ? "rgba(65,67,27,0.04)"
                        : "white",
                    }}
                  >
                    <div style={styles.cardHeader}>
                      <div
                        style={{
                          ...styles.letterBadge,
                          background: isSelected ? "#41431b" : "#aeb784",
                        }}
                      >
                        {cat.letter}
                      </div>
                      <span style={styles.cardLabel}>{cat.label}</span>
                    </div>

                    <p style={styles.cardDesc}>{cat.desc}</p>

                    <button
                      type="button"
                      style={{
                        ...styles.selectBtn,
                        background: isSelected ? "#41431b" : "white",
                        color: isSelected ? "white" : "#41431b",
                        border: "1.5px solid #41431b",
                      }}
                      onClick={() => setSelected(cat.id)}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background =
                            "rgba(174,183,132,0.15)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "white";
                        }
                      }}
                    >
                      {isSelected ? "✓ 선택됨" : "선택"}
                    </button>
                  </div>
                );
              })}
            </div>

            <p style={styles.panelNote}>
              » 실제 서비스에서는 복수 선택 및 권장 영역 표시가 가능
            </p>
          </div>

          <div style={styles.bottomRow}>
            <button
              type="button"
              style={styles.homeBtn}
              onClick={() => navigate("/")}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#aeb784";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#ccc";
              }}
            >
              홈으로
            </button>

            <button
              type="button"
              style={{
                ...styles.nextBtn,
                opacity: selected ? 1 : 0.45,
                cursor: selected ? "pointer" : "not-allowed",
              }}
              disabled={!selected}
              onClick={handleNext}
              onMouseEnter={(e) => {
                if (selected) e.currentTarget.style.background = "#aeb784";
              }}
              onMouseLeave={(e) => {
                if (selected) e.currentTarget.style.background = "#41431b";
              }}
            >
              다음: 이슈 선택 →
            </button>
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
  titleArea: {
    marginBottom: 28,
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
  panelLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 20,
  },
  cardRow: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap",
  },
  card: {
    flex: "1 1 200px",
    border: "1.5px solid",
    borderRadius: 12,
    padding: "24px 20px",
    transition: "all 0.2s ease",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  letterBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    transition: "background 0.2s",
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#222",
  },
  cardDesc: {
    fontSize: 13,
    color: "#888",
    marginBottom: 18,
    lineHeight: 1.6,
  },
  selectBtn: {
    padding: "8px 20px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  panelNote: {
    marginTop: 24,
    fontSize: 12,
    color: "#bbb",
  },
  bottomRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
  },
  homeBtn: {
    background: "white",
    border: "1.5px solid #ccc",
    borderRadius: 8,
    padding: "10px 22px",
    fontSize: 14,
    fontWeight: 500,
    color: "#444",
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  nextBtn: {
    background: "#41431b",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    transition: "background 0.2s",
  },
};

export default ESGSelect;