import { useNavigate } from "react-router-dom";

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="hero">
      <div className="hero-overlay"></div>

      <div className="hero-content">
        <h1>AI Powered ESG Reporting</h1>
        <p>
          Automate ESG data collection, analysis and report generation with AI.
          Build sustainable corporate transparency faster.
        </p>
        <button className="main-btn" onClick={() => navigate("/materiality")}>
          Get Started
        </button>
      </div>
    </section>
  );
}

export default Hero;