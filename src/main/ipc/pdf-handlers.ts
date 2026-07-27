/**
 * PDF generation.
 *
 * Documents are built as static HTML strings, loaded into an offscreen
 * BrowserWindow with scripting disabled, and printed by Chromium's own PDF
 * writer. That keeps the dependency list unchanged — no headless browser, no
 * PDF library — and gives the same layout engine the rest of the app uses.
 */
import { ipcMain, dialog, BrowserWindow, shell, app } from 'electron'
import fs from 'fs'
import path from 'path'
import { all, get } from '../db'
import { buildGroupAnalytics, buildPortfolioAnalytics } from '../analytics'
import {
  renderAttendanceSheetDocument,
  renderBulkAttendanceSheets,
  type SignatureMode
} from '../documents/attendance-sheet'
import { renderGroupAnalysis } from '../documents/group-analysis'
import { renderDossier } from '../documents/dossier'
import { wrapDocument, letterhead, esc, longDate } from '../documents/html'

export interface PdfResult {
  success: boolean
  path?: string
  message?: string
}

const SAFE = (s: string): string => (s || 'document').replace(/[^a-z0-9\-_. ]/gi, '_').trim()

function footerTemplate(label: string): string {
  return `<div style="width:100%;font-family:'Times New Roman',serif;font-size:8pt;color:#5b6478;
    padding:0 14mm;display:flex;justify-content:space-between;">
    <span>${esc(label)}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`
}

async function htmlToPdfBuffer(html: string, footerLabel: string): Promise<Buffer> {
  const tmpFile = path.join(app.getPath('temp'), `fydp-doc-${Date.now()}-${Math.random().toString(36).slice(2)}.html`)
  fs.writeFileSync(tmpFile, html, 'utf-8')

  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: false, sandbox: true, contextIsolation: true }
  })

  try {
    await win.loadFile(tmpFile)
    // Give Chromium a beat to lay out fonts and SVG before printing
    await new Promise((r) => setTimeout(r, 250))
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate(footerLabel),
      generateTaggedPDF: false
    })
  } finally {
    win.destroy()
    try {
      fs.unlinkSync(tmpFile)
    } catch {
      /* temp file already gone */
    }
  }
}

