import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'fydp-logger.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS faculty (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      designation TEXT,
      department TEXT DEFAULT 'Department of CSE',
      university TEXT DEFAULT 'Southeast University',
      email TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_name TEXT NOT NULL,
      project_title TEXT,
      semester TEXT,
      academic_year TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      UNIQUE(student_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS log_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      next_log_date TEXT,
      venue TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      present INTEGER DEFAULT 0,
      work_done TEXT,
      work_planned TEXT,
      faculty_notes TEXT,
      FOREIGN KEY (session_id) REFERENCES log_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      report_type TEXT NOT NULL,
      generated_content TEXT,
      edited_content TEXT,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

export function closeDb(): void {
  if (db) {
    db.close()
  }
}
