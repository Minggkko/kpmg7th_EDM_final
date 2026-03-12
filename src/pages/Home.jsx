import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CTA from "../components/CTA";
import { useNavigate } from "react-router-dom";

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84934A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
        <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
      </svg>
    ),
    title: "Data Collection",
    desc: "Automatically collect ESG data from public disclosures.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84934A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 8v4l3 3"/>
        <path d="M9.5 3.5C9.5 3.5 8 6 8 8s1.5 3 4 3 4-1 4-3"/>
      </svg>
    ),
    title: "AI Analysis",
    desc: "Analyze ESG indicators using machine learning.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84934A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <path d="M14 17.5h7M17.5 14v7"/>
      </svg>
    ),
    title: "Framework Mapping",
    desc: "Align data with ISSB, GRI and global ESG frameworks.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84934A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7"/>
        <path d="M21 21l-4.35-4.35"/>
        <path d="M8 11h6M11 8v6"/>
      </svg>
    ),
    title: "Gap Analysis",
    desc: "Identify missing ESG disclosure elements.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84934A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="16" y2="17"/>
        <line x1="8" y1="9" x2="10" y2="9"/>
      </svg>
    ),
    title: "Report Generation",
    desc: "Generate ESG report drafts automatically.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#84934A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polyline points="9 12 11 14 15 10"/>
      </svg>
    ),
    title: "Governance Automation",
    desc: "Create governance disclosure sections automatically.",
  },
];

function Home({ isLoggedIn, onLogout }) {
  return (
    <>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <Hero />

      <section style={styles.features}>
        <h2 style={styles.featuresTitle}>What Our Platform Does</h2>

        <div style={styles.grid}>
          {features.map((f) => (
            <div
              key={f.title}
              style={styles.card}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 12px 30px rgba(0,0,0,0.10)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 5px 15px rgba(0,0,0,0.05)";
              }}
            >
              <div style={styles.iconBox}>{f.icon}</div>
              <h3 style={styles.cardTitle}>{f.title}</h3>
              <p style={styles.cardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <CTA />
    </>
  );
}

const styles = {
  features: {
    padding: "80px",
    textAlign: "center",
    background: "#ECECEC",
    fontFamily: "'Inter', sans-serif",
  },
  featuresTitle: {
    marginBottom: 50,
    fontSize: 32,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 30,
  },
  card: {
    background: "white",
    padding: "36px 28px",
    borderRadius: 16,
    boxShadow: "0 5px 15px rgba(0,0,0,0.05)",
    textAlign: "center",
    transition: "all 0.25s ease",
    cursor: "default",
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "rgba(132,147,74,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 18px",
  },
  cardTitle: {
    color: "#656D3F",
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 10,
  },
  cardDesc: {
    color: "#666",
    fontSize: 14,
    lineHeight: 1.65,
  },
};

export default Home;