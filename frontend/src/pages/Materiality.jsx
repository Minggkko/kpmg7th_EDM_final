import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { getIssues } from "../api/issues";
import { getIndicators } from "../api/standardData";

// esg_category_id → 코드/라벨 매핑
const CAT_CODE  = { 1: "E", 2: "S", 3: "G" };
const CAT_LABEL = { 1: "환경", 2: "사회", 3: "지배구조" };

const YEARS = [2023, 2024, 2025];
const CATEGORIES = ["E", "S", "G"];
const CATEGORY_COLOR = {
  E: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  S: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  G: { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
};

export default function Materiality({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();

  // DB 데이터
  const [allIssues, setAllIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issueIndicators, setIssueIndicators] = useState({}); // { issueId: [name, ...] }

  useEffect(() => {
    getIssues()
      .then((res) => {
        const mapped = (res?.data || []).map((issue) => ({
          id: issue.id,
          category: CAT_CODE[issue.esg_category_id] || "E",
          categoryLabel: CAT_LABEL[issue.esg_category_id] || "",
          title: issue.name,
          desc: issue.description || "",
          years: issue.previous_years || [],
        }));
        setAllIssues(mapped);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchIndicators = async (issueId) => {
    if (issueIndicators[issueId] !== undefined) return;
    try {
      const res = await getIndicators(issueId);
      setIssueIndicators((prev) => ({
        ...prev,
        [issueId]: (res?.data || []).map((ind) => ind.name || ind.indicator_code || ""),
      }));
    } catch {
      setIssueIndicators((prev) => ({ ...prev, [issueId]: [] }));
    }
  };

  // 1-1-1 상태
  const [filterCategories, setFilterCategories] = useState([]);
  const [filterYears, setFilterYears] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showYearPanel, setShowYearPanel] = useState(false);

  // 1-1-2 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createYear, setCreateYear] = useState(2025);
  const [createSelected, setCreateSelected] = useState([]);
  const [expandedIssue, setExpandedIssue] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 필터링된 이슈 목록
  const filteredIssues = allIssues.filter((issue) => {
    const matchCat = filterCategories.length === 0 || filterCategories.includes(issue.category);
    const matchYear = filterYears.length === 0 || filterYears.some((y) => issue.years.includes(y));
    const matchKeyword = keyword === "" || issue.title.includes(keyword) || issue.desc.includes(keyword);
    return matchCat && matchYear && matchKeyword;
  });

  const toggleFilter = (val, setter, arr) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const handleCreateConfirm = () => {
    setShowConfirm(false);
    setShowSuccess(true);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setShowCreateModal(false);
    setCreateSelected([]);
    setExpandedIssue(null);
    const selectedIssueData = allIssues.filter(i => createSelected.includes(i.id)).map(i => ({
      id: i.id, name: i.title, category: i.category
    }));
    sessionStorage.setItem("esgIssues", JSON.stringify(selectedIssueData));
    sessionStorage.setItem("esgYear", String(createYear));
    navigate('/standard-data', { state: { issues: selectedIssueData } });
  };

  return (
    <div style={s.root}>
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />
      <div style={s.body}>
        <Sidebar currentStep="issue-select" />
        <main style={s.main}>

          {/* 페이지 헤더 */}
          <div style={s.pageHeader}>
            <div>
              <p style={s.breadcrumb}>중대성 평가</p>
              <h1 style={s.pageTitle}>중대이슈 표준목록 조회</h1>
              <p style={s.pageDesc}>ESG 중대이슈를 필터링하고 당해년도 이슈를 생성하세요.</p>
            </div>
            <div style={s.headerStats}>
              <div style={s.statBox}>
                <span style={s.statNum}>{loading ? "…" : allIssues.length}</span>
                <span style={s.statLabel}>전체 이슈</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statNum}>{loading ? "…" : allIssues.filter(i => i.category === "E").length}</span>
                <span style={{ ...s.statLabel, color: "#16a34a" }}>E</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statNum}>{loading ? "…" : allIssues.filter(i => i.category === "S").length}</span>
                <span style={{ ...s.statLabel, color: "#2563eb" }}>S</span>
              </div>
              <div style={s.statBox}>
                <span style={s.statNum}>{loading ? "…" : allIssues.filter(i => i.category === "G").length}</span>
                <span style={{ ...s.statLabel, color: "#7c3aed" }}>G</span>
              </div>
            </div>
          </div>

          <div style={s.divider} />

          {/* 툴바 */}
          <div style={s.toolbar}>
            <div style={s.toolbarLeft}>

              {/* 키워드 검색 */}
              <div style={s.searchBox}>
                <span style={s.searchIcon}>🔍</span>
                <input
                  style={s.searchInput}
                  placeholder="이슈 검색..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>

              {/* 필터링 드롭다운 */}
              <div style={s.dropdownWrap}>
                <button
                  style={{
                    ...s.dropBtn,
                    ...(filterCategories.length > 0 ? s.dropBtnActive : {}),
                  }}
                  onClick={() => { setShowFilterPanel(!showFilterPanel); setShowYearPanel(false); }}
                >
                  필터링 / 조건 검색
                  {filterCategories.length > 0 && <span style={s.badge}>{filterCategories.length}</span>}
                  <span style={s.dropArrow}>▽</span>
                </button>
                {showFilterPanel && (
                  <div style={s.dropPanel}>
                    <p style={s.dropPanelLabel}>E/S/G 카테고리</p>
                    <div style={s.dropOptions}>
                      {CATEGORIES.map((cat) => {
                        const c = CATEGORY_COLOR[cat];
                        const active = filterCategories.includes(cat);
                        return (
                          <button
                            key={cat}
                            style={{
                              ...s.dropOption,
                              background: active ? c.bg : "#fff",
                              color: active ? c.color : "#555",
                              border: `1px solid ${active ? c.border : "#e0e0e0"}`,
                            }}
                            onClick={() => toggleFilter(cat, setFilterCategories, filterCategories)}
                          >
                            {active && "✓ "}{cat}
                          </button>
                        );
                      })}
                    </div>
                    <button style={s.dropClear} onClick={() => { setFilterCategories([]); setShowFilterPanel(false); }}>
                      초기화
                    </button>
                  </div>
                )}
              </div>

              {/* 연도 선택 드롭다운 */}
              <div style={s.dropdownWrap}>
                <button
                  style={{
                    ...s.dropBtn,
                    ...(filterYears.length > 0 ? s.dropBtnActive : {}),
                  }}
                  onClick={() => { setShowYearPanel(!showYearPanel); setShowFilterPanel(false); }}
                >
                  연도 선택
                  {filterYears.length > 0 && <span style={s.badge}>{filterYears.length}</span>}
                  <span style={s.dropArrow}>▽</span>
                </button>
                {showYearPanel && (
                  <div style={s.dropPanel}>
                    <p style={s.dropPanelLabel}>Roll Forward 연도 (복수 선택)</p>
                    <div style={s.dropOptions}>
                      {YEARS.map((year) => {
                        const active = filterYears.includes(year);
                        return (
                          <button
                            key={year}
                            style={{
                              ...s.dropOption,
                              background: active ? "#f0fdf4" : "#fff",
                              color: active ? "#16a34a" : "#555",
                              border: `1px solid ${active ? "#bbf7d0" : "#e0e0e0"}`,
                            }}
                            onClick={() => toggleFilter(year, setFilterYears, filterYears)}
                          >
                            {active && "✓ "}{year}
                          </button>
                        );
                      })}
                    </div>
                    <button style={s.dropClear} onClick={() => { setFilterYears([]); setShowYearPanel(false); }}>
                      초기화
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 중대이슈 생성 버튼 */}
            <button style={s.createBtn} onClick={() => setShowCreateModal(true)}>
              + 중대 이슈 생성
            </button>
          </div>

          {/* 활성 필터 태그 */}
          {(filterCategories.length > 0 || filterYears.length > 0) && (
            <div style={s.filterTags}>
              {filterCategories.map((c) => (
                <span key={c} style={{ ...s.filterTag, background: CATEGORY_COLOR[c].bg, color: CATEGORY_COLOR[c].color }}>
                  {c} <button style={s.tagRemove} onClick={() => toggleFilter(c, setFilterCategories, filterCategories)}>✕</button>
                </span>
              ))}
              {filterYears.map((y) => (
                <span key={y} style={s.filterTag}>
                  {y}년 <button style={s.tagRemove} onClick={() => toggleFilter(y, setFilterYears, filterYears)}>✕</button>
                </span>
              ))}
              <button style={s.clearAll} onClick={() => { setFilterCategories([]); setFilterYears([]); }}>전체 초기화</button>
            </div>
          )}

          {/* 이슈 리스트 */}
          <div style={s.listWrap}>
            {/* 컬럼 헤더 */}
            <div style={s.colHeader}>
              <span style={{ width: 32 }} />
              <span style={{ flex: 1 }}>이슈명</span>
              <span style={{ width: 80, textAlign: "center" }}>카테고리</span>
              <span style={{ width: 140, textAlign: "center" }}>적용 연도</span>
            </div>

            {loading ? (
              <div style={s.emptyMsg}>데이터를 불러오는 중...</div>
            ) : filteredIssues.length === 0 ? (
              <div style={s.emptyMsg}>검색 결과가 없습니다.</div>
            ) : (
              filteredIssues.map((issue, idx) => {
                const c = CATEGORY_COLOR[issue.category] || CATEGORY_COLOR["E"];
                return (
                  <div
                    key={issue.id}
                    style={{
                      ...s.listRow,
                      borderBottom: idx < filteredIssues.length - 1 ? "1px solid #f0ede8" : "none",
                      background: filterYears.length > 0 && filterYears.some(y => issue.years.includes(y))
                        ? "#f9fdf5" : "#fff",
                    }}
                  >
                    <div style={s.checkboxCol}>
                      <div style={{
                        ...s.checkbox,
                        ...(filterYears.length > 0 && filterYears.some(y => issue.years.includes(y))
                          ? s.checkboxChecked : {}),
                      }}>
                        {filterYears.length > 0 && filterYears.some(y => issue.years.includes(y)) && (
                          <span style={s.checkMark}>✓</span>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={s.issueTitle}>{issue.title}</span>
                      <span style={s.issueDesc}>{issue.desc}</span>
                    </div>
                    <div style={{ width: 80, display: "flex", justifyContent: "center" }}>
                      <span style={{ ...s.catBadge, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                        {issue.category}
                      </span>
                    </div>
                    <div style={{ width: 140, display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                      {issue.years.length > 0 ? issue.years.map((y) => (
                        <span key={y} style={s.yearTag}>{y}</span>
                      )) : <span style={{ fontSize: 12, color: "#ccc" }}>-</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={s.listFooter}>
            총 <strong>{filteredIssues.length}</strong>개 이슈
          </div>

        </main>
      </div>

      {/* ── 1-1-2 중대이슈 생성 모달 ── */}
      {showCreateModal && (
        <div style={s.overlay} onClick={() => !showConfirm && !showSuccess && setShowCreateModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>

            {/* 모달 헤더 */}
            <div style={s.modalHeader}>
              <div>
                <p style={s.modalBreadcrumb}>1-1-2</p>
                <h2 style={s.modalTitle}>중대이슈 신규 생성</h2>
              </div>
              <button style={s.closeBtn} onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div style={s.modalDivider} />

            {/* 연도 선택 */}
            <div style={s.modalSection}>
              <p style={s.modalSectionLabel}>FY 연도 선택</p>
              <div style={{ display: "flex", gap: 8 }}>
                {YEARS.map((y) => (
                  <button
                    key={y}
                    style={{
                      ...s.yearBtn,
                      ...(createYear === y ? s.yearBtnActive : {}),
                    }}
                    onClick={() => setCreateYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>

            {/* 이슈 목록 */}
            <div style={s.modalSection}>
              <p style={s.modalSectionLabel}>이슈 선택 <span style={{ color: "#aaa", fontWeight: 400 }}>({createSelected.length}개 선택됨)</span></p>
              <div style={s.modalIssueList}>
                {allIssues.map((issue) => {
                  const c = CATEGORY_COLOR[issue.category] || CATEGORY_COLOR["E"];
                  const isSelected = createSelected.includes(issue.id);
                  const isExpanded = expandedIssue === issue.id;
                  const indicators = issueIndicators[issue.id];
                  return (
                    <div key={issue.id} style={{ borderBottom: "1px solid #f0ede8" }}>
                      <div
                        style={{
                          ...s.modalIssueRow,
                          background: isSelected ? "#f5f7ee" : "#fff",
                        }}
                      >
                        <div
                          style={s.modalCheckbox}
                          onClick={() => {
                            setCreateSelected((prev) =>
                              prev.includes(issue.id) ? prev.filter(id => id !== issue.id) : [...prev, issue.id]
                            );
                          }}
                        >
                          <div style={{
                            ...s.checkbox,
                            ...(isSelected ? s.checkboxChecked : {}),
                          }}>
                            {isSelected && <span style={s.checkMark}>✓</span>}
                          </div>
                        </div>
                        <div style={{ flex: 1 }} onClick={() => {
                          const next = isExpanded ? null : issue.id;
                          setExpandedIssue(next);
                          if (next) fetchIndicators(issue.id);
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...s.catBadge, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                              {issue.category}
                            </span>
                            <span style={s.issueTitle}>{issue.title}</span>
                            <span style={{ fontSize: 12, color: "#aaa", marginLeft: "auto" }}>
                              {isExpanded ? "▲" : "▽"}
                            </span>
                          </div>
                          <span style={s.issueDesc}>{issue.desc}</span>
                        </div>
                      </div>
                      {/* 유관 지표 확장 */}
                      {isExpanded && (
                        <div style={s.indicatorList}>
                          {indicators === undefined ? (
                            <div style={s.indicatorItem}>불러오는 중...</div>
                          ) : indicators.length === 0 ? (
                            <div style={s.indicatorItem}>유관 지표 없음</div>
                          ) : indicators.map((ind, i) => (
                            <div key={i} style={s.indicatorItem}>
                              <span style={s.indicatorDot} />
                              {ind}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 최종 확인 문구 + 버튼 */}
            {createSelected.length > 0 && (
              <div style={s.confirmBar}>
                <span style={s.confirmText}>
                  위 선택한 <strong>{createSelected.length}개</strong>의 이슈를 {createYear}년도 중대이슈로 최종 확정하시겠습니까?
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={s.cancelBtn} onClick={() => setShowCreateModal(false)}>취소</button>
                  <button style={s.confirmBtn} onClick={() => setShowConfirm(true)}>생성 완료</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 최종 확인 팝업 */}
      {showConfirm && (
        <div style={s.overlay}>
          <div style={s.confirmModal}>
            <p style={s.confirmModalTitle}>최종 확정</p>
            <p style={s.confirmModalDesc}>
              {createYear}년도 중대이슈 <strong>{createSelected.length}개</strong>를 생성하시겠습니까?<br />
              이 작업은 되돌리기 어렵습니다.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button style={s.cancelBtn} onClick={() => setShowConfirm(false)}>취소</button>
              <button style={s.confirmBtn} onClick={handleCreateConfirm}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 성공 안내 팝업 */}
      {showSuccess && (
        <div style={s.overlay}>
          <div style={s.successModal}>
            <div style={s.successIcon}>✓</div>
            <p style={s.successTitle}>생성 완료!</p>
            <p style={s.successDesc}>
              {createYear}년도 중대이슈 <strong>{createSelected.length}개</strong>가 성공적으로 생성되었습니다.
            </p>
            <button style={s.confirmBtn} onClick={handleSuccessClose}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 스타일 ─────────────────────────────────────────────────────────
const s = {
  root: { minHeight: "100vh", background: "#FAF8F0", fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" },
  body: { display: "flex" },
  main: { flex: 1, padding: "40px 48px", maxWidth: 1100 },

  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  breadcrumb: { fontSize: 12, color: "#aaa", margin: "0 0 6px" },
  pageTitle: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px" },
  pageDesc: { fontSize: 14, color: "#888", margin: 0 },
  headerStats: { display: "flex", gap: 12 },
  statBox: { display: "flex", flexDirection: "column", alignItems: "center", background: "#fff", border: "1px solid #e8e3da", borderRadius: 8, padding: "10px 18px", gap: 2 },
  statNum: { fontSize: 20, fontWeight: 700, color: "#1a1a1a" },
  statLabel: { fontSize: 11, color: "#aaa", fontWeight: 500 },

  divider: { height: 1, background: "#e8e3da", marginBottom: 20 },

  // 툴바
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 },
  toolbarLeft: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  searchBox: { display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e0dbd0", borderRadius: 6, padding: "7px 12px", gap: 6 },
  searchIcon: { fontSize: 13 },
  searchInput: { border: "none", outline: "none", fontSize: 13, color: "#333", background: "transparent", width: 150 },

  dropdownWrap: { position: "relative" },
  dropBtn: { display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500, background: "#fff", border: "1px solid #e0dbd0", borderRadius: 6, cursor: "pointer", color: "#555" },
  dropBtnActive: { border: "1px solid #5C6B2E", color: "#5C6B2E", background: "#f5f7ee" },
  dropArrow: { fontSize: 10, color: "#aaa" },
  badge: { background: "#5C6B2E", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 10, padding: "1px 6px" },

  dropPanel: { position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #e8e3da", borderRadius: 8, padding: "14px 16px", zIndex: 200, minWidth: 200, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" },
  dropPanelLabel: { fontSize: 11, fontWeight: 600, color: "#aaa", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" },
  dropOptions: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  dropOption: { padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  dropClear: { fontSize: 11, color: "#aaa", background: "none", border: "none", cursor: "pointer", padding: 0 },

  filterTags: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" },
  filterTag: { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 20, padding: "3px 10px" },
  tagRemove: { background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 10, padding: 0 },
  clearAll: { fontSize: 11, color: "#aaa", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" },

  createBtn: { padding: "9px 20px", fontSize: 13, fontWeight: 600, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" },

  // 리스트
  listWrap: { background: "#fff", border: "1px solid #e8e3da", borderRadius: 8, overflow: "hidden" },
  colHeader: { display: "flex", alignItems: "center", padding: "10px 20px", background: "#f5f3ed", borderBottom: "1px solid #e8e3da", fontSize: 12, color: "#888", fontWeight: 600, gap: 12 },
  listRow: { display: "flex", alignItems: "center", padding: "16px 20px", gap: 12, transition: "background 0.15s" },
  checkboxCol: { width: 32, display: "flex", justifyContent: "center" },
  checkbox: { width: 18, height: 18, border: "1.5px solid #ccc", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" },
  checkboxChecked: { background: "#5C6B2E", border: "1.5px solid #5C6B2E" },
  checkMark: { fontSize: 11, color: "#fff", fontWeight: 700 },
  issueTitle: { fontSize: 14, fontWeight: 600, color: "#1a1a1a", marginRight: 8 },
  issueDesc: { fontSize: 12, color: "#aaa", display: "block" },
  catBadge: { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 },
  yearTag: { fontSize: 11, background: "#f5f3ed", color: "#888", borderRadius: 4, padding: "2px 7px" },
  emptyMsg: { textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 14 },
  listFooter: { marginTop: 10, fontSize: 12, color: "#aaa", textAlign: "right" },

  // 모달
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 12, width: 680, maxWidth: "92vw", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.15)", overflow: "hidden" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 28px 16px" },
  modalBreadcrumb: { fontSize: 11, color: "#aaa", margin: "0 0 4px" },
  modalTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 },
  closeBtn: { background: "none", border: "none", fontSize: 18, color: "#aaa", cursor: "pointer", padding: 4 },
  modalDivider: { height: 1, background: "#e8e3da" },
  modalSection: { padding: "18px 28px" },
  modalSectionLabel: { fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 },
  yearBtn: { padding: "7px 18px", fontSize: 13, fontWeight: 600, background: "#f5f3ed", color: "#888", border: "1px solid #e0dbd0", borderRadius: 6, cursor: "pointer" },
  yearBtnActive: { background: "#5C6B2E", color: "#fff", border: "1px solid #5C6B2E" },

  modalIssueList: { overflowY: "auto", maxHeight: 340, border: "1px solid #e8e3da", borderRadius: 8 },
  modalIssueRow: { display: "flex", alignItems: "flex-start", padding: "14px 16px", gap: 10, cursor: "pointer" },
  modalCheckbox: { paddingTop: 2, cursor: "pointer" },

  indicatorList: { background: "#fafaf8", padding: "10px 16px 10px 48px" },
  indicatorItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#666", padding: "3px 0" },
  indicatorDot: { width: 5, height: 5, borderRadius: "50%", background: "#5C6B2E", flexShrink: 0 },

  confirmBar: { padding: "16px 28px", background: "#f5f7ee", borderTop: "1px solid #e8e3da", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  confirmText: { fontSize: 13, color: "#444" },
  cancelBtn: { padding: "8px 20px", fontSize: 13, fontWeight: 500, background: "#fff", color: "#444", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer" },
  confirmBtn: { padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#5C6B2E", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },

  confirmModal: { background: "#fff", borderRadius: 12, padding: "32px 36px", width: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.15)" },
  confirmModalTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" },
  confirmModalDesc: { fontSize: 14, color: "#555", lineHeight: 1.7 },

  successModal: { background: "#fff", borderRadius: 12, padding: "40px 36px", width: 360, textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.15)" },
  successIcon: { width: 56, height: 56, borderRadius: "50%", background: "#5C6B2E", color: "#fff", fontSize: 24, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" },
  successTitle: { fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" },
  successDesc: { fontSize: 14, color: "#666", lineHeight: 1.7, marginBottom: 24 },
};