import { useState, useEffect, useRef, useCallback } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import ReportTOC from '../components/ReportTOC'
import ReportView from '../components/ReportView'
import * as api from '../reportApi'

// ── 연도 옵션 ───────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1999 }, (_, i) => 2000 + i)

// ── 로딩 애니메이션 (전역 CSS 없이 인라인으로 처리) ─────────
const LOADING_KEYFRAME = `
@keyframes reportLoadingSlide {
  0%   { left: -40%; }
  100% { left: 100%; }
}
`

export default function ReportGenerate({ isLoggedIn, onLogout }) {
  const [draft, setDraft]     = useState(null)
  const [year, setYear]       = useState(CURRENT_YEAR)
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const [error, setError]     = useState(null)
  const sectionRefs           = useRef({})

  // 초기 로드
  useEffect(() => {
    api.getDraft()
      .then(d => { if (d) { setDraft(d); setYear(d.year) } })
      .catch(() => {})
  }, [])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setLoadMsg('Supabase 데이터 조회 중...')
    try {
      setLoadMsg('LLM 코멘터리 생성 중... (잠시 시간이 걸립니다)')
      const d = await api.generateReport(year)
      setDraft(d)
    } catch (e) {
      setError('보고서 생성 실패: ' + e.message)
    } finally {
      setLoading(false)
      setLoadMsg('')
    }
  }

  const handleReset = async () => {
    if (!confirm('모든 수정 내용을 초기 생성 상태로 되돌릴까요?')) return
    setLoading(true)
    try {
      await api.resetDraft()
      const d = await api.getDraft()
      setDraft(d)
    } catch (e) {
      setError('초기화 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format) => {
    setLoading(true)
    try {
      await api.exportReport(format)
    } catch (e) {
      setError(`${format.toUpperCase()} 내보내기 실패: ` + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCommentaryUpdate = useCallback(async (indicatorId, newValue) => {
    try {
      await api.updateCommentary(indicatorId, newValue)
      setDraft(prev => {
        if (!prev) return prev
        const next = { ...prev, version: prev.version + 1 }
        next.sections = prev.sections.map(sec => ({
          ...sec,
          indicators: sec.indicators.map(ind =>
            ind.indicator_id === indicatorId
              ? { ...ind, commentary: { ...ind.commentary, current: newValue, last_modified: new Date().toISOString() } }
              : ind
          ),
        }))
        return next
      })
    } catch (e) {
      setError('저장 실패: ' + e.message)
    }
  }, [])

  const scrollToIndicator = useCallback((indicatorId) => {
    const el = sectionRefs.current[indicatorId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div style={s.page}>
      {/* 로딩 애니메이션 keyframe 주입 */}
      <style>{LOADING_KEYFRAME}</style>

      {/* 팀원 공통 Navbar */}
      <Navbar isLoggedIn={isLoggedIn} onLogout={onLogout} />

      <div style={s.body}>
        {/* 팀원 공통 Step Sidebar */}
        <Sidebar currentStep="report" />

        {/* ESG 보고서 목차 (TOC) */}
        <ReportTOC draft={draft} onNavigate={scrollToIndicator} />

        {/* 메인 콘텐츠 영역 */}
        <div style={s.content}>

          {/* 컨트롤 바 */}
          <div style={s.controlBar}>
            <div style={s.controlLeft}>
              <span style={s.pageTitle}>ESG 보고서</span>
              {draft && (
                <span style={s.versionTag}>
                  v{draft.version} · {draft.generated_at?.slice(0, 10)}
                </span>
              )}
            </div>

            <div style={s.controlRight}>
              <label style={s.yearLabel}>연도</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                style={s.yearSelect}
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>

              <button onClick={handleGenerate} disabled={loading} style={s.btnPrimary}>
                {loading && loadMsg ? '생성 중...' : '보고서 생성'}
              </button>

              {draft && (
                <button onClick={handleReset} disabled={loading} style={s.btnSecondary}>
                  초기화
                </button>
              )}

              {draft && <div style={s.divider} />}

              {draft && ['pdf', 'docx', 'hwp'].map(fmt => (
                <button key={fmt} onClick={() => handleExport(fmt)} disabled={loading} style={s.btnExport}>
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 로딩 바 */}
          {loading && (
            <div style={s.loadingTrack}>
              <div style={s.loadingFill} />
              {loadMsg && <span style={s.loadingMsg}>{loadMsg}</span>}
            </div>
          )}

          {/* 에러 배너 */}
          {error && (
            <div style={s.errorBanner}>
              {error}
              <button
                onClick={() => setError(null)}
                style={{ marginLeft: 12, background: 'none', color: '#DC2626', padding: '2px 6px' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* 본문 */}
          <main style={s.main}>
            {!draft && !loading && (
              <div style={s.emptyState}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>보고서가 없습니다</div>
                <div style={{ color: '#64748B', marginBottom: 24 }}>
                  연도를 선택하고 보고서를 생성하세요.
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  style={{ ...s.btnPrimary, padding: '10px 24px', fontSize: 15 }}
                >
                  {year}년 보고서 생성
                </button>
              </div>
            )}

            {draft && draft.sections.length === 0 && (
              <div style={s.emptyState}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>
                  표시할 ESG 데이터가 없습니다
                </div>
                <div style={{ color: '#94A3B8', marginTop: 8, fontSize: 13 }}>
                  {draft.year}년에 해당하는 데이터가 없습니다. 다른 연도를 선택해 보세요.
                </div>
              </div>
            )}

            {draft && draft.sections.length > 0 && (
              <ReportView
                draft={draft}
                sectionRefs={sectionRefs}
                onCommentaryUpdate={handleCommentaryUpdate}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#FAF8F0',
    fontFamily: "'Inter', 'Malgun Gothic', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    height: 'calc(100vh - 70px)', // Navbar 높이 70px 기준
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  controlBar: {
    height: 56,
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    flexShrink: 0,
    zIndex: 10,
  },
  controlLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  controlRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    fontWeight: 700,
    fontSize: 15,
    color: '#1E293B',
  },
  versionTag: {
    fontSize: 12,
    color: '#94A3B8',
  },
  yearLabel: {
    fontSize: 12,
    color: '#64748B',
    marginRight: 2,
  },
  yearSelect: {
    border: '1px solid #E2E8F0',
    borderRadius: 6,
    color: '#1E293B',
    padding: '4px 8px',
    fontSize: 13,
    fontWeight: 500,
    background: 'white',
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#84934A',
    color: 'white',
    fontWeight: 600,
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnSecondary: {
    background: '#F1F5F9',
    color: '#475569',
    border: 'none',
    borderRadius: 8,
    padding: '7px 16px',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnExport: {
    background: '#0F172A',
    color: 'white',
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 10px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  divider: {
    width: 1,
    height: 24,
    background: '#E2E8F0',
  },
  loadingTrack: {
    height: 3,
    background: '#E2E8F0',
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
  },
  loadingFill: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '40%',
    background: '#84934A',
    animation: 'reportLoadingSlide 1.5s ease-in-out infinite',
  },
  loadingMsg: {
    position: 'absolute',
    top: 6,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 12,
    color: '#64748B',
    background: 'white',
    padding: '2px 8px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
  },
  errorBanner: {
    background: '#FEE2E2',
    color: '#DC2626',
    padding: '8px 24px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
    textAlign: 'center',
  },
}
