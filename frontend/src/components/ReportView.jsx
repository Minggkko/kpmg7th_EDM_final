import { useState, useCallback } from 'react'
import MetricChart from './MetricChart'

const CAT_COLORS = {
  E:   '#2563EB',
  S:   '#10B981',
  G:   '#8B5CF6',
  GEN: '#F59E0B',
}

// ── 코멘터리 편집 블록 ──────────────────────────────────────
function Commentary({ ind, onUpdate }) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(ind.commentary.current)
  const [saving, setSaving]     = useState(false)

  const handleBlur = useCallback(async () => {
    if (value === ind.commentary.current) { setEditing(false); return }
    setSaving(true)
    await onUpdate(ind.indicator_id, value)
    setSaving(false)
    setEditing(false)
  }, [value, ind, onUpdate])

  const isModified = ind.commentary.last_modified !== null

  return (
    <div style={styles.commentaryBox}>
      <div style={styles.commentaryHeader}>
        <span style={styles.commentaryLabel}>ESG 성과 해설</span>
        {isModified && <span style={styles.modTag}>수정됨</span>}
        {saving && <span style={{ fontSize: 11, color: '#64748B' }}>저장 중...</span>}
        {!editing && (
          <button onClick={() => setEditing(true)} style={styles.editBtn}>편집</button>
        )}
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          rows={6}
          style={{ marginTop: 8, width: '100%', boxSizing: 'border-box' }}
        />
      ) : (
        <p style={styles.commentaryText} onClick={() => setEditing(true)} title="클릭하여 편집">
          {ind.commentary.current || '(내용 없음)'}
        </p>
      )}
    </div>
  )
}

// ── 연도 라벨 ───────────────────────────────────────────────
function YearLabel({ year, isPrev }) {
  return (
    <div style={{ ...styles.yearLabel, ...(isPrev ? styles.yearLabelPrev : styles.yearLabelCurrent) }}>
      {year}년
    </div>
  )
}

