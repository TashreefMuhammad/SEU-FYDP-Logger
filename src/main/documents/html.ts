/**
 * Print-document primitives shared by every generated PDF.
 *
 * Deliberately dependency-free and JavaScript-free: the HTML produced here is
 * loaded into an offscreen Electron window with scripting disabled and printed
 * via Chromium's own PDF writer, so charts are emitted as inline SVG rather
 * than rendered by ECharts.
 */

export const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const dash = (v: unknown): string => {
  const s = String(v ?? '').trim()
  return s ? esc(s) : '&mdash;'
}

/** 2026-05-12 → 12.05.2026 (the format used on the departmental form) */
export const dotDate = (iso: string): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return y && m && d ? `${d}.${m}.${y}` : iso
}

/** 2026-05-12 → 12 May 2026 */
export const longDate = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

export const hhmm = (t: string): string => {
  if (!t) return ''
  const [hStr, m] = t.split(':')
  let h = Number(hStr)
  if (Number.isNaN(h)) return t
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m ?? '00'} ${suffix}`
}

export const durationText = (minutes: number): string => {
  if (!minutes) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h} h ${m} m`
  if (h) return `${h} h`
  return `${m} m`
}

// ── Base stylesheet ─────────────────────────────────────────────────────────

export const BASE_CSS = `
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', 'Liberation Serif', Times, serif;
    font-size: 10.5pt; line-height: 1.45; color: #111; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1, h2, h3, h4 { color: #10245c; margin: 0 0 6px; line-height: 1.25; }
  h1 { font-size: 17pt; }
  h2 { font-size: 13pt; margin-top: 18px; padding-bottom: 3px; border-bottom: 1.5px solid #10245c; }
  h3 { font-size: 11.5pt; margin-top: 14px; }
  h4 { font-size: 10.5pt; margin-top: 10px; color: #333; }
  p { margin: 0 0 8px; text-align: justify; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 9.5pt; }
  th, td { border: 0.7pt solid #9aa4b8; padding: 4px 6px; vertical-align: top; text-align: left; }
  th { background: #e8edf7; color: #10245c; font-weight: bold; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.ctr, th.ctr { text-align: center; }
  .muted { color: #5b6478; }
  .small { font-size: 8.5pt; }
  .mono { font-family: 'Courier New', monospace; font-size: 8.5pt; letter-spacing: 0.02em; }
  .page-break { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
  .note {
    border-left: 3px solid #10245c; background: #f4f6fb;
    padding: 7px 10px; margin: 10px 0; font-size: 9.5pt; text-align: left;
  }
  .warn { border-left-color: #a1651a; background: #fdf6ec; }
  .pill {
    display: inline-block; padding: 1px 7px; border-radius: 9px;
    font-size: 8pt; font-weight: bold; border: 0.7pt solid;
  }
  .pill-high { background: #fbe9e9; border-color: #a33; color: #8a1f1f; }
  .pill-moderate { background: #fdf3e2; border-color: #b8801f; color: #8a5f11; }
  .pill-low { background: #eaf5ec; border-color: #2f7a45; color: #1f5c33; }
  .pill-info { background: #eaeff9; border-color: #2f4f8a; color: #1f3a6a; }
  .kv { width: 100%; border: none; margin: 0 0 10px; }
  .kv td { border: none; padding: 1.5px 0; font-size: 10pt; }
  .kv td.k { width: 34%; color: #5b6478; }
  .sheet-title { text-align: center; margin-bottom: 10px; }
  .sheet-title .uni { font-size: 14pt; font-weight: bold; color: #10245c; }
  .sheet-title .dept { font-size: 11.5pt; font-weight: bold; }
  .sheet-title .doc { font-size: 11pt; font-weight: bold; text-decoration: underline; margin-top: 3px; }
  .rule { border-top: 1.2pt solid #10245c; margin: 8px 0 10px; }
  .sig-line { border-top: 0.8pt solid #333; width: 62mm; margin-top: 34px; padding-top: 3px; font-size: 9pt; }
`

// ── Chart primitives (inline SVG) ───────────────────────────────────────────

export interface BarDatum {
  label: string
  value: number
  display?: string
  colour?: string
}

