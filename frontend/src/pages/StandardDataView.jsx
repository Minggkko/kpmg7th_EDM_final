import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { getGroupedStandardized } from "../api";

// API 응답을 UI 구조로 변환
function transformApiData(apiData) {
  return apiData.map((issue) => ({
    id: issue.id,
    name: issue.name,
    indicators: issue.indicators.map((indicator) => ({
      id: indicator.id,
      name: indicator.name,
      data: (indicator.data_groups || []).map((group, gIdx) => ({
        id: indicator.id * 1000 + gIdx,
        label: `Data${gIdx + 1}`,
        category: group.group,
        dps: (group.data_points || []).map((dp) => ({
          id: dp.id,
          name: dp.name,
          unit: dp.unit || "-",
          value: dp.value !== null && dp.value !== undefined ? dp.value : "-",
          period: dp.reporting_date ? dp.reporting_date.slice(0, 4) : "-",
        })),
      })),
    })),
  }));
}

export default function StandardDataView({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeIssueIdx, setActiveIssueIdx] = useState(0);
  const [activeIndicatorIdx, setActiveIndicatorIdx] = useState(0);
  const [activeDataIdx, setActiveDataIdx] = useState(0);
  const [confirmedData, setConfirmedData] = useState(new Set());

  useEffect(() => {
    getGroupedStandardized()
      .then((res) => {
        setIssues(transformApiData(res.data));
      })
      .catch((err) => {
        setFetchError(err.response?.data?.detail || err.message || "데이터 로딩 실패");
      })
      .finally(() => setLoading(false));
  }, []);

  // 현재 선택 항목
  const currentIssue = issues[activeIssueIdx];
  const currentIndicator = currentIssue?.indicators?.[activeIndicatorIdx];
  const currentData = currentIndicator?.data?.[activeDataIdx];

  // 완료 여부 계산
  const isDataDone = (dataId) => confirmedData.has(dataId);
  const isIndicatorDone = (indicator) =>
    indicator.data.length > 0 && indicator.data.every((d) => isDataDone(d.id));
  const isIssueDone = (issue) =>
    issue.indicators.length > 0 && issue.indicators.every((i) => isIndicatorDone(i));
  const allDone = issues.length > 0 && issues.every((issue) => isIssueDone(issue));

  const handleIssueClick = (idx) => {
    setActiveIssueIdx(idx);
    setActiveIndicatorIdx(0);
    setActiveDataIdx(0);
  };

  const handleIndicatorClick = (idx) => {
    setActiveIndicatorIdx(idx);
    setActiveDataIdx(0);
  };

  const handleDataTabClick = (idx) => {
    setActiveDataIdx(idx);
  };

  const handleConfirm = () => {
    if (currentData) {
      setConfirmedData((prev) => new Set([...prev, currentData.id]));
    }
  };

  const isCurrentDataDone = currentData ? isDataDone(currentData.id) : false;

  if (loading) {
    return (
      <div style={s.root}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={{ ...s.body, alignItems: "center", justifyContent: "center", flex: 1 }}>
          <p style={{ color: "#6b7280", fontSize: 16 }}>표준화 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={s.root}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={{ ...s.body, alignItems: "center", justifyContent: "center", flex: 1 }}>
          <p style={{ color: "#b91c1c", fontSize: 16 }}>⚠️ {fetchError}</p>
        </div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div style={s.root}>
        <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
        <div style={{ ...s.body, alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#6b7280", fontSize: 16, marginBottom: 16 }}>
              표준화된 데이터가 없습니다.
            </p>
            <button
              style={{ ...s.verifyBtn, cursor: "pointer" }}
              onClick={() => navigate("/data-upload")}
            >
              데이터 업로드하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>

          {/* 이슈 네비게이션 바 */}
          <div style={s.issueBar}>
            <div style={s.issueTabs}>
              {issues.map((issue, idx) => {
                const done = isIssueDone(issue);
                const active = idx === activeIssueIdx;
                return (
                  <button
                    key={issue.id}
                    style={{
                      ...s.issueTab,
                      ...(active ? s.issueTabActive : {}),
                      ...(done && !active ? s.issueTabDone : {}),
                    }}
                    onClick={() => handleIssueClick(idx)}
                  >
                    {done && <span style={s.checkIcon}>✓</span>}
                    {issue.name}
                  </button>
                );
              })}
            </div>
            <button
              style={allDone ? s.verifyBtn : s.verifyBtnDisabled}
              disabled={!allDone}
              onClick={() => navigate("/anomaly-result")}
            >
              검증
            </button>
          </div>

          {/* 콘텐츠 영역 */}
          <div style={s.contentArea}>

            {/* 좌측: 지표 리스트 */}
            <div style={s.indicatorPanel}>
              <p style={s.panelLabel}>지표</p>
              {(currentIssue?.indicators || []).map((indicator, idx) => {
                const done = isIndicatorDone(indicator);
                const active = idx === activeIndicatorIdx;
                return (
                  <button
                    key={indicator.id}
                    style={{
                      ...s.indicatorBtn,
                      ...(active ? s.indicatorBtnActive : {}),
                      ...(done && !active ? s.indicatorBtnDone : {}),
                    }}
                    onClick={() => handleIndicatorClick(idx)}
                  >
                    <span style={s.indicatorLabel}>지표 {idx + 1}</span>
                    <span style={s.indicatorName}>{indicator.name}</span>
                    {done && <span style={s.indicatorCheck}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* 우측: 데이터 탭 + DP 테이블 */}
            <div style={s.dataPanel}>

              {/* Data 탭 */}
              <div style={s.dataTabs}>
                {(currentIndicator?.data || []).map((data, idx) => {
                  const done = isDataDone(data.id);
                  const active = idx === activeDataIdx;
                  return (
                    <button
                      key={data.id}
                      style={{
                        ...s.dataTab,
                        ...(active ? s.dataTabActive : {}),
                        ...(done && !active ? s.dataTabDone : {}),
                      }}
                      onClick={() => handleDataTabClick(idx)}
                    >
                      <span style={s.dataCategory}>{data.category}</span>
                      <span style={{
                        ...s.dataLabel,
                        color: active ? "#5C6B2E" : done ? "#16a34a" : "#888",
                      }}>
                        {done && "✓ "}{data.label}
                      </span>
                    </button>
                  );
                })}
                {(!currentIndicator?.data || currentIndicator.data.length === 0) && (
                  <span style={{ padding: "12px 20px", color: "#aaa", fontSize: 13 }}>
                    데이터 없음
                  </span>
                )}
              </div>

              {/* DP 테이블 */}
              {currentData ? (
              <div style={s.dpArea}>
                <div style={s.dpHeader}>
                  <div style={s.dpHeaderLeft}>
                    <span style={s.dpTitle}>{currentData.category}</span>
                    <span style={s.dpSubtitle}>총 {currentData.dps.length}개 데이터 포인트</span>
                  </div>
                  {isCurrentDataDone && (
                    <span style={s.doneBadge}>✓ 확인 완료</span>
                  )}
                </div>

                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>데이터 포인트</th>
                      <th style={s.th}>단위</th>
                      <th style={s.th}>수집 기간</th>
                      <th style={s.th}>값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.dps.map((dp, idx) => (
                      <tr key={dp.id} style={idx % 2 === 0 ? s.trEven : s.trOdd}>
                        <td style={{ ...s.td, fontWeight: 500, color: "#222" }}>{dp.name}</td>
                        <td style={{ ...s.td, color: "#888", textAlign: "center" }}>{dp.unit}</td>
                        <td style={{ ...s.td, color: "#888", textAlign: "center" }}>{dp.period}</td>
                        <td style={{ ...s.td, textAlign: "right", fontWeight: 600, color: "#1a1a1a" }}>
                          {dp.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={s.confirmRow}>
                  <button
                    style={isCurrentDataDone ? s.confirmedBtn : s.confirmBtn}
                    onClick={handleConfirm}
                    disabled={isCurrentDataDone}
                  >
                    {isCurrentDataDone ? "✓ 확인 완료" : "확인"}
                  </button>
                </div>
              </div>
              ) : (
                <div style={{ padding: "32px 28px", color: "#aaa", fontSize: 14 }}>
                  데이터를 선택하세요.
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    background: "#FAF8F0",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  body: { display: "flex" },
  main: { flex: 1, padding: "32px 40px", minHeight: "calc(100vh - 60px)" },

  // ?댁뒋 ?ㅻ퉬寃뚯씠??諛?
  issueBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff",
    border: "1px solid #e8e3da",
    borderRadius: 10,
    padding: "12px 20px",
    marginBottom: 24,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  issueTabs: { display: "flex", gap: 8 },
  issueTab: {
    padding: "8px 22px",
    fontSize: 14,
    fontWeight: 600,
    background: "#f5f3ed",
    color: "#888",
    border: "1px solid #e0dbd0",
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  },
  issueTabActive: {
    background: "#5C6B2E",
    color: "#fff",
    border: "1px solid #5C6B2E",
  },
  issueTabDone: {
    background: "#f0fdf4",
    color: "#16a34a",
    border: "1px solid #bbf7d0",
  },
  checkIcon: { fontSize: 12 },
  verifyBtn: {
    padding: "9px 28px",
    fontSize: 14,
    fontWeight: 700,
    background: "#5C6B2E",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  verifyBtnDisabled: {
    padding: "9px 28px",
    fontSize: 14,
    fontWeight: 700,
    background: "#e8e3da",
    color: "#bbb",
    border: "none",
    borderRadius: 6,
    cursor: "not-allowed",
  },

  // 肄섑뀗痢??곸뿭
  contentArea: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },

  // 醫뚯륫 吏???⑤꼸
  indicatorPanel: {
    width: 160,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  panelLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "0 0 4px 4px",
  },
  indicatorBtn: {
    width: "100%",
    padding: "14px 14px",
    textAlign: "left",
    background: "#fff",
    border: "1px solid #e8e3da",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    position: "relative",
    transition: "all 0.15s",
  },
  indicatorBtnActive: {
    background: "#5C6B2E",
    border: "1px solid #5C6B2E",
  },
  indicatorBtnDone: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
  },
  indicatorLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#aaa",
    letterSpacing: "0.05em",
  },
  indicatorName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1a1a1a",
  },
  indicatorCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    fontSize: 12,
    color: "#16a34a",
    fontWeight: 700,
  },

  // ?곗륫 ?곗씠???⑤꼸
  dataPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 0,
    background: "#fff",
    border: "1px solid #e8e3da",
    borderRadius: 10,
    overflow: "hidden",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },

  // Data ??
  dataTabs: {
    display: "flex",
    borderBottom: "1px solid #e8e3da",
    overflowX: "auto",
  },
  dataTab: {
    flexShrink: 0,
    padding: "12px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    background: "#faf8f4",
    border: "none",
    borderRight: "1px solid #e8e3da",
    cursor: "pointer",
    transition: "all 0.15s",
    minWidth: 120,
  },
  dataTabActive: {
    background: "#fff",
    borderBottom: "2px solid #5C6B2E",
  },
  dataTabDone: {
    background: "#f0fdf4",
  },
  dataCategory: {
    fontSize: 11,
    color: "#aaa",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  dataLabel: {
    fontSize: 13,
    fontWeight: 700,
  },

  // DP ?곸뿭
  dpArea: {
    padding: "24px 28px",
    flex: 1,
  },
  dpHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  dpHeaderLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  dpTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1a1a1a",
  },
  dpSubtitle: {
    fontSize: 12,
    color: "#aaa",
  },
  doneBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: "#16a34a",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 20,
    padding: "4px 12px",
  },

  // ?뚯씠釉?
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
    marginBottom: 24,
  },
  th: {
    background: "#f5f3ed",
    border: "1px solid #e8e3da",
    padding: "10px 16px",
    fontWeight: 600,
    color: "#555",
    textAlign: "left",
    fontSize: 12,
  },
  td: {
    border: "1px solid #eee",
    padding: "12px 16px",
    color: "#333",
    fontSize: 14,
  },
  trEven: { background: "#fff" },
  trOdd: { background: "#fdfcf9" },

  // ?뺤씤 踰꾪듉 ??
  confirmRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  confirmBtn: {
    padding: "9px 32px",
    fontSize: 14,
    fontWeight: 600,
    background: "#5C6B2E",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  confirmedBtn: {
    padding: "9px 32px",
    fontSize: 14,
    fontWeight: 600,
    background: "#f0fdf4",
    color: "#16a34a",
    border: "1px solid #bbf7d0",
    borderRadius: 6,
    cursor: "not-allowed",
  },
};
