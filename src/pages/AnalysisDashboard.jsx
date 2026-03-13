import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import "./AnalysisDashboard.css";

const scores = [
  { label: "Environment", short: "E", value: 72, tone: "e" },
  { label: "Social",       short: "S", value: 88, tone: "s" },
  { label: "Governance",   short: "G", value: 81, tone: "g" },
];

const trendData = [
  { year: "2021", value: 58 },
  { year: "2022", value: 67 },
  { year: "2023", value: 74 },
  { year: "2024", value: 82 },
];

const risks = [
  { title: "탄소 배출 데이터 일부 누락",   desc: "환경 데이터 입력 항목 중 일부 월별 값이 비어 있습니다.", level: "High" },
  { title: "공급망 정책 공개 부족",        desc: "협력사 ESG 관리 기준 문서가 업로드되지 않았습니다.",     level: "Medium" },
  { title: "사회공헌 수치 불일치",         desc: "내부 입력값과 증빙자료 간 일부 수치가 다릅니다.",       level: "Low" },
];

const logs = [
  { task: "데이터 조회",    status: "완료", time: "2.1s" },
  { task: "이상치 탐지",    status: "완료", time: "1.4s" },
  { task: "증빙자료 검증",  status: "완료", time: "1.0s" },
  { task: "ESG 점수 산출", status: "완료", time: "0.9s" },
];

function AnalysisDashboard({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileName = location.state?.fileName || "uploaded_file.pdf";

  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F3", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column" }}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar currentStep="analysis-dashboard" />

        <div className="analysis-dashboard">

          {/* Header */}
          <div className="dashboard-header">
            <div>
              <p className="dashboard-eyebrow">AI ESG Analysis</p>
              <h1>분석 대시보드</h1>
              <p className="dashboard-subtitle">
                업로드된 데이터를 기반으로 ESG 현황, 리스크, 분석 진행 결과를 한눈에 확인할 수 있습니다.
              </p>
            </div>
            <div className="header-actions">
              <button className="ghost-btn" onClick={() => navigate("/data-upload")}>데이터 다시 업로드</button>
              <button className="primary-btn" onClick={() => navigate("/report")}>ESG 리포트 생성</button>
            </div>
          </div>

          {/* Hero Grid */}
          <div className="hero-grid">
            <section className="hero-card insight-card">
              <div className="card-top">
                <span className="card-chip">AI Summary</span>
              </div>
              <h2>기업 ESG 활동은 전반적으로 안정적입니다</h2>
              <p className="hero-text">
                사회(S) 영역 점수가 가장 높고, 지배구조(G)도 양호한 수준입니다.
                다만 환경(E) 영역은 데이터 누락과 공시 보완이 필요해 개선 여지가 있습니다.
              </p>
              <div className="insight-stats">
                <div className="mini-stat">
                  <span className="mini-stat-label">종합 점수</span>
                  <strong>80</strong>
                </div>
                <div className="mini-stat">
                  <span className="mini-stat-label">탐지 리스크</span>
                  <strong>3건</strong>
                </div>
                <div className="mini-stat">
                  <span className="mini-stat-label">분석 상태</span>
                  <strong>완료</strong>
                </div>
              </div>
            </section>

            <section className="hero-card risk-summary-card">
              <div className="card-top">
                <span className="card-chip danger">Detected Risk</span>
              </div>
              <div className="risk-summary-main">
                <div>
                  <p className="risk-summary-label">우선 확인 필요</p>
                  <h3>환경 데이터 누락</h3>
                </div>
                <span className="risk-badge high">High</span>
              </div>
              <p className="risk-summary-desc">
                월별 배출량 데이터가 일부 비어 있어 최종 보고서 정확도에 영향을 줄 수 있습니다.
              </p>
              <div className="risk-progress-wrap">
                <div className="risk-progress-head">
                  <span>리스크 대응 진행률</span>
                  <span>62%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: "62%" }} />
                </div>
              </div>
            </section>
          </div>

          {/* Score Section */}
          <section className="score-section">
            {scores.map((item) => (
              <div key={item.short} className={`score-card ${item.tone}`}>
                <div className="score-card-top">
                  <span className="score-short">{item.short}</span>
                  <span className="score-label">{item.label}</span>
                </div>
                <div className="score-value-row">
                  <strong>{item.value}</strong>
                  <span>/ 100</span>
                </div>
                <div className="score-bar">
                  <div className="score-bar-fill" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </section>

          {/* Content Grid */}
          <div className="content-grid">
            <section className="panel trend-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">Performance</p>
                  <h3>ESG Trend</h3>
                </div>
                <span className="panel-note">최근 4개년 기준</span>
              </div>
              <div className="trend-chart">
                {trendData.map((item) => (
                  <div key={item.year} className="trend-item">
                    <div className="trend-bar-wrap">
                      <div className="trend-bar" style={{ height: `${item.value}%` }}>
                        <span className="trend-tooltip">{item.value}</span>
                      </div>
                    </div>
                    <span className="trend-year">{item.year}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel risk-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-eyebrow">Risk List</p>
                  <h3>세부 리스크</h3>
                </div>
              </div>
              <div className="risk-list">
                {risks.map((risk) => (
                  <div key={risk.title} className="risk-list-item">
                    <div className="risk-list-top">
                      <h4>{risk.title}</h4>
                      <span className={`risk-badge ${risk.level.toLowerCase()}`}>{risk.level}</span>
                    </div>
                    <p>{risk.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Log Panel */}
          <section className="panel log-panel">
            <div className="panel-header">
              <div>
                <p className="panel-eyebrow">Process</p>
                <h3>분석 로그</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>분석 항목</th>
                    <th>상태</th>
                    <th>소요 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.task}>
                      <td>{log.task}</td>
                      <td><span className="status-badge done">{log.status}</span></td>
                      <td>{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default AnalysisDashboard;