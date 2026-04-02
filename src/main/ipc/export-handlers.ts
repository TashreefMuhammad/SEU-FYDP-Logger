import { ipcMain, dialog, BrowserWindow } from 'electron'
import { getDb } from '../db'
import fs from 'fs'
import path from 'path'

export function registerExportHandlers(): void {
  // ── Export to JSON ────────────────────────────────────────────────────────
  ipcMain.handle('export:toJson', async (_e) => {
    const db = getDb()

    const faculty = db.prepare('SELECT * FROM faculty WHERE id = 1').get()
    const groups: any[] = db.prepare('SELECT * FROM groups ORDER BY created_at ASC').all()

    const fullData = {
      _meta: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        app: 'FYDP Logger'
      },
      faculty,
      groups: groups.map((g) => {
        const students: any[] = db
          .prepare('SELECT * FROM students WHERE group_id = ? ORDER BY student_id ASC')
          .all(g.id)
        const sessions: any[] = db
          .prepare('SELECT * FROM log_sessions WHERE group_id = ? ORDER BY log_date ASC')
          .all(g.id)
        const sessionsWithLogs = sessions.map((s) => ({
          ...s,
          studentLogs: db
            .prepare(
              `SELECT sl.*, st.student_id as student_code, st.name as student_name
               FROM student_logs sl JOIN students st ON st.id = sl.student_id
               WHERE sl.session_id = ?`
            )
            .all(s.id)
        }))
        const reports: any[] = db
          .prepare('SELECT * FROM reports WHERE group_id = ?')
          .all(g.id)

        return { ...g, students, sessions: sessionsWithLogs, reports }
      }),
      settings: Object.fromEntries(
        (db.prepare('SELECT key, value FROM settings').all() as any[])
          .filter((r) => r.key !== 'gemini_api_key') // never export the API key
          .map((r) => [r.key, r.value])
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
  ipcMain.handle('export:fromJson', async (_e) => {
    const win = BrowserWindow.getFocusedWindow()
    const { filePaths, canceled } = await dialog.showOpenDialog(win!, {
      title: 'Import FYDP Data',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) return { success: false, message: 'Cancelled' }

    let raw: string
    try {
      raw = fs.readFileSync(filePaths[0], 'utf-8')
    } catch {
      return { success: false, message: 'Could not read file.' }
    }

    let data: any
    try {
      data = JSON.parse(raw)
    } catch {
      return { success: false, message: 'Invalid JSON file.' }
    }

    const db = getDb()

    db.transaction(() => {
      // Faculty
      if (data.faculty) {
        const f = data.faculty
        const existing = db.prepare('SELECT id FROM faculty WHERE id = 1').get()
        if (existing) {
          db.prepare(
            `UPDATE faculty SET name=?, initials=?, designation=?, department=?, university=?, email=? WHERE id=1`
          ).run(f.name, f.initials, f.designation, f.department, f.university, f.email)
        } else {
          db.prepare(
            `INSERT INTO faculty (id,name,initials,designation,department,university,email) VALUES (1,?,?,?,?,?,?)`
          ).run(f.name, f.initials, f.designation, f.department, f.university, f.email)
        }
      }

      // Groups & children
      if (Array.isArray(data.groups)) {
        for (const g of data.groups) {
          // Upsert group by id
          const existingGroup: any = db.prepare('SELECT id FROM groups WHERE id = ?').get(g.id)
          let groupId: number
          if (existingGroup) {
            db.prepare(
              `UPDATE groups SET group_name=?, project_title=?, semester=?, academic_year=? WHERE id=?`
            ).run(g.group_name, g.project_title, g.semester, g.academic_year, g.id)
            groupId = g.id
          } else {
            const r = db
              .prepare(
                `INSERT INTO groups (group_name, project_title, semester, academic_year) VALUES (?,?,?,?)`
              )
              .run(g.group_name, g.project_title, g.semester, g.academic_year)
            groupId = r.lastInsertRowid as number
          }

          // Students
          if (Array.isArray(g.students)) {
            for (const s of g.students) {
              db.prepare(
                `INSERT INTO students (student_id, name, group_id) VALUES (?,?,?)
                 ON CONFLICT(student_id, group_id) DO UPDATE SET name=excluded.name`
              ).run(s.student_id, s.name, groupId)
            }
          }

          // Sessions & logs
          if (Array.isArray(g.sessions)) {
            for (const sess of g.sessions) {
              const existingSession: any = db
                .prepare('SELECT id FROM log_sessions WHERE id = ?')
                .get(sess.id)
              let sessionId: number
              if (existingSession) {
                db.prepare(
                  `UPDATE log_sessions SET log_date=?, next_log_date=?, venue=? WHERE id=?`
                ).run(sess.log_date, sess.next_log_date, sess.venue, sess.id)
                sessionId = sess.id
              } else {
                const r = db
                  .prepare(
                    `INSERT INTO log_sessions (group_id, log_date, next_log_date, venue) VALUES (?,?,?,?)`
                  )
                  .run(groupId, sess.log_date, sess.next_log_date, sess.venue)
                sessionId = r.lastInsertRowid as number
              }

              if (Array.isArray(sess.studentLogs)) {
                for (const sl of sess.studentLogs) {
                  const student: any = db
                    .prepare('SELECT id FROM students WHERE student_id = ? AND group_id = ?')
                    .get(sl.student_code, groupId)
                  if (!student) continue
                  db.prepare(
                    `INSERT INTO student_logs (session_id, student_id, present, work_done, work_planned, faculty_notes)
                     VALUES (?,?,?,?,?,?)
                     ON CONFLICT(session_id, student_id) DO UPDATE SET
                       present=excluded.present, work_done=excluded.work_done,
                       work_planned=excluded.work_planned, faculty_notes=excluded.faculty_notes`
                  ).run(sessionId, student.id, sl.present, sl.work_done, sl.work_planned, sl.faculty_notes)
                }
              }
            }
          }
        }
      }

      // Settings (skip api key)
      if (data.settings) {
        for (const [k, v] of Object.entries(data.settings)) {
          if (k === 'gemini_api_key') continue
          db.prepare(
            `INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
          ).run(k, v as string)
        }
      }
    })()

    return { success: true }
  })

  // ── Export report as HTML file ────────────────────────────────────────────
  ipcMain.handle('export:reportAsHtml', async (_e, reportId: number) => {
    const db = getDb()
    const report: any = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
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

function wrapHtml(markdownContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FYDP Report</title>
<style>
  body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
  h1,h2,h3 { color: #1e3a8a; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th,td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #dbeafe; }
  pre { background: #f3f4f6; padding: 12px; border-radius: 4px; overflow-x: auto; }
  code { background: #f3f4f6; padding: 2px 4px; border-radius: 3px; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<div id="content">
${markdownToHtml(markdownContent)}
</div>
</body>
</html>`
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.split('|').filter((c) => c.trim())
      return '<tr>' + cells.map((c) => `<td>${c.trim()}</td>`).join('') + '</tr>'
    })
    .replace(/(<tr>[\s\S]+?<\/tr>)/g, '<table>$1</table>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[htp])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
}
