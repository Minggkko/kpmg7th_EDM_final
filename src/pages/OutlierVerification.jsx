import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import {
  getDashboard,
  getIndicators,
  getIndicatorDetail,
  submitJustification,
  sendConfirmRequest,
  finalizeData,
  getSites,
  
} from "../api";

// ── v_status별 케이스 정의 ─────────────────────────────────────────────────────
// 2: 이상치 없음 + 증빙 불일치  → 확인 요청 (이메일 + due_date)
// 3: 이상치 있음 + 증빙 일치    → 소명 (원인 설명, 데이터 수정 불가)
// 4: 이상치 있음 + 증빙 불일치  → 긴급 조치 (소명 + 확인 요청 탭)
const CASE_CONFIG = {
  2: { label: "검토 필요",  badge: "⚠",  color: "#d97706", bg: "#fffbeb", desc: "이상치 없음 · 증빙 불일치",  modal: "confirm" },
  3: { label: "소명 필요",  badge: "⚠",  color: "#9333ea", bg: "#faf5ff", desc: "이상치 있음 · 증빙 일치",    modal: "justify" },
  4: { label: "긴급 조치",  badge: "🚨", color: "#dc2626", bg: "#fef2f2", desc: "이상치 있음 · 증빙 불일치",  modal: "both"    },
};

const MONTHS       = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

// v_status 판단
const isOutlierStatus = (vs) => vs === 2 || vs === 3 || vs === 4;
const isOkStatus      = (vs) => vs === 1 || vs === 5;
const isTextUnit      = (u)  => (u || "").toLowerCase() === "text";

