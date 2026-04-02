import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import initSqlJs, { type Database } from 'sql.js'

let _db: Database
let _dbPath: string

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  // Dev: wasm in node_modules. Packaged app: copied to resourcesPath via extraResources in package.json.
  const wasmPath = app.isPackaged
    ? path.join(process.resourcesPath, 'sql-wasm.wasm')
    : path.join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')

  const SQL = await initSqlJs({ wasmBinary: fs.readFileSync(wasmPath) })

  _dbPath = path.join(app.getPath('userData'), 'fydp-logger.db')

  if (fs.existsSync(_dbPath)) {
    const buf = fs.readFileSync(_dbPath)
    _db = new SQL.Database(buf)
  } else {
    _db = new SQL.Database()
  }

  _db.run('PRAGMA foreign_keys = ON')
  initSchema()
  persist()
}

// ── Persistence ───────────────────────────────────────────────────────────────

function persist(): void {
  const data = _db.export()
  fs.writeFileSync(_dbPath, Buffer.from(data))
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function all(sql: string, params: any[] = []): any[] {
  const stmt = _db.prepare(sql)
  if (params.length) stmt.bind(params)
  const rows: any[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function get(sql: string, params: any[] = []): any {
  return all(sql, params)[0] ?? null
}

// Runs a statement, persists to disk, returns last insert rowid
export function run(sql: string, params: any[] = []): number {
  _db.run(sql, params)
  const res = _db.exec('SELECT last_insert_rowid()')
  const id = (res[0]?.values[0]?.[0] as number) ?? 0
  persist()
  return id
}

// Same but does NOT persist — use inside transaction() only
export function runTx(sql: string, params: any[] = []): number {
  _db.run(sql, params)
  const res = _db.exec('SELECT last_insert_rowid()')
  return (res[0]?.values[0]?.[0] as number) ?? 0
}

export function transaction(fn: () => void): void {
  _db.run('BEGIN TRANSACTION')
  try {
    fn()
    _db.run('COMMIT')
    persist()
  } catch (e) {
    _db.run('ROLLBACK')
    throw e
  }
}

export function closeDb(): void {
  if (_db) {
    persist()
    _db.close()
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

function initSchema(): void {
  _db.exec(`
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
