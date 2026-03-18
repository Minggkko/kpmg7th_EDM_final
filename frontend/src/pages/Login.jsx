import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../api";

function Login({ onLogin }) {
  const navigate = useNavigate();

  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!id || !pw) {
      setError("아이디와 비밀번호를 입력하세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await loginApi({ username: id, password: pw });
      const { access_token, username } = res.data;
      localStorage.setItem("token", access_token);
      localStorage.setItem("login", "true");
      localStorage.setItem("username", username);
      onLogin();
      navigate("/esg-select");
    } catch (err) {
      setError(err.response?.data?.detail || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };
  
  

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>Login</h2>

        <input
          style={styles.input}
          placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />

        <input
          style={styles.input}
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />

        <button style={styles.loginBtn} onClick={handleLogin} disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {error && <p style={styles.errorMsg}>{error}</p>}

        <p style={styles.signupText}>
          계정이 없으신가요?{" "}
          <span style={styles.signupLink} onClick={() => navigate("/signup")}>
            회원가입
          </span>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#F5F5F3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: 360,
    background: "white",
    padding: 40,
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: {
    textAlign: "center",
    marginBottom: 10,
  },
  input: {
    padding: "12px",
    borderRadius: 8,
    border: "1px solid #ddd",
  },
  loginBtn: {
    marginTop: 10,
    padding: "12px",
    background: "#656D3F",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  signupText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
  },
  signupLink: {
    color: "#84934A",
    cursor: "pointer",
    fontWeight: 600,
  },
  errorMsg: {
    color: "#e55",
    fontSize: 13,
    textAlign: "center",
    margin: 0,
  },
};

export default Login;