import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'

const COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

// monthly_by_site → recharts 데이터 형식 변환
function toBarData(aggregated) {
  const { months, monthly_by_site } = aggregated
  const sites = Object.keys(monthly_by_site)
  return months.map(m => {
    const entry = { month: m.slice(5) } // "2024-01" → "01"
    sites.forEach(site => {
      entry[site] = monthly_by_site[site]?.[m] ?? 0
    })
    return entry
  })
}

function fmt(val) {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'number') {
    return val >= 1000
      ? val.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
      : String(parseFloat(val.toFixed(3)))
  }
  return String(val)
}

// ── 막대 차트 ──────────────────────────────────────────────
function BarMetric({ metric }) {
  const { aggregated, unit } = metric
  const data  = toBarData(aggregated)
  const sites = Object.keys(aggregated.monthly_by_site)

  return (
    <div>
      <div style={styles.metricTitle}>
        {metric.metric_name}
        <span style={styles.unitTag}>{unit}</span>
        {Object.entries(aggregated.by_site).map(([site, val]) => (
          <span key={site} style={styles.totalTag}>
            {site}: 연간 {fmt(val)} {unit}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={55} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v} />
          <Tooltip formatter={(v) => [fmt(v) + ' ' + unit]} />
          {sites.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />}
          {sites.map((site, i) => (
            <Bar key={site} dataKey={site} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 도넛 차트 (%) ──────────────────────────────────────────
function DonutMetric({ metric }) {
  const { aggregated, unit } = metric
  const entries = Object.entries(aggregated.by_site)

  return (
    <div style={styles.donutWrap}>
      <div style={styles.metricTitle}>
        {metric.metric_name}
        <span style={styles.unitTag}>{unit}</span>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {entries.map(([site, val], i) => {
          const remaining = Math.max(0, 100 - val)
          const pieData = [
            { name: site, value: parseFloat(val.toFixed(3)) },
            { name: '나머지', value: parseFloat(remaining.toFixed(3)) },
          ]
          return (
            <div key={site} style={{ textAlign: 'center' }}>
              <PieChart width={120} height={120}>
                <Pie data={pieData} cx={55} cy={55} innerRadius={35} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill={COLORS[i % COLORS.length]} />
                  <Cell fill="#E2E8F0" />
                </Pie>
                <Tooltip formatter={(v) => [v + '%']} />
              </PieChart>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS[i % COLORS.length], marginTop: -8 }}>
                {fmt(val)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{site} · 연평균</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 테이블 (명, 건, 시간 등) ──────────────────────────────
function TableMetric({ metric }) {
  const { aggregated, unit } = metric
  const { monthly_by_site, by_site, months } = aggregated
  const sites = Object.keys(monthly_by_site)

  return (
    <div>
      <div style={styles.metricTitle}>
        {metric.metric_name}
        <span style={styles.unitTag}>{unit}</span>
        {Object.entries(by_site).map(([site, val]) => (
          <span key={site} style={styles.totalTag}>
            {site}: 연간 {fmt(val)} {unit}
          </span>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>월</th>
              {sites.map(s => <th key={s} style={styles.th}>{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {months.map((m, ri) => (
              <tr key={m} style={{ background: ri % 2 === 0 ? 'white' : '#faf8f0' }}>
                <td style={styles.td}>{m.slice(5)}월</td>
                {sites.map(site => (
                  <td key={site} style={{ ...styles.td, textAlign: 'right' }}>
                    {fmt(monthly_by_site[site]?.[m])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 꺾은선 그래프 (추이) ────────────────────────────────────
function LineMetric({ metric }) {
  const { aggregated, unit } = metric
  const data  = toBarData(aggregated)
  const sites = Object.keys(aggregated.monthly_by_site)

  return (
    <div>
      <div style={styles.metricTitle}>
        {metric.metric_name}
        <span style={styles.unitTag}>{unit}</span>
        {Object.entries(aggregated.by_site).map(([site, val]) => (
          <span key={site} style={styles.totalTag}>
            {site}: 연간 {fmt(val)} {unit}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={55} />
          <Tooltip formatter={(v) => [fmt(v) + ' ' + unit]} />
          {sites.length > 1 && <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />}
          {sites.map((site, i) => (
            <Line key={site} type="monotone" dataKey={site} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 분류별 가로 막대 (성별/연령대 등 연간 합계) ─────────────
function BreakdownBarMetric({ metric }) {
  const { aggregated, unit } = metric
  const entries = Object.entries(aggregated.by_site)
  const data = entries.map(([site, val]) => ({ name: site, value: val }))

  return (
    <div>
      <div style={styles.metricTitle}>
        {metric.metric_name}
        <span style={styles.unitTag}>{unit}</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(80, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(1)+'k' : v} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
          <Tooltip formatter={(v) => [fmt(v) + ' ' + unit]} />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 텍스트 ─────────────────────────────────────────────────
function TextMetric({ metric }) {
  const { aggregated, unit } = metric
  return (
    <div style={styles.textBlock}>
      <span style={styles.metricTitle}>{metric.metric_name}</span>
      <span style={{ color: '#64748B', marginLeft: 8 }}>
        {fmt(aggregated.total)} {unit}
      </span>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────
export default function MetricChart({ metric }) {
  switch (metric.chart_type) {
    case 'bar':           return <BarMetric          metric={metric} />
    case 'donut':         return <DonutMetric         metric={metric} />
    case 'table':         return <TableMetric         metric={metric} />
    case 'line':          return <LineMetric          metric={metric} />
    case 'breakdown_bar': return <BreakdownBarMetric  metric={metric} />
    case 'text':          return <TextMetric          metric={metric} />
    default:              return <TextMetric          metric={metric} />
  }
}

const styles = {
  metricTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 10,
  },
  unitTag: {
    background: 'rgba(132,147,74,0.12)',
    color: '#84934A',
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 4,
  },
  totalTag: {
    background: '#f5f5f3',
    color: '#656D3F',
    fontSize: 11,
    padding: '1px 6px',
    borderRadius: 4,
  },
  donutWrap: {
    paddingBottom: 4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  th: {
    background: '#f5f5f3',
    padding: '6px 12px',
    textAlign: 'left',
    fontWeight: 600,
    color: '#374151',
    borderBottom: '1px solid #e3dbbb',
  },
  td: {
    padding: '5px 12px',
    color: '#475569',
    borderBottom: '1px solid #f0f0ee',
  },
  textBlock: {
    padding: '10px 14px',
    background: '#faf8f0',
    borderRadius: 6,
    fontSize: 13,
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
}
