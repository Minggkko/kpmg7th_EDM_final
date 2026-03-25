// ESG 보고서 목차 (TOC) 사이드바
// 팀원 Sidebar(스텝 네비게이션)와 구분되는 별도 컴포넌트입니다.

const CAT_COLORS = {
  E:   '#2563EB',
  S:   '#10B981',
  G:   '#8B5CF6',
  GEN: '#F59E0B',
}

export default function ReportTOC({ draft, onNavigate }) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#41431b' }}>ESG</span>
        <span style={{ fontWeight: 400, fontSize: 13, color: '#aeb784', marginLeft: 6 }}>목차</span>
      </div>

      {!draft && (
        <div style={styles.empty}>보고서를 먼저 생성하세요</div>
      )}

      {draft && (
        <nav style={styles.nav}>
          {draft.sections.map(sec => {
            const color = CAT_COLORS[sec.category_code] || '#64748B'
            return (
              <div key={sec.category_id} style={styles.section}>
                {/* 대목차 */}
                <div style={{ ...styles.categoryHeader, borderLeftColor: color }}>
                  <span style={{ ...styles.badge, background: color }}>
                    {sec.category_code}
                  </span>
                  <span style={styles.categoryName}>{sec.category_name}</span>
                </div>

                {/* 중목차 */}
                {sec.indicators.map(ind => (
                  <button
                    key={ind.indicator_id}
                    onClick={() => onNavigate(ind.indicator_id)}
                    style={styles.indBtn}
                    title={ind.indicator_name}
                  >
                    <span style={{ ...styles.dot, background: color }} />
                    <span style={styles.indName}>{ind.indicator_name}</span>
                    {ind.commentary.last_modified && (
                      <span style={styles.modBadge} title="수정됨">●</span>
                    )}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>
      )}

      {draft && (
        <div style={styles.footer}>
          {draft.year}년 · v{draft.version}
        </div>
      )}
    </aside>
  )
}

const styles = {
  sidebar: {
    width: 220,
    background: '#FFFFFF',
    borderRight: '1px solid #e3dbbb',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
  },
  logo: {
    padding: '16px 16px 12px',
    borderBottom: '1px solid #e3dbbb',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  empty: {
    padding: 20,
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
  },
  nav: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  section: {
    marginBottom: 8,
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderLeft: '3px solid transparent',
    background: '#faf8f0',
  },
  badge: {
    color: 'white',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 4,
    flexShrink: 0,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    letterSpacing: '-0.01em',
  },
  indBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    borderRadius: 0,
    textAlign: 'left',
    padding: '6px 16px 6px 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#475569',
    fontSize: 12.5,
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    opacity: 0.6,
  },
  indName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  modBadge: {
    color: '#F59E0B',
    fontSize: 8,
    flexShrink: 0,
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #e3dbbb',
    fontSize: 11,
    color: '#aeb784',
    textAlign: 'center',
    flexShrink: 0,
  },
}
