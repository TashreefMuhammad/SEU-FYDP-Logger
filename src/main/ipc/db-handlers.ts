import { ipcMain } from 'electron'
import { all, get, run, runTx, transaction } from '../db'

export function registerDbHandlers(): void {

  // ── Faculty ──────────────────────────────────────────────────────────────
  ipcMain.handle('faculty:get', () => {
    return get('SELECT * FROM faculty WHERE id = 1')
  })

  ipcMain.handle('faculty:save', (_e, data) => {
    const existing = get('SELECT id FROM faculty WHERE id = 1')
    if (existing) {
      run(
        `UPDATE faculty SET name=?, initials=?, designation=?, department=?, university=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`,
        [data.name, data.initials, data.designation, data.department, data.university, data.email]
      )
    } else {
      run(
        `INSERT INTO faculty (id, name, initials, designation, department, university, email) VALUES (1,?,?,?,?,?,?)`,
        [data.name, data.initials, data.designation, data.department, data.university, data.email]
      )
    }
    return get('SELECT * FROM faculty WHERE id = 1')
  })

  // ── Groups ────────────────────────────────────────────────────────────────
  ipcMain.handle('groups:getAll', () => {
    return all('SELECT * FROM groups ORDER BY created_at DESC')
  })

  ipcMain.handle('groups:create', (_e, data) => {
    const id = run(
      `INSERT INTO groups (group_name, project_title, course_code, semester, academic_year,
                           co_supervisor_name, co_supervisor_designation, min_required_sessions, status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        data.group_name,
        data.project_title,
        data.course_code,
        data.semester,
        data.academic_year,
        data.co_supervisor_name ?? null,
        data.co_supervisor_designation ?? null,
        Number(data.min_required_sessions) || 8,
        data.status ?? 'active'
      ]
    )
    return get('SELECT * FROM groups WHERE id = ?', [id])
  })

  ipcMain.handle('groups:update', (_e, id, data) => {
    run(
      `UPDATE groups SET group_name=?, project_title=?, course_code=?, semester=?, academic_year=?,
                         co_supervisor_name=?, co_supervisor_designation=?, min_required_sessions=?, status=?
       WHERE id=?`,
      [
        data.group_name,
        data.project_title,
        data.course_code,
        data.semester,
        data.academic_year,
        data.co_supervisor_name ?? null,
        data.co_supervisor_designation ?? null,
        Number(data.min_required_sessions) || 8,
        data.status ?? 'active',
        id
      ]
    )
    return get('SELECT * FROM groups WHERE id = ?', [id])
  })

  ipcMain.handle('groups:delete', (_e, id) => {
    run('DELETE FROM groups WHERE id = ?', [id])
    return true
  })

  // ── Students ──────────────────────────────────────────────────────────────
  ipcMain.handle('students:getByGroup', (_e, groupId) => {
    return all('SELECT * FROM students WHERE group_id = ? ORDER BY student_id ASC', [groupId])
  })

  ipcMain.handle('students:add', (_e, data) => {
    const id = run(
      `INSERT INTO students (student_id, name, program, email, mobile, group_id) VALUES (?,?,?,?,?,?)`,
      [
        data.student_id,
        data.name,
        data.program ?? 'B.Sc. in CSE',
        data.email ?? autoEmail(data.student_id),
        data.mobile ?? null,
        data.group_id
      ]
    )
    return get('SELECT * FROM students WHERE id = ?', [id])
  })

  ipcMain.handle('students:update', (_e, id, data) => {
    run(
      `UPDATE students SET student_id=?, name=?, program=?, email=?, mobile=? WHERE id=?`,
      [
        data.student_id,
        data.name,
        data.program ?? 'B.Sc. in CSE',
        data.email ?? autoEmail(data.student_id),
        data.mobile ?? null,
        id
      ]
    )
    return get('SELECT * FROM students WHERE id = ?', [id])
  })

  ipcMain.handle('students:delete', (_e, id) => {
    run('DELETE FROM students WHERE id = ?', [id])
    return true
  })

  // ── Log Sessions ──────────────────────────────────────────────────────────
  ipcMain.handle('sessions:getByGroup', (_e, groupId) => {
    return all('SELECT * FROM log_sessions WHERE group_id = ? ORDER BY log_date DESC', [groupId])
  })

  ipcMain.handle('sessions:create', (_e, data) => {
    let sessionId = 0
    transaction(() => {
      sessionId = runTx(
        `INSERT INTO log_sessions (group_id, log_date, next_log_date, venue,
                                   start_time, end_time, duration_minutes, topic, session_kind)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          data.group_id,
          data.log_date,
          data.next_log_date,
          data.venue,
          data.start_time ?? null,
          data.end_time ?? null,
          resolveDuration(data),
          data.topic ?? null,
          data.session_kind ?? 'regular'
        ]
      )
      const students = all('SELECT id FROM students WHERE group_id = ?', [data.group_id])
      for (const s of students) {
        runTx(
          `INSERT OR IGNORE INTO student_logs (session_id, student_id, present) VALUES (?,?,0)`,
          [sessionId, s.id]
        )
      }
    })
    return get('SELECT * FROM log_sessions WHERE id = ?', [sessionId])
  })

  ipcMain.handle('sessions:update', (_e, id, data) => {
    run(
      `UPDATE log_sessions SET log_date=?, next_log_date=?, venue=?,
                               start_time=?, end_time=?, duration_minutes=?, topic=?, session_kind=?
       WHERE id=?`,
      [
        data.log_date,
        data.next_log_date,
        data.venue,
        data.start_time ?? null,
        data.end_time ?? null,
        resolveDuration(data),
        data.topic ?? null,
        data.session_kind ?? 'regular',
        id
      ]
    )
    return get('SELECT * FROM log_sessions WHERE id = ?', [id])
  })

  ipcMain.handle('sessions:delete', (_e, id) => {
    run('DELETE FROM log_sessions WHERE id = ?', [id])
    return true
  })

  // ── Student Logs ──────────────────────────────────────────────────────────
  ipcMain.handle('studentLogs:getBySession', (_e, sessionId) => {
    return all(
      `SELECT sl.*, s.student_id as student_code, s.name as student_name
       FROM student_logs sl
       JOIN students s ON s.id = sl.student_id
       WHERE sl.session_id = ?
       ORDER BY s.student_id ASC`,
      [sessionId]
    )
  })

  ipcMain.handle('studentLogs:save', (_e, data) => {
    run(
      `INSERT INTO student_logs (session_id, student_id, present, work_done, work_planned, faculty_notes)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(session_id, student_id) DO UPDATE SET
         present=excluded.present,
         work_done=excluded.work_done,
         work_planned=excluded.work_planned,
         faculty_notes=excluded.faculty_notes`,
      [
        data.session_id,
        data.student_id,
        data.present ? 1 : 0,
        data.work_done ?? null,
        data.work_planned ?? null,
        data.faculty_notes ?? null
      ]
    )
    return true
  })

  // ── Reports ───────────────────────────────────────────────────────────────
  ipcMain.handle('reports:getByGroup', (_e, groupId) => {
    return all('SELECT * FROM reports WHERE group_id = ? ORDER BY generated_at DESC', [groupId])
  })

  ipcMain.handle('reports:save', (_e, data) => {
    const id = run(
      `INSERT INTO reports (group_id, report_type, generated_content, edited_content) VALUES (?,?,?,?)`,
      [data.group_id, data.report_type, data.generated_content, data.generated_content]
    )
    return get('SELECT * FROM reports WHERE id = ?', [id])
  })

  ipcMain.handle('reports:updateEdited', (_e, id, editedContent) => {
    run(`UPDATE reports SET edited_content=? WHERE id=?`, [editedContent, id])
    return true
  })

  ipcMain.handle('reports:delete', (_e, id) => {
    run('DELETE FROM reports WHERE id = ?', [id])
    return true
  })

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    const rows = all('SELECT key, value FROM settings')
    return Object.fromEntries(rows.map((r: any) => [r.key, r.value]))
  })

  ipcMain.handle('settings:set', (_e, key, value) => {
    run(
      `INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value]
    )
    return true
  })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** SEU convention: <13-digit student code>@seu.edu.bd */
function autoEmail(studentCode?: string): string | null {
  return studentCode && /^\d{13}$/.test(studentCode) ? `${studentCode}@seu.edu.bd` : null
}

/** Duration is derived from start/end when both are present, else taken as given */
function resolveDuration(data: any): number {
  const explicit = Number(data.duration_minutes)
  if (data.start_time && data.end_time) {
    const [sh, sm] = String(data.start_time).split(':').map(Number)
    const [eh, em] = String(data.end_time).split(':').map(Number)
    if ([sh, sm, eh, em].every((n) => Number.isFinite(n))) {
      const mins = eh * 60 + em - (sh * 60 + sm)
      if (mins > 0) return mins
    }
  }
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 60
}