/** Horizontal bar chart — used for attendance, contribution, engagement */
export function hBarChart(data: BarDatum[], opts: { max?: number; width?: number; suffix?: string } = {}): string {
  const width = opts.width ?? 500
  const rowH = 19
  const labelW = 150
  const barW = width - labelW - 52
  const max = opts.max ?? Math.max(1, ...data.map((d) => d.value))
  const height = Math.max(rowH, data.length * rowH) + 6

  const rows = data
    .map((d, i) => {
      const y = i * rowH + 3
      const w = Math.max(1, (Math.max(0, d.value) / max) * barW)
      const colour = d.colour ?? '#2f4f8a'
      return `
      <text x="0" y="${y + 11}" font-size="9" fill="#333">${esc(d.label)}</text>
      <rect x="${labelW}" y="${y + 2}" width="${barW}" height="11" fill="#eef1f7"/>
      <rect x="${labelW}" y="${y + 2}" width="${w.toFixed(1)}" height="11" fill="${colour}"/>
      <text x="${labelW + barW + 6}" y="${y + 11}" font-size="9" fill="#333">${esc(
        d.display ?? `${d.value}${opts.suffix ?? ''}`
      )}</text>`
    })
    .join('')

  return `<svg class="avoid-break" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">${rows}</svg>`
}

/** Column chart with a category axis — used for session-by-session attendance */
export function columnChart(
  data: BarDatum[],
  opts: { max?: number; width?: number; height?: number; suffix?: string } = {}
): string {
  const width = opts.width ?? 500
  const height = opts.height ?? 150
  const padL = 26
  const padB = 34
  const padT = 8
  const max = opts.max ?? Math.max(1, ...data.map((d) => d.value))
  const plotH = height - padB - padT
  const plotW = width - padL - 6
  const slot = data.length ? plotW / data.length : plotW
  const barW = Math.max(4, Math.min(26, slot * 0.6))

  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padT + plotH - f * plotH
      return `<line x1="${padL}" y1="${y}" x2="${width - 6}" y2="${y}" stroke="#dfe4ee" stroke-width="0.6"/>
      <text x="${padL - 4}" y="${y + 3}" font-size="7.5" fill="#77808f" text-anchor="end">${Math.round(f * max)}</text>`
    })
    .join('')

  const bars = data
    .map((d, i) => {
      const h = (Math.max(0, d.value) / max) * plotH
      const x = padL + i * slot + (slot - barW) / 2
      const y = padT + plotH - h
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(
        0.6,
        h
      ).toFixed(1)}" fill="${d.colour ?? '#2f4f8a'}"/>
      <text x="${(x + barW / 2).toFixed(1)}" y="${height - padB + 10}" font-size="7" fill="#555" text-anchor="end" transform="rotate(-38 ${(
        x +
        barW / 2
      ).toFixed(1)} ${height - padB + 10})">${esc(d.label)}</text>`
    })
    .join('')

  return `<svg class="avoid-break" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
    ${gridLines}
    <line x1="${padL}" y1="${padT + plotH}" x2="${width - 6}" y2="${padT + plotH}" stroke="#9aa4b8" stroke-width="0.8"/>
    ${bars}
  </svg>`
}

export const riskColour = (risk: string): string =>
  risk === 'high' ? '#a33' : risk === 'moderate' ? '#b8801f' : '#2f7a45'

export const attendanceColour = (pct: number): string =>
  pct >= 90 ? '#2f7a45' : pct >= 75 ? '#4a7a2f' : pct >= 60 ? '#b8801f' : '#a33'

export const pill = (risk: string, text?: string): string =>
  `<span class="pill pill-${esc(risk)}">${esc(text ?? risk.toUpperCase())}</span>`

// ── Document wrapper ────────────────────────────────────────────────────────

export function wrapDocument(opts: {
  title: string
  body: string
  extraCss?: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(opts.title)}</title>
<style>${BASE_CSS}${opts.extraCss ?? ''}</style>
</head>
<body>
${opts.body}
</body>
</html>`
}

/** Letterhead block reused by every document */
export function letterhead(opts: { university: string; department: string; documentTitle: string; subtitle?: string }): string {
  return `<div class="sheet-title">
    <div class="uni">${esc(opts.university)}</div>
    <div class="dept">${esc(opts.department)}</div>
    <div class="doc">${esc(opts.documentTitle)}</div>
    ${opts.subtitle ? `<div class="small muted">${esc(opts.subtitle)}</div>` : ''}
  </div>
  <div class="rule"></div>`
}
