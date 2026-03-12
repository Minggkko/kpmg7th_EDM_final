import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "./Dashboard.css";

function Dashboard({ isLoggedIn, onLogout }) {

  const navigate = useNavigate();
  const location = useLocation();

  const { type, issues } = location.state || {};

  return (
    <div style={styles.page}>

      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={styles.body}>

        <Sidebar currentStep="dashboard" />

        <main style={styles.main}>

          <div style={styles.header}>
            <h1 style={styles.title}>ESG Dashboard</h1>
            <p style={styles.desc}>
              선택된 ESG 영역과 중대성 이슈를 기반으로 분석을 진행합니다.
            </p>
          </div>

          <div style={styles.grid}>

            <div style={styles.card}>
              <h3>ESG 영역</h3>
              {type ? (
                <div style={styles.badge}>{type}</div>
              ) : (
                <p style={styles.empty}>선택된 영역 없음</p>
              )}
            </div>

            <div style={styles.card}>
              <h3>선택된 이슈</h3>
              <div style={styles.issueWrap}>
                {issues && issues.length > 0 ? (
                  issues.map(issue => (
                    <div key={issue} style={styles.issue}>
                      {issue}
                    </div>
                  ))
                ) : (
                  <p style={styles.empty}>선택된 이슈 없음</p>
                )}
              </div>
            </div>

            <div style={styles.card}>
              <h3>ESG Score</h3>
              <p style={{ fontSize: 32, fontWeight: 700 }}>82</p>
              <p style={{ color: "#777" }}>Demo Score</p>
            </div>

          </div>

          <div style={styles.bottom}>
            <button
              style={styles.primaryBtn}
              onClick={() => navigate("/data-upload", { state: { type, issues } })}
            >
              데이터 업로드
            </button>
          </div>

        </main>

      </div>
    </div>
  );
}

const styles = {

  page: { minHeight: "100vh", background: "#F5F5F3", display: "flex", flexDirection: "column" },

  body: { display: "flex", flex: 1 },

  main: { flex: 1, padding: "44px 48px" },

  header: { marginBottom: 30 },

  title: { fontSize: 26, fontWeight: 700 },

  desc: { fontSize: 14, color: "#777" },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 20,
    marginBottom: 40
  },

  card: {
    background: "white",
    padding: 24,
    borderRadius: 16,
    boxShadow: "0 2px 16px rgba(0,0,0,0.05)"
  },

  badge: {
    marginTop: 10,
    display: "inline-block",
    background: "#84934A",
    color: "white",
    padding: "6px 14px",
    borderRadius: 20
  },

  issueWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10
  },

  issue: {
    border: "1px solid #84934A",
    color: "#84934A",
    padding: "5px 12px",
    borderRadius: 20,
    fontSize: 13
  },

  empty: {
    marginTop: 10,
    fontSize: 13,
    color: "#aaa"
  },

  bottom: { display: "flex", justifyContent: "flex-end" },

  primaryBtn: {
    background: "#84934A",
    color: "white",
    border: "none",
    padding: "12px 26px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600
  }

};

export default Dashboard;