import { ipcMain, dialog, BrowserWindow } from 'electron'
import { all, get, run, runTx, transaction } from '../db'
import fs from 'fs'
import path from 'path'

export function registerExportHandlers(): void {

  // ── Export to JSON ────────────────────────────────────────────────────────
  ipcMain.handle('export:toJson', async () => {
    const faculty = get('SELECT * FROM faculty WHERE id = 1')
    const groups: any[] = all('SELECT * FROM groups ORDER BY created_at ASC')

    const fullData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        version: '2.0',
        app: 'SEU FYDP Logger'
      },
      faculty,
      groups: groups.map((g) => {
        const students = all('SELECT * FROM students WHERE group_id = ? ORDER BY student_id ASC', [g.id])
        const sessions = all('SELECT * FROM log_sessions WHERE group_id = ? ORDER BY log_date ASC', [g.id])
        const sessionsWithLogs = sessions.map((s: any) => ({
          ...s,
          studentLogs: all(
            `SELECT sl.*, st.student_id as student_code, st.name as student_name
             FROM student_logs sl JOIN students st ON st.id = sl.student_id
             WHERE sl.session_id = ?`,
            [s.id]
          )
        }))
        const reports = all('SELECT * FROM reports WHERE group_id = ?', [g.id])
        return { ...g, students, sessions: sessionsWithLogs, reports }
      }),
      // Never export the API key
      settings: Object.fromEntries(
        all('SELECT key, value FROM settings')
          .filter((r: any) => r.key !== 'gemini_api_key')
          .map((r: any) => [r.key, r.value])
      )
    }

    const win = BrowserWindow.getFocusedWindow()
    const { filePath, canceled } = await dialog.showSaveDialog(win!, {
      title: 'Export FYDP Data',
      defaultPath: `fydp-export-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (canceled || !filePath) return { success: false, message: 'Cancelled' }

    fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), 'utf-8')
    return { success: true, path: filePath }
  })

  // ── Import from JSON ──────────────────────────────────────────────────────
  ipcMain.handle('export:fromJson', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePaths, canceled } = await dialog.showOpenDialog(win!, {
      title: 'Import FYDP Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) return { success: false, message: 'Cancelled' }

    let data: any
    try {
      data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
    } catch {
      return { success: false, message: 'Invalid or unreadable JSON file.' }
    }

    transaction(() => {
      if (data.faculty) {
        const f = data.faculty
        const existing = get('SELECT id FROM faculty WHERE id = 1')
        if (existing) {
          runTx(
            `UPDATE faculty SET name=?, initials=?, designation=?, department=?, university=?, email=? WHERE id=1`,
            [f.name, f.initials, f.designation, f.department, f.university, f.email]
          )
        } else {
          runTx(
            `INSERT INTO faculty (id,name,initials,designation,department,university,email) VALUES (1,?,?,?,?,?,?)`,
            [f.name, f.initials, f.designation, f.department, f.university, f.email]
          )
        }
      }

      if (Array.isArray(data.groups)) {
        for (const g of data.groups) {
          // Match on identity, not on the exported row id — ids differ across machines
          const existingGroup = get(
            `SELECT id FROM groups WHERE group_name = ? AND IFNULL(course_code,'') = IFNULL(?,'')
             AND IFNULL(semester,'') = IFNULL(?,'')`,
            [g.group_name, g.course_code ?? '', g.semester ?? '']
          )
          let groupId: number

          const groupFields = [
            g.group_name,
            g.project_title ?? null,
            g.course_code ?? null,
            g.semester ?? null,
            g.academic_year ?? null,
            g.co_supervisor_name ?? null,
            g.co_supervisor_designation ?? null,
            Number(g.min_required_sessions) || 8,
            g.status ?? 'active'
          ]

          if (existingGroup) {
            runTx(
              `UPDATE groups SET group_name=?, project_title=?, course_code=?, semester=?, academic_year=?,
                                 co_supervisor_name=?, co_supervisor_designation=?, min_required_sessions=?, status=?
               WHERE id=?`,
              [...groupFields, existingGroup.id]
            )
            groupId = existingGroup.id
          } else {
            groupId = runTx(
              `INSERT INTO groups (group_name, project_title, course_code, semester, academic_year,
                                   co_supervisor_name, co_supervisor_designation, min_required_sessions, status)
               VALUES (?,?,?,?,?,?,?,?,?)`,
              groupFields
            )
          }

          if (Array.isArray(g.students)) {
            for (const s of g.students) {
              runTx(
                `INSERT INTO students (student_id, name, program, email, mobile, group_id) VALUES (?,?,?,?,?,?)
                 ON CONFLICT(student_id, group_id) DO UPDATE SET
                   name=excluded.name, program=excluded.program,
                   email=excluded.email, mobile=excluded.mobile`,
                [
                  s.student_id,
                  s.name,
                  s.program ?? 'B.Sc. in CSE',
                  s.email ?? null,
                  s.mobile ?? null,
                  groupId
                ]
              )
            }
          }

          if (Array.isArray(g.sessions)) {
            for (const sess of g.sessions) {
              const existingSession = get(
                'SELECT id FROM log_sessions WHERE group_id = ? AND log_date = ?',
                [groupId, sess.log_date]
              )
              const sessionFields = [
                sess.log_date,
                sess.next_log_date ?? null,
                sess.venue ?? null,
                sess.start_time ?? null,
                sess.end_time ?? null,
                Number(sess.duration_minutes) || 60,
                sess.topic ?? null,
                sess.session_kind ?? 'regular'
              ]
              let sessionId: number

              if (existingSession) {
                runTx(
                  `UPDATE log_sessions SET log_date=?, next_log_date=?, venue=?, start_time=?, end_time=?,
                                           duration_minutes=?, topic=?, session_kind=? WHERE id=?`,
                  [...sessionFields, existingSession.id]
                )
                sessionId = existingSession.id
              } else {
                sessionId = runTx(
                  `INSERT INTO log_sessions (group_id, log_date, next_log_date, venue, start_time, end_time,
                                             duration_minutes, topic, session_kind)
                   VALUES (?,?,?,?,?,?,?,?,?)`,
                  [groupId, ...sessionFields]
                )
              }

              if (Array.isArray(sess.studentLogs)) {
                for (const sl of sess.studentLogs) {
                  const student = get(
                    'SELECT id FROM students WHERE student_id = ? AND group_id = ?',
                    [sl.student_code, groupId]
                  )
                  if (!student) continue
                  runTx(
                    `INSERT INTO student_logs (session_id, student_id, present, work_done, work_planned, faculty_notes)
                     VALUES (?,?,?,?,?,?)
                     ON CONFLICT(session_id, student_id) DO UPDATE SET
                       present=excluded.present, work_done=excluded.work_done,
                       work_planned=excluded.work_planned, faculty_notes=excluded.faculty_notes`,
                    [sessionId, student.id, sl.present ? 1 : 0, sl.work_done, sl.work_planned, sl.faculty_notes]
                  )
                }
              }
            }
          }

          if (Array.isArray(g.reports)) {
            for (const r of g.reports) {
              const existingReport = get(
                'SELECT id FROM reports WHERE group_id = ? AND report_type = ? AND generated_at = ?',
                [groupId, r.report_type, r.generated_at]
              )
              if (existingReport) continue
              runTx(
                `INSERT INTO reports (group_id, report_type, generated_content, edited_content, generated_at)
                 VALUES (?,?,?,?,?)`,
                [groupId, r.report_type, r.generated_content, r.edited_content ?? r.generated_content, r.generated_at]
              )
            }
          }
        }
      }

      if (data.settings) {
        for (const [k, v] of Object.entries(data.settings)) {
          if (k === 'gemini_api_key') continue
          runTx(
            `INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
            [k, v as string]
          )
        }
      }
    })

    return { success: true }
  })

  // ── Export report as HTML ─────────────────────────────────────────────────
  ipcMain.handle('export:reportAsHtml', async (_e, reportId: number) => {
    const report: any = get('SELECT * FROM reports WHERE id = ?', [reportId])
    if (!report) return { success: false, message: 'Report not found' }

    const content = report.edited_content ?? report.generated_content ?? ''
    const html = wrapHtml(content)

    const win = BrowserWindow.getFocusedWindow()
    const { filePath, canceled } = await dialog.showSaveDialog(win!, {
      title: 'Save Report',
      defaultPath: `fydp-report-${report.report_type}-${new Date().toISOString().split('T')[0]}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }]
    })

    if (canceled || !filePath) return { success: false, message: 'Cancelled' }

    fs.writeFileSync(filePath, html, 'utf-8')
    return { success: true, path: filePath }
  })
}

function wrapHtml(md: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FYDP Report — Southeast University</title>
<style>
  body { font-family: 'Times New Roman', serif; max-width: 820px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #111; }
  h1,h2,h3 { color: #1e3a8a; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th,td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #dbeafe; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  code { background: #f3f4f6; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>${markdownToHtml(md)}</body>
</html>`
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  let html = ''
  let inTable = false

  for (const line of lines) {
    if (line.startsWith('### ')) { html += `<h3>${inline(line.slice(4))}</h3>\n`; inTable = false }
    else if (line.startsWith('## ')) { html += `<h2>${inline(line.slice(3))}</h2>\n`; inTable = false }
    else if (line.startsWith('# ')) { html += `<h1>${inline(line.slice(2))}</h1>\n`; inTable = false }
    else if (line.startsWith('| ') && line.endsWith(' |')) {
      if (!inTable) { html += '<table>\n'; inTable = true }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim())
      // Skip separator rows (---|---|---)
      if (cells.every((c) => /^-+$/.test(c))) continue
      html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>\n'
    } else {
      if (inTable) { html += '</table>\n'; inTable = false }
      if (line.trim() === '') html += '<br>\n'
      else html += `<p>${inline(line)}</p>\n`
    }
  }
  if (inTable) html += '</table>\n'
  return html
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}
