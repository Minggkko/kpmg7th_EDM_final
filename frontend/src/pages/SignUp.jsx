import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkUsername, searchCompanies, signup } from "../api";

function SignUp() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [id, setId]                     = useState("");
  const [idChecked, setIdChecked]       = useState(false);
  const [pw, setPw]                     = useState("");
  const [pwConfirm, setPwConfirm]       = useState("");

  const [username, setUsername]             = useState("");
  const [companyEmail, setCompanyEmail]     = useState("");
  const [company, setCompany]               = useState("");
  const [companySearch, setCompanySearch]   = useState("");
  const [companyId, setCompanyId]           = useState(null);
  const [companyDomain, setCompanyDomain]   = useState("");
  const [companyList, setCompanyList]       = useState([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");

  const pwValid = pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
  const pwMatch = pw === pwConfirm;
  const step1OK = idChecked && pwValid && pwMatch && pw !== "";

  const emailDomainValid = !companyDomain || companyEmail.toLowerCase().endsWith(`@${companyDomain.toLowerCase()}`);

  const handleIdCheck = async () => {
    if (!id) return;
    try {
      const res = await checkUsername(id);
      if (res.data.available) {
        alert(`"${id}" 사용 가능한 아이디입니다.`);
        setIdChecked(true);
      } else {
        alert(`"${id}" 은(는) 이미 사용 중인 아이디입니다.`);
        setIdChecked(false);
      }
    } catch {
      alert("중복확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const handleCompanySearch = async () => {
    if (!companySearch) return;
    try {
      const res = await searchCompanies(companySearch);
      setCompanyList(res.data);
      if (res.data.length === 0) alert("검색 결과가 없습니다.");
    } catch {
      alert("회사 검색 중 오류가 발생했습니다.");
    }
  };

  const handleSelectCompany = (c) => {
    setCompany(c.name);
    setCompanyId(c.id);
    setCompanyDomain(c.email_domain);
    setCompanyList([]);
    setCompanySearch(c.name);
  };

  const handleSubmit = async () => {
    if (!username || !companyEmail || !company || !companyId) return;
    if (!emailDomainValid) {
      setError(`회사 이메일은 @${companyDomain} 으로 끝나야 합니다.`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signup({
        username: id,
        password: pw,
        display_name: username,
        work_email: companyEmail,
        company_id: companyId,
      });
      alert("회원가입이 완료되었습니다! 로그인해주세요.");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>

      {/* 좌측 브랜드 패널 */}
      <div style={styles.left}>
        <div style={styles.brand} onClick={() => navigate("/")}>EDM</div>
        <div style={styles.leftContent}>
          <h2 style={styles.leftTitle}>ESG 데이터 관리를<br/>더 스마트하게</h2>
          <p style={styles.leftDesc}>
            AI 기반 ESG 분석 플랫폼으로<br/>
            지속 가능한 경영을 실현하세요.
          </p>
          <div style={styles.dots}>
            <div style={{ ...styles.dot, background: step === 1 ? "#fff" : "rgba(255,255,255,0.4)" }} />
            <div style={{ ...styles.dot, background: step === 2 ? "#fff" : "rgba(255,255,255,0.4)" }} />
          </div>
        </div>
      </div>

      {/* 우측 폼 패널 */}
      <div style={styles.right}>
        <div style={styles.card}>

          <div style={styles.cardTop}>
            <div>
              <p style={styles.stepLabel}>STEP {step} / 2</p>
              <h2 style={styles.cardTitle}>회원가입</h2>
            </div>
            {/* 프로그레스 바 */}
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: step === 1 ? "50%" : "100%" }} />
            </div>
          </div>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div style={styles.form}>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>아이디</label>
                <div style={styles.row}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="사용할 아이디를 입력하세요"
                    value={id}
                    onChange={e => { setId(e.target.value); setIdChecked(false); }}
                  />
                  <button
                    style={{
                      ...styles.outlineBtn,
                      borderColor: idChecked ? "#84934A" : "#ccc",
                      color: idChecked ? "#84934A" : "#666",
                    }}
                    onClick={handleIdCheck}
                  >
                    {idChecked ? "✓ 확인됨" : "중복확인"}
                  </button>
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>비밀번호</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="8자 이상, 영문+숫자 포함"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                />
                {pw && (
                  <div style={styles.pwStrength}>
                    <div style={{
                      ...styles.pwBar,
                      width: pwValid ? "100%" : pw.length >= 4 ? "50%" : "20%",
                      background: pwValid ? "#84934A" : pw.length >= 4 ? "#e6a817" : "#e55",
                    }} />
                  </div>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>비밀번호 확인</label>
                <input
                  style={{
                    ...styles.input,
                    borderColor: pwConfirm && !pwMatch ? "#e55" : "#ddd",
                  }}
                  type="password"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={pwConfirm}
                  onChange={e => setPwConfirm(e.target.value)}
                />
                {pwConfirm && !pwMatch && (
                  <p style={styles.errorMsg}>비밀번호가 일치하지 않습니다.</p>
                )}
                {pwConfirm && pwMatch && (
                  <p style={{ ...styles.errorMsg, color: "#84934A" }}>✓ 비밀번호가 일치합니다.</p>
                )}
              </div>

              <button
                style={{ ...styles.primaryBtn, opacity: step1OK ? 1 : 0.4 }}
                disabled={!step1OK}
                onClick={() => setStep(2)}
              >
                다음 단계
              </button>

              <p style={styles.loginLink}>
                이미 계정이 있으신가요?{" "}
                <span style={styles.link} onClick={() => navigate("/")}>로그인</span>
              </p>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div style={styles.form}>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>사용자명</label>
                <input
                  style={styles.input}
                  placeholder="이름을 입력하세요"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>회사 이메일</label>
                <input
                  style={{
                    ...styles.input,
                    borderColor: companyEmail && companyDomain && !emailDomainValid ? "#e55" : "#ddd",
                  }}
                  placeholder={companyDomain ? `example@${companyDomain}` : "company@example.com"}
                  value={companyEmail}
                  onChange={e => setCompanyEmail(e.target.value)}
                />
                {companyEmail && companyDomain && !emailDomainValid && (
                  <p style={{ color: "#e55", fontSize: 12, margin: 0 }}>
                    이메일은 @{companyDomain} 으로 끝나야 합니다.
                  </p>
                )}
                {companyEmail && companyDomain && emailDomainValid && (
                  <p style={{ color: "#84934A", fontSize: 12, margin: 0 }}>✓ 이메일 도메인이 일치합니다.</p>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>회사 선택</label>
                <div style={styles.row}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    placeholder="회사명을 검색하세요"
                    value={companySearch}
                    onChange={e => { setCompanySearch(e.target.value); setCompany(""); setCompanyId(null); setCompanyDomain(""); }}
                  />
                  <button style={styles.outlineBtn} onClick={handleCompanySearch}>
                    검색
                  </button>
                </div>
                {companyList.length > 0 && (
                  <div style={styles.dropdown}>
                    {companyList.map(c => (
                      <div
                        key={c.id}
                        style={styles.dropdownItem}
                        onClick={() => handleSelectCompany(c)}
                      >
                        <strong>{c.name}</strong>
                        <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>@{c.email_domain}</span>
                      </div>
                    ))}
                  </div>
                )}
                {company && companyId && (
                  <div style={styles.selectedCompany}>
                    <span style={styles.selectedDot} />
                    {company}
                  </div>
                )}
                <p style={styles.hint}>회사 이메일 도메인과 회사 정보가 일치해야 합니다.</p>
              </div>

              {error && <p style={{ color: "#e55", fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={styles.btnRow}>
                <button style={styles.secondaryBtn} onClick={() => setStep(1)}>
                  이전
                </button>
                <button
                  style={{
                    ...styles.primaryBtn,
                    flex: 1,
                    opacity: username && companyEmail && company && companyId && emailDomainValid ? 1 : 0.4,
                  }}
                  disabled={!username || !companyEmail || !company || !companyId || !emailDomainValid || loading}
                  onClick={handleSubmit}
                >
                  {loading ? "처리 중..." : "회원가입 완료"}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Inter', sans-serif",
  },

  /* 좌측 */
  left: {
    width: 380,
    background: "linear-gradient(160deg, #656D3F 0%, #84934A 60%, #9aab56 100%)",
    display: "flex",
    flexDirection: "column",
    padding: "40px 44px",
    color: "#fff",
    flexShrink: 0,
  },
  brand: {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: 2,
    cursor: "pointer",
    marginBottom: "auto",
  },
  leftContent: {
    marginBottom: 60,
  },
  leftTitle: {
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1.45,
    marginBottom: 16,
  },
  leftDesc: {
    fontSize: 15,
    lineHeight: 1.7,
    opacity: 0.85,
    marginBottom: 32,
  },
  dots: {
    display: "flex",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "background 0.3s",
  },

  /* 우측 */
  right: {
    flex: 1,
    background: "#F5F5F3",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "40px 44px",
    width: "100%",
    maxWidth: 420,
    boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
  },
  cardTop: {
    marginBottom: 32,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#84934A",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1a1a1a",
    marginBottom: 16,
  },
  progressTrack: {
    height: 4,
    background: "#eee",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#84934A",
    borderRadius: 99,
    transition: "width 0.4s ease",
  },

  /* 폼 */
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
  },
  row: {
    display: "flex",
    gap: 8,
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    border: "1px solid #ddd",
    borderRadius: 10,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    color: "#333",
    background: "#fafafa",
    transition: "border-color 0.2s",
  },
  pwStrength: {
    height: 3,
    background: "#eee",
    borderRadius: 99,
    overflow: "hidden",
    marginTop: 4,
  },
  pwBar: {
    height: "100%",
    borderRadius: 99,
    transition: "width 0.3s, background 0.3s",
  },
  errorMsg: {
    fontSize: 12,
    color: "#e55",
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 4,
  },
  outlineBtn: {
    background: "#fff",
    color: "#666",
    border: "1px solid #ccc",
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
  },
  primaryBtn: {
    background: "#84934A",
    color: "#fff",
    border: "none",
    padding: "13px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    marginTop: 4,
  },
  btnRow: {
    display: "flex",
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    background: "#fff",
    color: "#666",
    border: "1px solid #ddd",
    padding: "13px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  selectedCompany: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#656D3F",
    background: "rgba(132,147,74,0.10)",
    padding: "9px 14px",
    borderRadius: 8,
    fontWeight: 600,
    marginTop: 4,
  },
  dropdown: {
    border: "1px solid #ddd",
    borderRadius: 10,
    background: "#fff",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    maxHeight: 180,
    overflowY: "auto",
    marginTop: 4,
  },
  dropdownItem: {
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: 14,
    borderBottom: "1px solid #f0f0f0",
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#84934A",
    flexShrink: 0,
  },
  loginLink: {
    textAlign: "center",
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
  link: {
    color: "#84934A",
    cursor: "pointer",
    fontWeight: 700,
  },
};

export default SignUp;