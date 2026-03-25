// ESG 보고서 API
// 백엔드: FastAPI (localhost:8000), Vite proxy 설정 필요 → /api → http://localhost:8000

const BASE = '/api/report'

export async function getDraft() {
  const res = await fetch(`${BASE}/draft`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function generateReport(year) {
  const res = await fetch(`${BASE}/generate?year=${year}`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateCommentary(indicatorId, newValue) {
  const res = await fetch(`${BASE}/draft/commentary`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indicator_id: indicatorId, new_value: newValue }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function resetDraft() {
  const res = await fetch(`${BASE}/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function exportReport(format) {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }),
  })
  if (!res.ok) throw new Error(await res.text())
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `esg_report.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
