import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

// ─── 더미 데이터 ─────────────────────────────────────────────────────
const ISSUES = [
  {
    id: 1,
    name: "ISSUE ①",
    indicators: [
      {
        id: 101,
        name: "온실가스 배출량",
        data: [
          {
            id: 1001,
            label: "Data1",
            category: "에너지원별 사용량",
            dps: [
              { id: 1, name: "Scope 1 직접배출량", unit: "tCO₂e", value: "1,245.6", period: "2023" },
              { id: 2, name: "Scope 2 간접배출량 (전력)", unit: "tCO₂e", value: "892.3", period: "2023" },
              { id: 3, name: "Scope 2 간접배출량 (열·스팀)", unit: "tCO₂e", value: "134.7", period: "2023" },
              { id: 4, name: "Scope 3 기타 간접배출량", unit: "tCO₂e", value: "3,012.1", period: "2023" },
            ],
          },
          {
            id: 1002,
            label: "Data2",
            category: "폐기물 반출량",
            dps: [
              { id: 5, name: "일반폐기물 반출량", unit: "톤", value: "1,234.0", period: "2023" },
              { id: 6, name: "지정폐기물 반출량", unit: "톤", value: "87.5", period: "2023" },
              { id: 7, name: "재활용 폐기물량", unit: "톤", value: "456.2", period: "2023" },
            ],
          },
          {
            id: 1003,
            label: "Data3",
            category: "약품 사용량",
            dps: [
              { id: 8, name: "유해화학물질 사용량", unit: "톤", value: "23.4", period: "2023" },
              { id: 9, name: "일반화학물질 사용량", unit: "톤", value: "156.8", period: "2023" },
            ],
          },
          {
            id: 1004,
            label: "Data4",
            category: "오염 물질 배출량",
            dps: [
              { id: 10, name: "대기오염물질 배출량 (NOx)", unit: "톤", value: "12.3", period: "2023" },
              { id: 11, name: "대기오염물질 배출량 (SOx)", unit: "톤", value: "4.7", period: "2023" },
              { id: 12, name: "수질오염물질 배출량 (BOD)", unit: "톤", value: "0.89", period: "2023" },
            ],
          },
        ],
      },
      {
        id: 102,
        name: "에너지",
        data: [
          {
            id: 2001,
            label: "Data1",
            category: "에너지 소비량",
            dps: [
              { id: 13, name: "총 에너지 소비량", unit: "GJ", value: "45,678.9", period: "2023" },
              { id: 14, name: "재생에너지 사용량", unit: "GJ", value: "3,210.0", period: "2023" },
              { id: 15, name: "에너지 집약도", unit: "GJ/억원", value: "12.4", period: "2023" },
            ],
          },
          {
            id: 2002,
            label: "Data2",
            category: "전력 소비량",
            dps: [
              { id: 16, name: "총 전력 소비량", unit: "MWh", value: "28,450.0", period: "2023" },
              { id: 17, name: "자가 발전량", unit: "MWh", value: "1,200.0", period: "2023" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 2,
    name: "ISSUE ②",
    indicators: [
      {
        id: 201,
        name: "용수",
        data: [
          {
            id: 3001,
            label: "Data1",
            category: "용수 사용량",
            dps: [
              { id: 18, name: "총 용수 취수량", unit: "톤", value: "89,234.0", period: "2023" },
              { id: 19, name: "상수도 사용량", unit: "톤", value: "45,600.0", period: "2023" },
              { id: 20, name: "지하수 사용량", unit: "톤", value: "43,634.0", period: "2023" },
            ],
          },
          {
            id: 3002,
            label: "Data2",
            category: "용수 재사용량",
            dps: [
              { id: 21, name: "재이용수량", unit: "톤", value: "12,340.0", period: "2023" },
              { id: 22, name: "재이용률", unit: "%", value: "13.8", period: "2023" },
            ],
          },
        ],
      },
      {
        id: 202,
        name: "사회",
        data: [
          {
            id: 4001,
            label: "Data1",
            category: "임직원 현황",
            dps: [
              { id: 23, name: "총 임직원 수", unit: "명", value: "3,456", period: "2023" },
              { id: 24, name: "여성 임직원 비율", unit: "%", value: "28.4", period: "2023" },
              { id: 25, name: "신규 채용 인원", unit: "명", value: "234", period: "2023" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 3,
    name: "ISSUE ③",
    indicators: [
      {
        id: 301,
        name: "안전보건",
        data: [
          {
            id: 5001,
            label: "Data1",
            category: "산업재해 현황",
            dps: [
              { id: 26, name: "산업재해율", unit: "%", value: "0.12", period: "2023" },
              { id: 27, name: "재해자 수", unit: "명", value: "4", period: "2023" },
              { id: 28, name: "근로손실일수", unit: "일", value: "45", period: "2023" },
            ],
          },
        ],
      },
    ],
  },
];

export default function StandardDataView({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const [activeIssueIdx, setActiveIssueIdx] = useState(0);
  const [activeIndicatorIdx, setActiveIndicatorIdx] = useState(0);
  const [activeDataIdx, setActiveDataIdx] = useState(0);
  const [confirmedData, setConfirmedData] = useState(new Set());

  const currentIssue = ISSUES[activeIssueIdx];
  const currentIndicator = currentIssue.indicators[activeIndicatorIdx];
  const currentData = currentIndicator.data[activeDataIdx];

  // 완료 여부 계산
  const isDataDone = (dataId) => confirmedData.has(dataId);
  const isIndicatorDone = (indicator) => indicator.data.every((d) => isDataDone(d.id));
  const isIssueDone = (issue) => issue.indicators.every((i) => isIndicatorDone(i));
  const allDone = ISSUES.every((issue) => isIssueDone(issue));

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
    setConfirmedData((prev) => new Set([...prev, currentData.id]));
  };

  const isCurrentDataDone = isDataDone(currentData.id);

  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar />
        <main style={s.main}>

          {/* ── 이슈 네비게이션 바 ── */}
          <div style={s.issueBar}>
            <div style={s.issueTabs}>
              {ISSUES.map((issue, idx) => {
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

          {/* ── 콘텐츠 영역 ── */}
          <div style={s.contentArea}>

            {/* 좌측: 지표 리스트 */}
            <div style={s.indicatorPanel}>
              <p style={s.panelLabel}>지표</p>
              {currentIssue.indicators.map((indicator, idx) => {
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
                {currentIndicator.data.map((data, idx) => {
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
              </div>

              {/* DP 테이블 */}
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

                {/* 하단: 확인 버튼 */}
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
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

// ─── 스타일 ─────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: "100vh",
    background: "#FAF8F0",
    fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
  },
  body: { display: "flex" },
  main: { flex: 1, padding: "32px 40px", minHeight: "calc(100vh - 60px)" },

  // 이슈 네비게이션 바
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

  // 콘텐츠 영역
  contentArea: {
    display: "flex",
    gap: 16,
    alignItems: "flex-start",
  },

  // 좌측 지표 패널
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

  // 우측 데이터 패널
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

  // Data 탭
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

  // DP 영역
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

  // 테이블
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

  // 확인 버튼 행
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