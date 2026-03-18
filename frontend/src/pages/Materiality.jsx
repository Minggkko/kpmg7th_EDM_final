function Materiality() {
  const issues = [
    "탄소 배출",
    "에너지 사용",
    "폐기물 관리",
    "노동권",
    "다양성",
    "지역사회 영향",
    "데이터 보안",
    "윤리 경영"
  ];

  return (
    <div className="materiality-page">

      <h1>중대성 이슈 선택</h1>
      <p>리포트에 포함할 ESG 핵심 이슈를 선택하세요.</p>

      <div className="issue-grid">
        {issues.map((issue) => (
          <label className="issue-card" key={issue}>
            <input type="checkbox" />
            <span>{issue}</span>
          </label>
        ))}
      </div>

    </div>
  );
}

export default Materiality;