async function savePdf(html: string, defaultName: string, footerLabel: string, openAfter = true): Promise<PdfResult> {
  const win = BrowserWindow.getFocusedWindow()
  const { filePath, canceled } = await dialog.showSaveDialog(win!, {
    title: 'Save PDF',
    defaultPath: SAFE(defaultName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return { success: false, message: 'Cancelled' }

  const buffer = await htmlToPdfBuffer(html, footerLabel)
  fs.writeFileSync(filePath, buffer)
  if (openAfter) shell.openPath(filePath)
  return { success: true, path: filePath }
}

/** student_logs for one group, keyed by session id */
function logsForGroup(groupId: number): Map<number, any[]> {
  const sessions: any[] = all('SELECT id FROM log_sessions WHERE group_id = ? ORDER BY log_date ASC', [groupId])
  const map = new Map<number, any[]>()
  for (const s of sessions) {
    map.set(s.id, all('SELECT * FROM student_logs WHERE session_id = ?', [s.id]))
  }
  return map
}

const today = (): string => new Date().toISOString().split('T')[0]

export function registerPdfHandlers(): void {
  // ── Attendance sheets for one group ───────────────────────────────────────
  ipcMain.handle(
    'pdf:attendanceSheets',
    async (
      _e,
      groupId: number,
      options: { signatureMode?: SignatureMode; studentIds?: number[] } = {}
    ): Promise<PdfResult> => {
      const ga = buildGroupAnalytics(groupId)
      if (!ga) return { success: false, message: 'Group not found.' }
      if (!ga.students.length) return { success: false, message: 'This group has no students on the roster.' }

      const faculty = get('SELECT * FROM faculty WHERE id = 1')
      const portfolioId = `FYDP-ATT-${ga.group.id}-${today()}`
      const html = renderAttendanceSheetDocument(
        ga,
        faculty,
        { signatureMode: options.signatureMode ?? 'attested', documentId: portfolioId },
        options.studentIds
      )
      return savePdf(
        html,
        `Attendance-${ga.group.course_code || 'FYDP'}-${ga.group.group_name}-${today()}.pdf`,
        `${ga.group.group_name} — ${ga.group.course_code} attendance record`
      )
    }
  )

  // ── Attendance sheets for every group ────────────────────────────────────
  ipcMain.handle(
    'pdf:allAttendanceSheets',
    async (_e, options: { signatureMode?: SignatureMode } = {}): Promise<PdfResult> => {
      const portfolio = buildPortfolioAnalytics()
      if (!portfolio.groups.length) return { success: false, message: 'No groups on record.' }
      const html = renderBulkAttendanceSheets(portfolio.groups, portfolio.faculty, {
        signatureMode: options.signatureMode ?? 'attested',
        documentId: portfolio.document_id
      })
      return savePdf(
        html,
        `FYDP-Attendance-Sheets-All-Groups-${today()}.pdf`,
        'FYDP attendance record — all supervised groups'
      )
    }
  )

  // ── Group analysis report ───────────────────────────────────────────────
  ipcMain.handle(
    'pdf:groupAnalysis',
    async (_e, groupId: number, options: { includeTranscript?: boolean } = {}): Promise<PdfResult> => {
      const ga = buildGroupAnalytics(groupId)
      if (!ga) return { success: false, message: 'Group not found.' }
      const faculty = get('SELECT * FROM faculty WHERE id = 1')
      const html = renderGroupAnalysis(ga, faculty, {
        includeTranscript: options.includeTranscript ?? true,
        logsBySession: logsForGroup(groupId),
        documentId: `FYDP-GRP-${ga.group.id}-${today()}`
      })
      return savePdf(
        html,
        `Supervision-Analysis-${ga.group.group_name}-${today()}.pdf`,
        `${ga.group.group_name} — supervision analysis`
      )
    }
  )

  // ── Comprehensive dossier ───────────────────────────────────────────────
  ipcMain.handle(
    'pdf:dossier',
    async (
      _e,
      options: {
        includeAttendanceSheets?: boolean
        includeTranscripts?: boolean
        signatureMode?: SignatureMode
        courseFilter?: string[]
      } = {}
    ): Promise<PdfResult> => {
      const portfolio = buildPortfolioAnalytics()
      if (!portfolio.groups.length) return { success: false, message: 'No groups on record.' }
      if (!portfolio.faculty)
        return { success: false, message: 'Set up your faculty profile in Settings before generating the dossier.' }

      const logsByGroup = new Map<number, Map<number, any[]>>()
      if (options.includeTranscripts) {
        for (const g of portfolio.groups) logsByGroup.set(g.group.id, logsForGroup(g.group.id))
      }

      const html = renderDossier(portfolio, { ...options, logsByGroup })
      return savePdf(
        html,
        `FYDP-Supervision-Dossier-${SAFE(portfolio.faculty.initials || 'SUP')}-${today()}.pdf`,
        `FYDP Supervision Evidence Dossier · ${portfolio.document_id}`
      )
    }
  )

  // ── Existing AI-generated report → PDF ──────────────────────────────────
  ipcMain.handle('pdf:report', async (_e, reportId: number): Promise<PdfResult> => {
    const report: any = get('SELECT * FROM reports WHERE id = ?', [reportId])
    if (!report) return { success: false, message: 'Report not found.' }
    const group: any = get('SELECT * FROM groups WHERE id = ?', [report.group_id])
    const faculty = get('SELECT * FROM faculty WHERE id = 1')
    const content: string = report.edited_content ?? report.generated_content ?? ''

    const html = wrapDocument({
      title: `FYDP ${report.report_type} report`,
      body: `${letterhead({
        university: (faculty as any)?.university || 'Southeast University',
        department: (faculty as any)?.department || 'Department of CSE',
        documentTitle: `FYDP ${report.report_type.replace(/^./, (c: string) => c.toUpperCase())} Report`,
        subtitle: `${group?.group_name ?? ''}${group?.course_code ? ` · ${group.course_code}` : ''}`
      })}
      <div class="note warn"><strong>AI-assisted narrative.</strong> This report was drafted by a generative
      model from the logbook entries and reviewed by the supervisor. Figures quoted here should be read
      against the deterministic Supervision Analysis Report, which is computed directly from the logbook.</div>
      ${markdownToHtml(content)}
      <p class="small muted" style="margin-top:18px">Generated ${longDate(report.generated_at)} ·
      Supervisor ${esc((faculty as any)?.name ?? '')}</p>`
    })

    return savePdf(
      html,
      `FYDP-${report.report_type}-${SAFE(group?.group_name ?? 'group')}-${today()}.pdf`,
      `${group?.group_name ?? 'FYDP'} — ${report.report_type} report (AI-assisted)`
    )
  })
}

// ── Minimal Markdown renderer (shared shape with export-handlers) ──────────

function inline(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

export function markdownToHtml(md: string): string {
  const lines = (md ?? '').split('\n')
  let html = ''
  let inTable = false
  let headerDone = false
  let inList = false

  const closeList = (): void => {
    if (inList) {
      html += '</ul>\n'
      inList = false
    }
  }
  const closeTable = (): void => {
    if (inTable) {
      html += '</tbody></table>\n'
      inTable = false
      headerDone = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^#{1,4}\s/.test(line)) {
      closeList()
      closeTable()
      const level = Math.min(4, line.match(/^#+/)![0].length)
      html += `<h${level}>${inline(line.replace(/^#+\s*/, ''))}</h${level}>\n`
      continue
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue
      if (!inTable) {
        html += '<table><thead>'
        inTable = true
        headerDone = false
      }
      if (!headerDone) {
        html += `<tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`
        headerDone = true
      } else {
        html += `<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`
      }
      continue
    }
    closeTable()

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        html += '<ul>'
        inList = true
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`
      continue
    }
    closeList()

    if (!line.trim()) continue
    if (/^-{3,}$/.test(line.trim())) {
      html += '<div class="rule"></div>'
      continue
    }
    html += `<p>${inline(line)}</p>\n`
  }
  closeList()
  closeTable()
  return html
}
