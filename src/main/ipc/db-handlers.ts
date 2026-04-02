import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerDbHandlers(): void {
  const db = () => getDb()

  // ── Faculty ──────────────────────────────────────────────────────────────
  ipcMain.handle('faculty:get', () => {
    return db().prepare('SELECT * FROM faculty WHERE id = 1').get() ?? null
  })

  ipcMain.handle('faculty:save', (_e, data) => {
    const existing = db().prepare('SELECT id FROM faculty WHERE id = 1').get()
    if (existing) {
      db()
        .prepare(
          `UPDATE faculty SET name=?, initials=?, designation=?, department=?, university=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=1`
        )
        .run(data.name, data.initials, data.designation, data.department, data.university, data.email)
    } else {
      db()
        .prepare(
          `INSERT INTO faculty (id, name, initials, designation, department, university, email) VALUES (1,?,?,?,?,?,?)`
        )
        .run(data.name, data.initials, data.designation, data.department, data.university, data.email)
    }
    return db().prepare('SELECT * FROM faculty WHERE id = 1').get()
  })

  // ── Groups ────────────────────────────────────────────────────────────────
  ipcMain.handle('groups:getAll', () => {
    return db().prepare('SELECT * FROM groups ORDER BY created_at DESC').all()
  })

  ipcMain.handle('groups:create', (_e, data) => {
    const result = db()
      .prepare(
        `INSERT INTO groups (group_name, project_title, semester, academic_year) VALUES (?,?,?,?)`
      )
      .run(data.group_name, data.project_title, data.semester, data.academic_year)
    return db().prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('groups:update', (_e, id, data) => {
    db()
      .prepare(
        `UPDATE groups SET group_name=?, project_title=?, semester=?, academic_year=? WHERE id=?`
      )
      .run(data.group_name, data.project_title, data.semester, data.academic_year, id)
    return db().prepare('SELECT * FROM groups WHERE id = ?').get(id)
  })

  ipcMain.handle('groups:delete', (_e, id) => {
    db().prepare('DELETE FROM groups WHERE id = ?').run(id)
    return true
  })

  // ── Students ──────────────────────────────────────────────────────────────
  ipcMain.handle('students:getByGroup', (_e, groupId) => {
    return db()
      .prepare('SELECT * FROM students WHERE group_id = ? ORDER BY student_id ASC')
      .all(groupId)
  })

  ipcMain.handle('students:add', (_e, data) => {
    const result = db()
      .prepare(`INSERT INTO students (student_id, name, group_id) VALUES (?,?,?)`)
      .run(data.student_id, data.name, data.group_id)
    return db().prepare('SELECT * FROM students WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('students:update', (_e, id, data) => {
    db()
      .prepare(`UPDATE students SET student_id=?, name=? WHERE id=?`)
      .run(data.student_id, data.name, id)
    return db().prepare('SELECT * FROM students WHERE id = ?').get(id)
  })

  ipcMain.handle('students:delete', (_e, id) => {
    db().prepare('DELETE FROM students WHERE id = ?').run(id)
    return true
  })

  // ── Log Sessions ──────────────────────────────────────────────────────────
  ipcMain.handle('sessions:getByGroup', (_e, groupId) => {
    return db()
      .prepare('SELECT * FROM log_sessions WHERE group_id = ? ORDER BY log_date DESC')
      .all(groupId)
  })

  ipcMain.handle('sessions:create', (_e, data) => {
    const result = db()
      .prepare(
        `INSERT INTO log_sessions (group_id, log_date, next_log_date, venue) VALUES (?,?,?,?)`
      )
      .run(data.group_id, data.log_date, data.next_log_date, data.venue)
    const session = db()
      .prepare('SELECT * FROM log_sessions WHERE id = ?')
      .get(result.lastInsertRowid)

    // Pre-create student_log rows for all students in this group
    const students: any[] = db()
      .prepare('SELECT id FROM students WHERE group_id = ?')
      .all(data.group_id)
    const insertLog = db().prepare(
      `INSERT OR IGNORE INTO student_logs (session_id, student_id, present) VALUES (?,?,0)`
    )
    const insertMany = db().transaction(() => {
      for (const s of students) {
        insertLog.run(result.lastInsertRowid, s.id)
      }
    })
    insertMany()
    return session
  })

  ipcMain.handle('sessions:update', (_e, id, data) => {
    db()
      .prepare(`UPDATE log_sessions SET log_date=?, next_log_date=?, venue=? WHERE id=?`)
      .run(data.log_date, data.next_log_date, data.venue, id)
    return db().prepare('SELECT * FROM log_sessions WHERE id = ?').get(id)
  })

  ipcMain.handle('sessions:delete', (_e, id) => {
    db().prepare('DELETE FROM log_sessions WHERE id = ?').run(id)
    return true
  })

  // ── Student Logs ──────────────────────────────────────────────────────────
  ipcMain.handle('studentLogs:getBySession', (_e, sessionId) => {
    return db()
      .prepare(
        `SELECT sl.*, s.student_id as student_code, s.name as student_name
         FROM student_logs sl
         JOIN students s ON s.id = sl.student_id
         WHERE sl.session_id = ?
         ORDER BY s.student_id ASC`
      )
      .all(sessionId)
  })

  ipcMain.handle('studentLogs:save', (_e, data) => {
    db()
      .prepare(
        `INSERT INTO student_logs (session_id, student_id, present, work_done, work_planned, faculty_notes)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(session_id, student_id) DO UPDATE SET
           present=excluded.present,
           work_done=excluded.work_done,
           work_planned=excluded.work_planned,
           faculty_notes=excluded.faculty_notes`
      )
      .run(
        data.session_id,
        data.student_id,
        data.present ? 1 : 0,
        data.work_done,
        data.work_planned,
        data.faculty_notes
      )
    return true
  })

  // ── Reports ───────────────────────────────────────────────────────────────
  ipcMain.handle('reports:getByGroup', (_e, groupId) => {
    return db()
      .prepare('SELECT * FROM reports WHERE group_id = ? ORDER BY generated_at DESC')
      .all(groupId)
  })

  ipcMain.handle('reports:save', (_e, data) => {
    const result = db()
      .prepare(
        `INSERT INTO reports (group_id, report_type, generated_content, edited_content) VALUES (?,?,?,?)`
      )
      .run(data.group_id, data.report_type, data.generated_content, data.generated_content)
    return db().prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid)
  })

  ipcMain.handle('reports:updateEdited', (_e, id, editedContent) => {
    db().prepare(`UPDATE reports SET edited_content=? WHERE id=?`).run(editedContent, id)
    return true
  })

  ipcMain.handle('reports:delete', (_e, id) => {
    db().prepare('DELETE FROM reports WHERE id = ?').run(id)
    return true
  })

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => {
    const rows: any[] = db().prepare('SELECT key, value FROM settings').all()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  })

  ipcMain.handle('settings:set', (_e, key, value) => {
    db()
      .prepare(`INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
      .run(key, value)
    return true
  })
}