// ── 중목차 블록 (메트릭 단위 좌우 1:1 매칭) ─────────────────
function IndicatorBlock({ ind, catColor, sectionRefs, onUpdate, prevInd, year, prevYear }) {
  // 직전년도 메트릭을 이름으로 빠르게 조회
  const prevMetricMap = {}
  if (prevInd && prevInd.metrics) {
    for (const m of prevInd.metrics) {
      prevMetricMap[m.metric_name] = m
    }
  }

  return (
    <div
      ref={el => { sectionRefs.current[ind.indicator_id] = el }}
      style={styles.indicatorCard}
    >
      {/* 중목차 제목 */}
      <div style={{ ...styles.indicatorHeader, borderLeftColor: catColor }}>
        <h3 style={styles.indicatorTitle}>{ind.indicator_name}</h3>
      </div>

      {/* 연도 라벨 헤더 */}
      <div style={styles.splitRow}>
        <div style={{ ...styles.splitPane, padding: '10px 20px 6px' }}>
          <YearLabel year={prevYear} isPrev />
        </div>
        <div style={styles.splitDivider} />
        <div style={{ ...styles.splitPane, padding: '10px 20px 6px' }}>
          <YearLabel year={year} isPrev={false} />
        </div>
      </div>

      {/* 메트릭 단위 1:1 행 */}
      {ind.metrics.length === 0 ? (
        <div style={{ padding: '0 20px 16px', ...styles.noData }}>연결된 데이터가 없습니다.</div>
      ) : (
        ind.metrics.map((m, i) => {
          const prevM = prevMetricMap[m.metric_name] || null
          return (
            <div key={i} style={{ ...styles.splitRow, borderTop: '1px dashed #e3dbbb' }}>
              <div style={styles.splitPane}>
                {prevM
                  ? <MetricChart metric={prevM} />
                  : <div style={styles.noData}>해당 데이터가 없습니다.</div>
                }
              </div>
              <div style={styles.splitDivider} />
              <div style={styles.splitPane}>
                <MetricChart metric={m} />
              </div>
            </div>
          )
        })
      )}

      {/* 코멘터리 */}
      <div style={styles.commentaryWrap}>
        <Commentary ind={ind} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

// ── 대목차 섹션 ────────────────────────────────────────────
function CategorySection({ section, sectionRefs, onUpdate, prevIndMap, year, prevYear }) {
  const color = CAT_COLORS[section.category_code] || '#64748B'
  return (
    <section style={styles.categorySection}>
      <div style={{ ...styles.categoryHeader, background: color }}>
        <span style={styles.categoryCode}>{section.category_code}</span>
        <span style={styles.categoryName}>{section.category_name}</span>
        <span style={styles.categoryCount}>{section.indicators.length}개 지표</span>
      </div>

      <div style={styles.indicatorList}>
        {section.indicators.map(ind => (
          <IndicatorBlock
            key={ind.indicator_id}
            ind={ind}
            catColor={color}
            sectionRefs={sectionRefs}
            onUpdate={onUpdate}
            prevInd={prevIndMap[ind.indicator_id] || null}
            year={year}
            prevYear={prevYear}
          />
        ))}
      </div>
    </section>
  )
}

// ── 메인 ──────────────────────────────────────────────────
export default function ReportView({ draft, sectionRefs, onCommentaryUpdate }) {
  // indicator_id → prevInd 빠른 조회 맵
  const prevIndMap = {}
  if (draft.prev_sections) {
    for (const sec of draft.prev_sections) {
      for (const ind of sec.indicators) {
        prevIndMap[ind.indicator_id] = ind
      }
    }
  }

  const year     = draft.year
  const prevYear = draft.prev_year ?? year - 1

  return (
    <div style={styles.container}>
      {draft.sections.map(sec => (
        <CategorySection
          key={sec.category_id}
          section={sec}
          sectionRefs={sectionRefs}
          onUpdate={onCommentaryUpdate}
          prevIndMap={prevIndMap}
          year={year}
          prevYear={prevYear}
        />
      ))}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  categorySection: {
    marginBottom: 40,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    borderRadius: '8px 8px 0 0',
    color: 'white',
    marginBottom: 2,
  },
  categoryCode: {
    fontSize: 13,
    fontWeight: 800,
    background: 'rgba(255,255,255,0.25)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: 700,
    flex: 1,
  },
  categoryCount: {
    fontSize: 12,
    opacity: 0.8,
  },
  indicatorList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    paddingTop: 16,
  },
  indicatorCard: {
    background: 'white',
    borderRadius: 8,
    border: '1px solid #e3dbbb',
    overflow: 'hidden',
  },
  indicatorHeader: {
    padding: '14px 20px',
    borderLeft: '4px solid transparent',
    borderBottom: '1px solid #e3dbbb',
    background: '#faf8f0',
  },
  indicatorTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1E293B',
    marginBottom: 4,
  },

  // ── 좌우 분할 ──
  splitRow: {
    display: 'flex',
  },
  splitPane: {
    flex: 1,
    padding: '16px 20px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  splitDivider: {
    width: 1,
    background: '#e3dbbb',
    flexShrink: 0,
  },

  // ── 연도 라벨 ──
  yearLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    padding: '3px 8px',
    borderRadius: 4,
    display: 'inline-block',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  yearLabelPrev: {
    background: '#f5f3ed',
    color: '#888',
  },
  yearLabelCurrent: {
    background: 'rgba(132,147,74,0.12)',
    color: '#84934A',
  },

  commentaryWrap: {
    padding: '0 20px 20px',
    borderTop: '1px dashed #e3dbbb',
    paddingTop: 16,
  },
  noData: {
    color: '#94A3B8',
    fontStyle: 'italic',
    fontSize: 13,
    padding: '8px 0',
  },

  // ── 코멘터리 ──
  commentaryBox: {
    marginTop: 16,
    padding: '14px 16px',
    background: '#faf8f0',
    borderRadius: 8,
    border: '1px solid #e3dbbb',
  },
  commentaryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentaryLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#84934A',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flex: 1,
  },
  modTag: {
    fontSize: 10,
    background: '#FEF3C7',
    color: '#D97706',
    padding: '1px 6px',
    borderRadius: 4,
    fontWeight: 600,
  },
  editBtn: {
    background: 'none',
    color: '#656D3F',
    fontSize: 11,
    padding: '2px 8px',
    border: '1px solid #c8be96',
    borderRadius: 4,
  },
  commentaryText: {
    fontSize: 13.5,
    color: '#1E293B',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    cursor: 'text',
  },
}