export default function OutlierVerification({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const fyYear = parseInt(sessionStorage.getItem("esgYear") || "2025");
  const selectedIssues = location.state?.issues ?? (() => {
    try { return JSON.parse(sessionStorage.getItem("esgIssues") || "null"); } catch { return null; }
  })();

  // ── state ────────────────────────────────────────────────────────────────────
  const [issueTree, setIssueTree]         = useState([]);
  const [allRows, setAllRows]             = useState([]);
  const [allSites, setAllSites]           = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeIssueIdx, setActiveIssueIdx] = useState(0);
  const [activeIndIdx, setActiveIndIdx]     = useState(0);
  const [activeDataIdx, setActiveDataIdx]   = useState(0);

  const siteCheckRef                      = useRef(null);
  const [siteCheckOpen, setSiteCheckOpen] = useState(false);

  // 전체 확정 완료 팝업
  const [allConfirmedModal, setAllConfirmedModal] = useState(false);
  const prevAllOkRef = useRef(false);

  // 모달
  const [modal, setModal]               = useState(null);   // cell 정보
  // "none"=소명만, "수정"=정정폼, "요청"=이메일폼
  const [modalMode, setModalMode]       = useState("none");
  const [correctedValue, setCorrectedValue] = useState("");  // 정정값 입력
  const [reason, setReason]             = useState("");       // 이유 (공통)
  const [confirmForm, setConfirmForm]   = useState({ assignee_email: "", due_date: "", message: "" });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalMsg, setModalMsg]         = useState("");

  // ── 데이터 로드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const sitesRes   = await getSites();
        const masterSites = sitesRes.data?.data || [];

        const issues = selectedIssues || [];
        const tree   = [];
        for (const issue of issues) {
          const issueId   = issue.id   ?? null;
          const issueName = issue.name ?? String(issue);
          if (!issueId) continue;

          const indRes     = await getIndicators(issueId);
          const indicators = indRes.data?.data || [];
          const indNodes   = [];
          for (const ind of indicators) {
            const detailRes = await getIndicatorDetail(ind.id);
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

        // 전체 v_status 조회 (이상치 포함)
        const dashRes = await getDashboard({ limit: 5000 });
        const rows    = dashRes.data?.data || [];

        // v_status=4 레코드가 있으면 자동 현행 확정
        const hasV4 = rows.some(r => r.v_status === 4);
        if (hasV4) {
          try {
            await autoFinalizeV4();
            // 재조회
            const refreshed = await getDashboard({ limit: 5000 });
            const updatedRows = refreshed.data?.data || [];
            setIssueTree(tree);
            setAllRows(updatedRows);
            if (masterSites.length > 0) {
              setAllSites(masterSites);
            } else {
              setAllSites([...new Set(updatedRows.map(r => r.site_id).filter(Boolean))].sort());
            }
            return;
          } catch (e) {
            console.warn("auto-finalize-v4 실패:", e);
          }
        }

        setIssueTree(tree);
        setAllRows(rows);
        if (masterSites.length > 0) {
          setAllSites(masterSites);
        } else {
          setAllSites([...new Set(rows.map(r => r.site_id).filter(Boolean))].sort());
        }
      } catch (e) {
        console.error("OutlierVerification load error:", e);
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

  // ── 데이터 재로드 ────────────────────────────────────────────────────────────
  const reloadRows = async () => {
    const dashRes = await getDashboard({ limit: 5000 });
    const rows    = dashRes.data?.data || [];
    setAllRows(rows);
    if (allSites.length === 0) {
      setAllSites([...new Set(rows.map(r => r.site_id).filter(Boolean))].sort());
    }
  };

  // ── 사업장 토글 ──────────────────────────────────────────────────────────────
  const toggleSite = (sid) =>
    setSelectedSites(prev => prev.includes(sid) ? prev.filter(s => s !== sid) : [...prev, sid]);

  // ── 파생값 ───────────────────────────────────────────────────────────────────
  const fyRows       = allRows.filter(r => r.reporting_date?.startsWith(String(fyYear)));
  const visibleSites = selectedSites.length === 0 ? allSites : selectedSites;

  // valueMap[metric_name][site_id][MM] = { value, unit, v_status, id, outlier_id, severity, ai_diagnosis }
  const valueMap = {};
  for (const row of fyRows) {
    const mm   = (row.reporting_date || "").slice(5, 7);
    const site = row.site_id    || "";
    const key  = row.metric_name || "";
    if (!key || !mm) continue;
    if (!valueMap[key])        valueMap[key]        = {};
    if (!valueMap[key][site])  valueMap[key][site]  = {};
    valueMap[key][site][mm] = {
      value:        row.value,
      unit:         row.unit,
      v_status:     row.v_status,
      id:           row.id,
      outlier_id:   row.outlier_id,
      severity:     row.severity,
      ai_diagnosis: row.ai_diagnosis,
      ocr_value:    row.ocr_value,
    };
  }

  // ── 완료/이상 체크 헬퍼 ──────────────────────────────────────────────────────
  // 데이터포인트 상태: 이상치(2,3,4) 있으면 "검토필요", 없으면 "이상없음"
  const getDpStatus = (dpName) => {
    const siteMap = valueMap[dpName] || {};
    for (const monthMap of Object.values(siteMap))
      for (const cell of Object.values(monthMap))
        if (isOutlierStatus(cell?.v_status)) return "검토필요";
    return "이상없음";
  };

  // 데이터포인트 완료: 모든 셀이 OK (1 또는 5)
  const isDpOk = (dpName) => {
    const siteMap  = valueMap[dpName] || {};
    const allCells = Object.values(siteMap).flatMap(mm => Object.values(mm));
    return allCells.length > 0 && allCells.every(c => isOkStatus(c?.v_status));
  };

  // 데이터탭 완료
  const isDataOk = (dataItem) => {
    const dps = (dataItem.dataPoints || []).filter(dp => !isTextUnit(dp.unit));
    return dps.length > 0 && dps.every(dp => isDpOk(dp.name));
  };

  // 지표 완료
  const isIndOk = (ind) => {
    const validD = ind.data.filter(d => d.dataPoints.some(dp => !isTextUnit(dp.unit)));
    return validD.length > 0 && validD.every(d => isDataOk(d));
  };

  // 이슈 완료
  const isIssueOk = (issue) => {
    const validInds = issue.indicators.filter(ind =>
      ind.data.some(d => d.dataPoints.some(dp => !isTextUnit(dp.unit)))
    );
    return validInds.length > 0 && validInds.every(ind => isIndOk(ind));
  };

  // allOk: 전체 이슈 완료 여부 (isIssueOk 정의 이후에 배치)
  const allOk = issueTree.length > 0 && issueTree.every(issue => isIssueOk(issue));

  // allOk 전환 시 완료 팝업 표시
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loading && allOk && !prevAllOkRef.current) {
      setAllConfirmedModal(true);
    }
    prevAllOkRef.current = allOk;
  }, [allOk, loading]);

  // ── 모달 열기 ────────────────────────────────────────────────────────────────
  const openModal = (cell) => {
    setModal(cell);
    setModalMode("현행");
    setCorrectedValue("");
    setReason("");
    setConfirmForm({ assignee_email: "", due_date: "", message: "" });
    setModalMsg("");
  };

  // ── 확인 버튼 처리 (소명 or 정정) ────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!modal) return;
    setModalLoading(true);
    setModalMsg("");
    try {
      if (modalMode === "수정") {
        // 수정 후 확정: finalizeData → v_status=5, audit_trail 기록
        const newVal = parseFloat(correctedValue);
        if (isNaN(newVal)) { setModalMsg("✗ 유효한 수정값을 입력하세요."); setModalLoading(false); return; }
        if (!reason.trim()) { setModalMsg("✗ 이유를 입력하세요."); setModalLoading(false); return; }
        await finalizeData(modal.stdId, newVal, reason);
        setModalMsg("✓ 수정 후 최종 확정 완료 (v_status → 5)");
      } else {
        // 현행 확정: submitJustification → v_status=5, justification_logs 기록
        if (!reason.trim()) { setModalMsg("✗ 소명 이유를 입력하세요."); setModalLoading(false); return; }
        await submitJustification(modal.stdId, {
          user_feedback:      reason,
          action_taken:       "정상",
          justification_type: "소명",
          outlier_id:         modal.outlier_id,
        });
        setModalMsg("✓ 현행 확정 완료 (v_status → 5)");
      }
      await reloadRows();
      setTimeout(() => { setModal(null); setModalMsg(""); }, 1500);
    } catch (err) {
      setModalMsg("✗ 처리 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setModalLoading(false);
    }
  };

  // ── 확인 요청 제출 (이메일) ────────────────────────────────────────────────
  const handleConfirmRequest = async () => {
    if (!modal) return;
    if (!confirmForm.assignee_email) { setModalMsg("✗ 이메일 주소를 입력하세요."); return; }
    if (!confirmForm.due_date)       { setModalMsg("✗ 처리 기한을 입력하세요."); return; }
    setModalLoading(true);
    setModalMsg("");
    try {
      const res = await sendConfirmRequest(modal.stdId, {
        assignee_email: confirmForm.assignee_email,
        due_date:       confirmForm.due_date,
        message:        confirmForm.message,
        outlier_id:     modal.outlier_id,
        dp_name:        modal.dpName,
        site:           modal.site,
        reporting_date: `${modal.year}-${modal.month}`,
        value:          modal.value,
        unit:           modal.unit,
        v_status:       modal.v_status,
        ai_diagnosis:   modal.ai_diagnosis,
        ocr_value:      modal.ocr_value,
      });
      const emailOk = res.data?.email_sent;
      setModalMsg(emailOk
        ? `✓ 확인 요청 완료 (이메일 발송: ${confirmForm.assignee_email})`
        : "✓ 확인 요청 기록 완료 (이메일 미발송 — SMTP 미설정)"
      );
      await reloadRows();
      setTimeout(() => { setModal(null); setModalMsg(""); }, 2000);
    } catch (err) {
      setModalMsg("✗ 처리 실패: " + (err.response?.data?.detail || err.message));
    } finally {
      setModalLoading(false);
    }
  };

  // ── loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="outlier" />
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
        <Sidebar currentStep="outlier" />
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
              style={{ ...s.nextBtn, ...(!allOk ? s.nextBtnDisabled : {}) }}
              onClick={() => navigate("/report-generate")}
              disabled={!allOk}
              title={!allOk ? "모든 이상치가 처리되어야 다음 단계로 이동합니다" : ""}
            >
              보고서 생성 →
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
                        <th style={{ ...s.th, minWidth: 80  }}>상태</th>
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
                        const dpStatus  = getDpStatus(dp.name);
                        const isIssue   = dpStatus === "검토필요";

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

                              {/* 상태 칼럼: 첫 사업장에만 rowspan */}
                              {sIdx === 0 && (
                                <td
                                  style={{
                                    ...s.td,
                                    textAlign:      "center",
                                    fontWeight:     700,
                                    fontSize:       12,
                                    verticalAlign:  "middle",
                                    borderRight:    "2px solid #e8e3da",
                                    color:      isIssue ? "#dc2626" : "#16a34a",
                                    background: isIssue ? "#fff1f1" : "#f0fdf4",
                                  }}
                                  rowSpan={visibleSites.length}
                                >
                                  {isIssue ? "검토필요" : "이상없음"}
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
                                const outlier = !missing && isOutlierStatus(cell?.v_status);
                                const ok      = !missing && isOkStatus(cell?.v_status);

                                return (
                                  <td
                                    key={mm}
                                    title={outlier ? `[${CASE_CONFIG[cell.v_status]?.label || ""}] 클릭하여 처리` : ""}
                                    onClick={outlier ? () => openModal({
                                      stdId:        cell.id,
                                      dpName:       dp.name,
                                      site,
                                      month:        mm,
                                      year:         fyYear,
                                      value:        cell.value,
                                      unit:         cell.unit || dp.unit,
                                      v_status:     cell.v_status,
                                      outlier_id:   cell.outlier_id,
                                      severity:     cell.severity,
                                      ai_diagnosis: cell.ai_diagnosis,
                                      ocr_value:    cell.ocr_value,
                                    }) : undefined}
                                    style={{
                                      ...s.td,
                                      textAlign:  "right",
                                      cursor:     outlier ? "pointer" : "default",
                                      background: missing           ? "#f0f0f0"
                                                : cell?.v_status === 2 ? "#fffbeb"  // 검토필요 (노랑)
                                                : cell?.v_status === 3 ? "#faf5ff"  // 소명필요 (보라)
                                                : cell?.v_status === 4 ? "#fef2f2"  // 긴급 (빨강)
                                                : ok && cell?.v_status === 5 ? "#f0fdf4" // 확정 (초록)
                                                : rowBg,
                                      color:      missing           ? "#bbb"
                                                : cell?.v_status === 2 ? "#d97706"
                                                : cell?.v_status === 3 ? "#9333ea"
                                                : cell?.v_status === 4 ? "#dc2626"
                                                : "#1a1a1a",
                                      fontWeight: missing ? 400 : 600,
                                      fontSize:   13,
                                      border: cell?.v_status === 2 ? "1.5px solid #fde68a"
                                            : cell?.v_status === 3 ? "1.5px solid #d8b4fe"
                                            : cell?.v_status === 4 ? "1.5px solid #fca5a5"
                                            : undefined,
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

          {/* ── 전체 확정 완료 팝업 ── */}
          {allConfirmedModal && (
            <div style={s.overlay} onClick={() => setAllConfirmedModal(false)}>
              <div style={{ ...s.modal, width: 380, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "36px 32px 28px" }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>
                    모든 데이터가 확정되었습니다.
                  </div>
                  <div style={{ fontSize: 13, color: "#888", marginBottom: 28, lineHeight: 1.6 }}>
                    모든 이상치 항목이 처리되어 v_status=5(최종 확정) 상태입니다.<br />
                    보고서 생성 단계로 이동할 수 있습니다.
                  </div>
                  <button
                    style={{ ...s.submitBtn, width: "100%", padding: "12px 0", fontSize: 14 }}
                    onClick={() => setAllConfirmedModal(false)}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 소명 / 정정 / 확인 요청 모달 ── */}
          {modal && (() => {
            const cfg      = CASE_CONFIG[modal.v_status] || CASE_CONFIG[3];
            const canEdit  = modal.v_status !== 3; // v_status=3은 데이터 수정 불가
            const diff     = (modalMode === "수정" && correctedValue !== "")
                               ? (parseFloat(correctedValue) || 0) - Number(modal.value)
                               : null;

            return (
              <div style={s.overlay} onClick={() => setModal(null)}>
                <div style={s.modal} onClick={e => e.stopPropagation()}>

                  {/* ── 헤더 ── */}
                  <div style={s.modalHeader}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={s.modalTitle}>{cfg.badge} {cfg.label}</span>
                      <span style={{ fontSize: 12, color: cfg.color }}>{cfg.desc}</span>
                    </div>
                    <button style={s.modalClose} onClick={() => setModal(null)}>✕</button>
                  </div>

                  {/* ── 본문 ── */}
                  <div style={s.modalBody}>

                    {/* ─ 기본 정보 행 ─ */}
                    <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
                      {[
                        ["데이터포인트", modal.dpName],
                        ["사업장", modal.site],
                        ["보고월", `${modal.month}월`],
                      ].map(([lbl, val]) => (
                        <div key={lbl}>
                          <span style={s.infoLabel}>{lbl}</span>
                          <span style={{ ...s.infoVal, marginLeft: 6 }}>{val}</span>
                        </div>
                      ))}
                    </div>

                    {/* ─ 이상치 추론 (LLM) 내역 ─ */}
                    <div style={s.llmBox}>
                      <div style={s.llmTitle}>이상치 추론 (LLM) 내역</div>
                      {modal.ai_diagnosis ? (() => {
                        try {
                          const d = JSON.parse(modal.ai_diagnosis);
                          return (
                            <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                              {d["위험_등급"] && (
                                <span style={{ fontWeight: 700, color: cfg.color, marginRight: 8 }}>
                                  [{d["위험_등급"]}]
                                </span>
                              )}
                              {d["진단_요약"] && <span style={{ fontWeight: 600 }}>{d["진단_요약"]}</span>}
                              {d["판단_근거_및_해설"] && (
                                <div style={{ color: "#555", marginTop: 4, fontSize: 12 }}>
                                  {d["판단_근거_및_해설"]}
                                </div>
                              )}
                            </div>
                          );
                        } catch {
                          return <span style={{ fontSize: 13, color: "#374151" }}>{modal.ai_diagnosis}</span>;
                        }
                      })() : (
                        <span style={{ fontSize: 13, color: "#9ca3af" }}>
                          {modal.v_status === 2
                            ? "이상치 탐지 없음 — OCR 증빙 불일치 항목 (수동 확인 필요)"
                            : "AI 진단 결과 없음 — 파이프라인 재실행 필요"}
                        </span>
                      )}

                    </div>

                    {/* ─ 처리 방식 선택 (3-버튼) ─ */}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      {[
                        { key: "현행", label: "현행 확정",   disabled: false,              desc: "값 그대로 확정 (소명 입력)" },
                        { key: "수정", label: "수정 후 확정", disabled: !canEdit,           desc: canEdit ? "값 변경 후 확정" : "이상치=증빙 일치 → 수정 불가" },
                        { key: "요청", label: "확인 요청",   disabled: false,              desc: "담당자에게 이메일 요청" },
                      ].map(({ key, label, disabled, desc }) => (
                        <button
                          key={key}
                          disabled={disabled}
                          title={desc}
                          style={{
                            ...s.modeBtn,
                            ...(modalMode === key  ? s.modeBtnActive   : {}),
                            ...(disabled           ? s.modeBtnDisabled : {}),
                          }}
                          onClick={() => !disabled && setModalMode(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* ─ 정정 테이블 (수정 모드) ─ */}
                    {modalMode === "수정" && (
                      <div style={{ marginTop: 12 }}>
                        {modal.v_status === 3 && (
                          <div style={s.warningBox}>데이터 수정 불가 — 이상치가 증빙과 일치하므로 소명만 가능합니다.</div>
                        )}
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                          <thead>
                            <tr>
                              {["이전값", "수정값", "차이값"].map(h => (
                                <th key={h} style={s.corrTh}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={s.corrTd}>
                                {Number(modal.value).toLocaleString()}
                                <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>{modal.unit}</span>
                              </td>
                              <td style={s.corrTd}>
                                <input
                                  type="number"
                                  style={s.corrInput}
                                  placeholder="[입력]"
                                  value={correctedValue}
                                  onChange={e => setCorrectedValue(e.target.value)}
                                />
                              </td>
                              <td style={{ ...s.corrTd, color: diff === null ? "#bbb" : diff > 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                                {diff === null ? "-" : `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {modal.ocr_value != null && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                            <span style={{ fontSize: 12, color: "#d97706" }}>
                              OCR 증빙값: <strong>{Number(modal.ocr_value).toLocaleString()} {modal.unit}</strong>
                            </span>
                            <button
                              style={s.ocrFillBtn}
                              onClick={() => setCorrectedValue(String(modal.ocr_value))}
                            >
                              OCR값으로 채우기
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─ 확인 요청 폼 (요청 모드) ─ */}
                    {modalMode === "요청" && (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        {modal.v_status === 2 && (
                          <div style={s.warningBox}>
                            DB 입력값({Number(modal.value).toLocaleString()})과 OCR 증빙값이 다릅니다.
                            담당자에게 정확한 값 확인을 요청하세요.
                          </div>
                        )}
                        <div>
                          <div style={s.infoLabel}>담당자 이메일 <span style={{ color: "#dc2626" }}>*</span></div>
                          <input type="email" style={s.inputField}
                            placeholder="example@company.com"
                            value={confirmForm.assignee_email}
                            onChange={e => setConfirmForm(f => ({ ...f, assignee_email: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div style={s.infoLabel}>처리 기한 <span style={{ color: "#dc2626" }}>*</span></div>
                          <input type="date" style={s.inputField}
                            value={confirmForm.due_date}
                            onChange={e => setConfirmForm(f => ({ ...f, due_date: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div style={s.infoLabel}>요청 메시지</div>
                          <textarea style={s.textarea} rows={2}
                            placeholder="확인 요청 내용을 입력하세요..."
                            value={confirmForm.message}
                            onChange={e => setConfirmForm(f => ({ ...f, message: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}

                    {/* ─ 이유 (현행확정/수정 공통, 확인 요청 모드에서는 숨김) ─ */}
                    {(modalMode === "현행" || modalMode === "수정") && (
                      <div style={{ marginTop: 14 }}>
                        <div style={s.infoLabel}>이유</div>
                        <textarea
                          style={s.textarea}
                          placeholder={
                            modalMode === "수정"
                              ? "정정 사유를 입력하세요 (단위 오기입, 입력 오류 등)"
                              : "소명 내용을 입력하세요 (현행값이 정확한 이유, 특수 상황 등)"
                          }
                          value={reason}
                          onChange={e => setReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                    )}

                    {/* 결과 메시지 */}
                    {modalMsg && (
                      <div style={{
                        marginTop: 10, fontSize: 13, fontWeight: 600,
                        color: modalMsg.startsWith("✓") ? "#16a34a" : "#dc2626",
                      }}>
                        {modalMsg}
                      </div>
                    )}
                  </div>

                  {/* ── 푸터 ── */}
                  <div style={s.modalFooter}>
                    <button style={s.cancelBtn} onClick={() => setModal(null)}>취소</button>
                    {modalMode === "요청" ? (
                      <button
                        style={{ ...s.submitBtn, background: "#d97706", ...(modalLoading ? s.submitBtnDisabled : {}) }}
                        onClick={handleConfirmRequest}
                        disabled={modalLoading}
                      >
                        {modalLoading ? "처리 중..." : "확인 요청 발송"}
                      </button>
                    ) : modalMode === "수정" ? (
                      <button
                        style={{ ...s.submitBtn, background: "#1e40af", ...(modalLoading ? s.submitBtnDisabled : {}) }}
                        onClick={handleConfirm}
                        disabled={modalLoading}
                      >
                        {modalLoading ? "처리 중..." : "수정 후 확정"}
                      </button>
                    ) : (
                      <button
                        style={{ ...s.submitBtn, ...(modalLoading ? s.submitBtnDisabled : {}) }}
                        onClick={handleConfirm}
                        disabled={modalLoading}
                      >
                        {modalLoading ? "처리 중..." : "현행 확정"}
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })()}

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
  issueTabs:     { display: "flex", gap: 8, flexWrap: "wrap" },
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
  nextBtnDisabled: {
    background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed",
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

  // 탭 바 (v_status=4 긴급조치용)
  tabBar: {
    display: "flex", gap: 0,
    borderBottom: "2px solid #e5e7eb",
    padding: "0 24px",
    background: "#f9fafb",
  },
  tabBtn: {
    padding: "10px 20px", border: "none", background: "transparent",
    fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#9ca3af",
    borderBottom: "2px solid transparent", marginBottom: -2,
  },
  tabBtnActive: { color: "#3D6B2C", borderBottomColor: "#3D6B2C" },

  warningBox: {
    background: "#fff8f1", border: "1px solid #fed7aa",
    borderRadius: 8, padding: "10px 14px",
    fontSize: 12, color: "#92400e", lineHeight: 1.6,
    marginTop: 8,
  },

  // 모달
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff", borderRadius: 16, width: 520, maxWidth: "92vw",
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 24px 14px", borderBottom: "1px solid #f0ece4",
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#1a1a1a" },
  modalClose: {
    background: "none", border: "none", fontSize: 18,
    cursor: "pointer", color: "#888", padding: "0 4px",
  },
  modalBody: { padding: "20px 24px" },
  modalFooter: {
    display: "flex", justifyContent: "flex-end", gap: 10,
    padding: "14px 24px", borderTop: "1px solid #f0ece4",
  },

  infoGrid: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  infoRow:  { display: "flex", gap: 12, alignItems: "baseline" },
  infoLabel: { fontSize: 12, fontWeight: 600, color: "#888", minWidth: 90 },
  infoVal:   { fontSize: 13, color: "#1a1a1a" },

  aiBox: {
    background: "#f8f9fa", border: "1px solid #e5e7eb",
    borderRadius: 10, padding: "12px 16px", marginTop: 4,
  },
  aiTitle: { fontSize: 12, fontWeight: 700, color: "#5C6B2E", marginBottom: 6 },

  textarea: {
    width: "100%", marginTop: 6, padding: "10px 12px",
    border: "1.5px solid #e8e3da", borderRadius: 8,
    fontSize: 13, resize: "vertical", fontFamily: "inherit",
    boxSizing: "border-box",
  },

  // 처리 방식 선택 버튼 (현행확정 / 수정 후 확정 / 확인 요청)
  modeBtn: {
    flex: 1, padding: "9px 0", borderRadius: 8,
    border: "1.5px solid #e8e3da", background: "#fff",
    color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  },
  modeBtnActive: {
    background: "#3D6B2C", color: "#fff", border: "1.5px solid #3D6B2C",
  },
  modeBtnDisabled: {
    background: "#f3f4f6", color: "#9ca3af",
    border: "1.5px solid #e5e7eb", cursor: "not-allowed",
  },

  // OCR 자동 채우기 버튼
  ocrFillBtn: {
    padding: "3px 10px", borderRadius: 6,
    border: "1.5px solid #fde68a", background: "#fffbeb",
    color: "#92400e", fontSize: 11, fontWeight: 600, cursor: "pointer",
    whiteSpace: "nowrap",
  },

  // LLM 내역 박스
  llmBox: {
    background: "#f8f9fa", border: "1px solid #e5e7eb",
    borderRadius: 10, padding: "12px 16px", marginBottom: 4,
    position: "relative",
  },
  llmTitle: {
    fontSize: 12, fontWeight: 700, color: "#5C6B2E",
    marginBottom: 8,
  },

  // 수정/요청 액션 버튼
  actionBtn: {
    padding: "5px 14px", borderRadius: 6,
    border: "1.5px solid #d1d5db",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  },

  // 정정 테이블
  corrTh: {
    padding: "8px 12px", background: "#f5f7ee",
    color: "#5C6B2E", fontWeight: 700, fontSize: 13,
    textAlign: "center", borderBottom: "2px solid #e8e3da",
  },
  corrTd: {
    padding: "10px 12px", textAlign: "center",
    fontSize: 13, borderBottom: "1px solid #f0ece4",
  },
  corrInput: {
    width: "100%", padding: "6px 10px",
    border: "1.5px solid #d1d5db", borderRadius: 6,
    fontSize: 13, textAlign: "center", boxSizing: "border-box",
  },

  // 이메일 / 날짜 입력 필드
  inputField: {
    width: "100%", marginTop: 4, padding: "8px 12px",
    border: "1.5px solid #e8e3da", borderRadius: 8,
    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
  },

  cancelBtn: {
    padding: "9px 20px", borderRadius: 8,
    border: "1.5px solid #e8e3da", background: "#fff",
    color: "#555", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  submitBtn: {
    padding: "9px 22px", borderRadius: 8,
    background: "#3D6B2C", color: "#fff",
    border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  submitBtnDisabled: { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" },
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
