import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { getDashboard } from "../api/outliners";
import { getIndicators, getIndicatorDetail } from "../api/standardData";

// API 응답 래퍼
const wrapRes = (data) => ({ data: { data } });
const _getDashboard   = async (params)  => wrapRes((await getDashboard(params))?.data || []);
const _getIndicators  = async (issueId) => wrapRes((await getIndicators(issueId))?.data || []);
const _getIndicatorDetail = async (id)  => wrapRes((await getIndicatorDetail(id))?.data || {});

const MONTHS       = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

const isOkStatus  = (vs) => vs === 1 || vs === 5;
const isTextUnit  = (u)  => (u || "").toLowerCase() === "text";

export default function StandardDataView({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const fyYear = parseInt(sessionStorage.getItem("esgYear") || "2025");
  const selectedIssues = location.state?.issues ?? (() => {
    try { return JSON.parse(sessionStorage.getItem("esgIssues") || "null"); } catch { return null; }
  })();

  const [issueTree, setIssueTree]           = useState([]);
  const [allRows, setAllRows]               = useState([]);
  const [allSites, setAllSites]             = useState([]);
  const [selectedSites, setSelectedSites]   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [activeIssueIdx, setActiveIssueIdx] = useState(0);
  const [activeIndIdx, setActiveIndIdx]     = useState(0);
  const [activeDataIdx, setActiveDataIdx]   = useState(0);

  const siteCheckRef                        = useRef(null);
  const [siteCheckOpen, setSiteCheckOpen]   = useState(false);

  // ── 데이터 로드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const issues = selectedIssues || [];
        const tree   = [];
        for (const issue of issues) {
          const issueId   = issue.id   ?? null;
          const issueName = issue.name ?? String(issue);
          if (!issueId) continue;

          const indRes     = await _getIndicators(issueId);
          const indicators = indRes.data?.data || [];
          const indNodes   = [];
          for (const ind of indicators) {
            const detailRes = await _getIndicatorDetail(ind.id);
            const detail    = detailRes.data?.data || {};
            const dataNodes = (detail.data || []).map(d => ({
              id: d.id, name: d.name,
              dataPoints: (d.data_points || []).map(dp => ({
                id: dp.id, name: dp.name, unit: dp.unit || "-",
              })),
            }));
            indNodes.push({ id: ind.id, name: ind.name, data: dataNodes });
          }
          tree.push({ id: issueId, name: issueName, indicators: indNodes });
        }

        const dashRes = await _getDashboard({ limit: 5000 });
        const rows    = dashRes.data?.data || [];

        setIssueTree(tree);
        setAllRows(rows);
        setAllSites([...new Set(rows.map(r => r.site_id).filter(Boolean))].sort());
      } catch (e) {
        console.error("StandardDataView load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const h = (e) => {
      if (siteCheckRef.current && !siteCheckRef.current.contains(e.target))
        setSiteCheckOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── 사업장 토글 ──────────────────────────────────────────────────────────────
  const toggleSite = (sid) =>
    setSelectedSites(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);

  // ── 파생값 ───────────────────────────────────────────────────────────────────
  const fyRows       = allRows.filter(r => r.reporting_date?.startsWith(String(fyYear)));
  const visibleSites = selectedSites.length === 0 ? allSites : selectedSites;

  // valueMap[metric_name][site_id][MM] = { value, unit }
  const valueMap = {};
  for (const row of fyRows) {
    const mm   = (row.reporting_date || "").slice(5, 7);
    const site = row.site_id    || "";
    const key  = row.metric_name || "";
    if (!key || !mm) continue;
    if (!valueMap[key])       valueMap[key]       = {};
    if (!valueMap[key][site]) valueMap[key][site] = {};
    valueMap[key][site][mm] = { value: row.value, unit: row.unit, v_status: row.v_status };
  }

  // ── 완료 체크 헬퍼 (탭 ✓ 표시용) ─────────────────────────────────────────
  const isDpOk = (dpName) => {
    const siteMap  = valueMap[dpName] || {};
    const allCells = Object.values(siteMap).flatMap(mm => Object.values(mm));
    return allCells.length > 0 && allCells.every(c => isOkStatus(c?.v_status));
  };
  const isDataOk = (dataItem) => {
    const dps = (dataItem.dataPoints || []).filter(dp => !isTextUnit(dp.unit));
    return dps.length > 0 && dps.every(dp => isDpOk(dp.name));
  };
  const isIndOk = (ind) => {
    const validD = ind.data.filter(d => d.dataPoints.some(dp => !isTextUnit(dp.unit)));
    return validD.length > 0 && validD.every(d => isDataOk(d));
  };
  const isIssueOk = (issue) => {
    const validInds = issue.indicators.filter(ind =>
      ind.data.some(d => d.dataPoints.some(dp => !isTextUnit(dp.unit)))
    );
    return validInds.length > 0 && validInds.every(ind => isIndOk(ind));
  };

  // ── loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="standard" />
        <main style={s.main}>
          <div style={{ textAlign: "center", padding: "60px", color: "#888" }}>데이터를 불러오는 중...</div>
        </main>
      </div>
    </div>
  );

  // ── 현재 뷰 파생 ──────────────────────────────────────────────────────────────
  const safeIssueIdx = Math.min(activeIssueIdx, Math.max(0, issueTree.length - 1));
  const currentIssue = issueTree[safeIssueIdx];

  const validIndicators = (currentIssue?.indicators || []).filter(ind =>
    ind.data.some(d => d.dataPoints.some(dp => !isTextUnit(dp.unit)))
  );
  const safeIndIdx  = Math.min(activeIndIdx,  Math.max(0, validIndicators.length - 1));
  const currentInd  = validIndicators[safeIndIdx];

  const validData   = (currentInd?.data || []).filter(d =>
    d.dataPoints.some(dp => !isTextUnit(dp.unit))
  );
  const safeDataIdx = Math.min(activeDataIdx, Math.max(0, validData.length - 1));
  const currentData = validData[safeDataIdx];

  const currentDataPoints = (currentData?.dataPoints || []).filter(dp => !isTextUnit(dp.unit));

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="standard" />
        <main style={s.main}>

          {/* ── 사업장 체크박스 필터 ── */}
          <SiteCheckFilter
            allSites={allSites}
            selectedSites={selectedSites}
            siteCheckRef={siteCheckRef}
            siteCheckOpen={siteCheckOpen}
            setSiteCheckOpen={setSiteCheckOpen}
            toggleSite={toggleSite}
            setSelectedSites={setSelectedSites}
            fyRows={fyRows}
          />

          {/* ── 이슈 탭 바 ── */}
          <div style={s.issueBar}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={s.issueSectionLabel}>이슈</span>
              <div style={s.issueTabs}>
                {issueTree.map((issue, idx) => {
                  const active = idx === safeIssueIdx;
                  const ok     = isIssueOk(issue);
                  return (
                    <button
                      key={issue.id}
                      style={{
                        ...s.issueTab,
                        ...(active ? s.issueTabActive : {}),
                        ...(!active && ok ? s.issueTabFilled : {}),
                      }}
                      onClick={() => { setActiveIssueIdx(idx); setActiveIndIdx(0); setActiveDataIdx(0); }}
                    >
                      {ok && !active && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                      {issue.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              style={s.nextBtn}
              onClick={() => navigate("/outlier-verification", { state: { issues: selectedIssues } })}
            >
              이상치·정합성 검증 시작 →
            </button>
          </div>

          {/* ── 콘텐츠: 좌측 지표 패널 + 우측 데이터 테이블 ── */}
          <div style={s.contentArea}>

            {/* 좌측: 지표 목록 */}
            <div style={s.indicatorPanel}>
              <p style={s.panelLabel}>지표</p>
              {validIndicators.length === 0 ? (
                <div style={{ fontSize: 13, color: "#bbb", padding: "12px 4px" }}>지표 없음</div>
              ) : validIndicators.map((ind, idx) => {
                const active = idx === safeIndIdx;
                const ok     = isIndOk(ind);
                return (
                  <button
                    key={ind.id}
                    style={{
                      ...s.indicatorBtn,
                      ...(active ? s.indicatorBtnActive : {}),
                      ...(!active && ok ? s.indicatorBtnFilled : {}),
                    }}
                    onClick={() => { setActiveIndIdx(idx); setActiveDataIdx(0); }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ ...s.indicatorName, color: active ? "#fff" : ok ? "#16a34a" : "#1a1a1a" }}>
                        {ind.name}
                      </span>
                      {ok && <span style={{ fontSize: 12, color: active ? "#cde8b0" : "#16a34a", fontWeight: 700 }}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 우측: 데이터 탭 + 월별 테이블 */}
            <div style={s.dataPanel}>
              {/* 데이터 탭 */}
              {currentInd && validData.length > 0 && (
                <div style={s.dataTabBar}>
                  {validData.map((d, idx) => {
                    const active = idx === safeDataIdx;
                    const ok     = isDataOk(d);
                    return (
                      <button
                        key={d.id}
                        style={{
                          ...s.dataTab,
                          ...(active ? s.dataTabActive : {}),
                          ...(!active && ok ? s.dataTabFilled : {}),
                        }}
                        onClick={() => setActiveDataIdx(idx)}
                      >
                        {ok && !active && <span style={{ fontSize: 10, marginRight: 3 }}>✓</span>}
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              )}

              {!currentInd || currentDataPoints.length === 0 ? (
                <div style={{ padding: "40px 28px", color: "#bbb", fontSize: 14 }}>
                  데이터포인트가 없습니다.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={{ ...s.th, minWidth: 160 }}>데이터포인트</th>
                        <th style={{ ...s.th, minWidth: 100 }}>사업장</th>
                        <th style={{ ...s.th, minWidth: 60  }}>단위</th>
                        {MONTH_LABELS.map(m => (
                          <th key={m} style={{ ...s.th, minWidth: 70, textAlign: "right" }}>{m}</th>
                        ))}
                        <th style={{ ...s.th, minWidth: 80, textAlign: "right" }}>소계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDataPoints.map((dp, dpIdx) => {
                        const dpSiteMap = valueMap[dp.name] || {};

                        return visibleSites.map((site, sIdx) => {
                          const siteData = dpSiteMap[site] || {};
                          const subtotal = MONTHS.reduce((sum, mm) => {
                            const v = siteData[mm]?.value;
                            return sum + (v != null ? Number(v) : 0);
                          }, 0);
                          const hasAnyData = MONTHS.some(mm => siteData[mm]?.value != null);
                          const rowBg = (dpIdx + sIdx) % 2 === 0 ? "#fff" : "#fdfcf9";

                          return (
                            <tr key={`${dp.id}_${site}`} style={{ background: rowBg }}>

                              {/* 데이터포인트명: 첫 사업장에만 rowspan */}
                              {sIdx === 0 && (
                                <td
                                  style={{ ...s.td, fontWeight: 600, color: "#222", verticalAlign: "middle", borderRight: "2px solid #e8e3da" }}
                                  rowSpan={visibleSites.length}
                                >
                                  {dp.name}
                                </td>
                              )}

                              {/* 사업장 */}
                              <td style={{ ...s.td, background: "#f5f7ee", color: "#5C6B2E", fontWeight: 600, textAlign: "center", fontSize: 12 }}>
                                {site}
                              </td>

                              {/* 단위 */}
                              <td style={{ ...s.td, textAlign: "center", color: "#888", fontSize: 12 }}>
                                {Object.values(siteData)[0]?.unit || dp.unit}
                              </td>

                              {/* 월별 셀 */}
                              {MONTHS.map(mm => {
                                const cell    = siteData[mm];
                                const missing = cell?.value == null;
                                return (
                                  <td
                                    key={mm}
                                    style={{
                                      ...s.td,
                                      textAlign:  "right",
                                      background: missing ? "#f0f0f0" : rowBg,
                                      color:      missing ? "#bbb" : "#1a1a1a",
                                      fontWeight: missing ? 400 : 600,
                                      fontSize:   13,
                                    }}
                                  >
                                    {missing ? "-" : Number(cell.value).toLocaleString()}
                                  </td>
                                );
                              })}

                              {/* 소계 */}
                              <td style={{
                                ...s.td,
                                textAlign:  "right",
                                fontWeight: 700,
                                fontSize:   13,
                                color:      hasAnyData ? "#5C6B2E" : "#bbb",
                                background: hasAnyData ? "#f0fdf4" : "#f0f0f0",
                              }}>
                                {hasAnyData ? subtotal.toLocaleString() : "-"}
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}

// ── 사업장 체크박스 필터 ─────────────────────────────────────────────────────
function SiteCheckFilter({ allSites, selectedSites, siteCheckRef, siteCheckOpen, setSiteCheckOpen, toggleSite, setSelectedSites, fyRows }) {
  if (allSites.length === 0) return null;
  const label = selectedSites.length === 0
    ? `전체 사업장 (${allSites.length})`
    : selectedSites.length === 1
      ? selectedSites[0]
      : `${selectedSites.length}개 사업장 선택됨`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: "#fff", border: "1px solid #e8e3da", borderRadius: 10, padding: "10px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#555", whiteSpace: "nowrap" }}>사업장 필터</span>
      <div ref={siteCheckRef} style={{ position: "relative" }}>
        <button style={sf.toggleBtn} onClick={() => setSiteCheckOpen(p => !p)}>
          <span style={{ flex: 1, textAlign: "left", color: selectedSites.length > 0 ? "#5C6B2E" : "#555" }}>{label}</span>
          {selectedSites.length > 0 && <span style={sf.badge}>{selectedSites.length}</span>}
          <span style={{ fontSize: 10, color: "#aaa", marginLeft: 6 }}>{siteCheckOpen ? "▲" : "▼"}</span>
        </button>
        {siteCheckOpen && (
          <div style={sf.panel}>
            <div style={sf.panelHeader}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>사업장 선택</span>
              {selectedSites.length > 0 && (
                <button style={sf.clearBtn} onClick={() => setSelectedSites([])}>전체 해제</button>
              )}
            </div>
            {allSites.map(sid => {
              const checked  = selectedSites.includes(sid);
              const rowCount = fyRows.filter(r => r.site_id === sid).length;
              return (
                <button key={sid} style={{ ...sf.item, ...(checked ? sf.itemActive : {}) }} onClick={() => toggleSite(sid)}>
                  <div style={sf.checkBox(checked)}>
                    {checked && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: checked ? "#5C6B2E" : "#333" }}>{sid}</span>
                  <span style={{ fontSize: 11, color: "#aaa" }}>{rowCount}건</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const s = {
  root: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f8f7f4" },
  body: { display: "flex", flex: 1 },
  main: { flex: 1, padding: "28px 32px", overflowX: "hidden" },

  issueBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 20, background: "#fff",
    border: "1px solid #e8e3da", borderRadius: 12,
    padding: "12px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  issueSectionLabel: {
    fontSize: 12, fontWeight: 700, color: "#888",
    background: "#f1f5f9", padding: "3px 10px", borderRadius: 6,
    letterSpacing: "0.05em", whiteSpace: "nowrap",
  },
  issueTabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  issueTab: {
    padding: "7px 18px", borderRadius: 20,
    border: "1.5px solid #e8e3da", background: "#fff",
    color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  },
  issueTabActive: { background: "#3D6B2C", color: "#fff", border: "1.5px solid #3D6B2C" },
  issueTabFilled: { background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0" },

  nextBtn: {
    padding: "9px 22px", borderRadius: 10,
    background: "#3D6B2C", color: "#fff",
    border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
    whiteSpace: "nowrap",
  },

  contentArea: { display: "flex", gap: 20, alignItems: "flex-start" },

  indicatorPanel: {
    width: 200, minWidth: 180, flexShrink: 0,
    background: "#fff", border: "1px solid #e8e3da", borderRadius: 12,
    padding: "16px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  panelLabel: { fontSize: 11, fontWeight: 700, color: "#888", margin: "0 0 10px", letterSpacing: "0.05em" },
  indicatorBtn: {
    width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8,
    border: "none", background: "transparent", cursor: "pointer",
    marginBottom: 3, transition: "all 0.15s",
  },
  indicatorBtnActive: { background: "#3D6B2C" },
  indicatorBtnFilled: { background: "#f0fdf4", border: "1px solid #bbf7d0" },
  indicatorName: { fontSize: 13, fontWeight: 600, lineHeight: 1.4 },

  dataPanel: {
    flex: 1, background: "#fff", border: "1px solid #e8e3da",
    borderRadius: 12, padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  dataTabBar: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  dataTab: {
    padding: "6px 16px", borderRadius: 8,
    border: "1.5px solid #e8e3da", background: "#f8f7f4",
    color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  dataTabActive: { background: "#3D6B2C", color: "#fff", border: "1.5px solid #3D6B2C" },
  dataTabFilled: { background: "#f0fdf4", color: "#16a34a", border: "1.5px solid #bbf7d0" },

  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    background: "#f5f7ee", color: "#5C6B2E", fontWeight: 700,
    padding: "10px 10px", borderBottom: "2px solid #e8e3da",
    textAlign: "left", whiteSpace: "nowrap",
  },
  td: { padding: "8px 10px", borderBottom: "1px solid #f0ece4", whiteSpace: "nowrap" },
};

const sf = {
  toggleBtn: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 14px", borderRadius: 8, minWidth: 200,
    border: "1.5px solid #e8e3da", background: "#fff",
    cursor: "pointer", fontSize: 13,
  },
  badge: {
    background: "#3D6B2C", color: "#fff",
    fontSize: 11, fontWeight: 700,
    padding: "1px 7px", borderRadius: 10,
  },
  panel: {
    position: "absolute", top: "calc(100% + 6px)", left: 0,
    background: "#fff", border: "1.5px solid #e8e3da",
    borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
    zIndex: 200, minWidth: 220, overflow: "hidden",
  },
  panelHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 14px 6px", borderBottom: "1px solid #f0ece4",
  },
  clearBtn: {
    fontSize: 11, color: "#dc2626", background: "none",
    border: "none", cursor: "pointer", fontWeight: 600,
  },
  item: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "9px 14px",
    border: "none", background: "transparent", cursor: "pointer",
    transition: "background 0.12s",
  },
  itemActive: { background: "#f0fdf4" },
  checkBox: (checked) => ({
    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: checked ? "#3D6B2C" : "#fff",
    border: `1.5px solid ${checked ? "#3D6B2C" : "#d1d5db"}`,
  }),
};
