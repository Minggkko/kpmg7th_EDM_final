import { useNavigate } from "react-router-dom";

function Navbar({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const handleStartNow = () => {

  const isLogin = localStorage.getItem("login");

  if (isLogin === "true") {
    navigate("/esg-select");
  } else {
    alert("로그인이 필요한 서비스입니다.");
    navigate("/login");
  }

};

  return (
    <header style={styles.header}>
      <div style={styles.logo} onClick={() => navigate("/")}>
        EDM
      </div>

      <nav style={styles.navMenu}>
        <a
          onClick={() => navigate("/")}
          style={styles.navLink}
          onMouseEnter={e => (e.target.style.color = "#84934A")}
          onMouseLeave={e => (e.target.style.color = "#333")}
        >
          Home
        </a>
        <a
          style={styles.navLink}
          onMouseEnter={e => (e.target.style.color = "#84934A")}
          onMouseLeave={e => (e.target.style.color = "#333")}
        >
          About
        </a>
        <a
          style={styles.navLink}
          onMouseEnter={e => (e.target.style.color = "#84934A")}
          onMouseLeave={e => (e.target.style.color = "#333")}
        >
          How it Works
        </a>
        <a
          style={styles.navLink}
          onMouseEnter={e => (e.target.style.color = "#84934A")}
          onMouseLeave={e => (e.target.style.color = "#333")}
        >
          Contact
        </a>
      </nav>

      <div style={styles.navButtons}>
        {isLoggedIn ? (
          <a
            onClick={() => {
              localStorage.removeItem("login");
              onLogout();
            }}
            style={styles.logoutLink}
            onMouseEnter={e => (e.target.style.color = "#492828")}
            onMouseLeave={e => (e.target.style.color = "#656D3F")}
          >
            Logout
          </a>
        ) : (
          <>
            <a
              style={styles.loginBtn}
              onClick={() => navigate("/login")}
              onMouseEnter={e => (e.target.style.color = "#492828")}
              onMouseLeave={e => (e.target.style.color = "#656D3F")}
            >
              Login
            </a>

            <a
              style={styles.signupBtn}
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </a>

            <button
              style={styles.demoBtn}
              onClick={handleStartNow}
              onMouseEnter={e => (e.currentTarget.style.background = "#492828")}
              onMouseLeave={e => (e.currentTarget.style.background = "#656D3F")}
            >
              Start Now
            </button>
          </>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 40px",
    height: 70,
    background: "#ffffff",
    borderBottom: "1px solid #e5e7eb",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },

  logo: {
    fontSize: 22,
    fontWeight: 800,
    color: "#84934A",
    cursor: "pointer",
  },

  navMenu: {
    display: "flex",
    gap: 36,
  },

  navLink: {
    fontSize: 15,
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
    textDecoration: "none",
    transition: "color 0.15s",
  },

  navButtons: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  loginBtn: {
    fontSize: 14,
    color: "#475569",
    cursor: "pointer",
  },

  signupBtn: {
    fontSize: 14,
    color: "#84934A",
    fontWeight: 700,
    cursor: "pointer",
  },

  logoutLink: {
    fontSize: 14,
    color: "#84934A",
    fontWeight: 600,
    cursor: "pointer",
  },

  demoBtn: {
    background: "#84934A",  // 앱 테마색
    color: "#ffffff",
    border: "none",
    padding: "10px 22px",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
};

export default Navbar;