import { useNavigate } from "react-router-dom";

function CTA() {
  const navigate = useNavigate();

  return (
    <section className="cta">
      <h2>Start ESG Reporting Automation</h2>
      <button className="main-btn" onClick={() => navigate("/materiality")}>
        Start Now
      </button>
    </section>
  );
}

export default CTA;