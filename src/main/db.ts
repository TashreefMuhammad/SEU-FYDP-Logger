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
  migrate()
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

// Runs once on startup — safely adds new columns to existing databases.
// Each ALTER is independent: if the column already exists, sql.js throws and we ignore it.
const MIGRATIONS: [table: string, column: string, definition: string][] = [
  // Group / supervision metadata
  ['groups', 'course_code', 'TEXT'],
  ['groups', 'co_supervisor_name', 'TEXT'],
  ['groups', 'co_supervisor_designation', 'TEXT'],
  ['groups', 'min_required_sessions', 'INTEGER'],
  ['groups', 'status', 'TEXT'],

  // Student fields required by the departmental attendance sheet
  ['students', 'program', 'TEXT'],
  ['students', 'email', 'TEXT'],
  ['students', 'mobile', 'TEXT'],

  // Session fields required by the departmental attendance sheet
  ['log_sessions', 'start_time', 'TEXT'],
  ['log_sessions', 'end_time', 'TEXT'],
  ['log_sessions', 'duration_minutes', 'INTEGER'],
  ['log_sessions', 'topic', 'TEXT'],
  ['log_sessions', 'session_kind', 'TEXT']
]

function migrate(): void {
  for (const [table, column, definition] of MIGRATIONS) {
    try {
      _db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch {
      /* column already exists */
    }
  }
  // Sensible defaults for rows that predate the new columns
  try { _db.exec(`UPDATE groups SET min_required_sessions = 8 WHERE min_required_sessions IS NULL`) } catch { /* noop */ }
  try { _db.exec(`UPDATE groups SET status = 'active' WHERE status IS NULL OR status = ''`) } catch { /* noop */ }
  try { _db.exec(`UPDATE students SET program = 'B.Sc. in CSE' WHERE program IS NULL OR program = ''`) } catch { /* noop */ }
  try { _db.exec(`UPDATE log_sessions SET duration_minutes = 60 WHERE duration_minutes IS NULL`) } catch { /* noop */ }
}

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
      course_code TEXT,
      semester TEXT,
      academic_year TEXT,
      co_supervisor_name TEXT,
      co_supervisor_designation TEXT,
      min_required_sessions INTEGER DEFAULT 8,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      program TEXT DEFAULT 'B.Sc. in CSE',
      email TEXT,
      mobile TEXT,
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
      start_time TEXT,
      end_time TEXT,
      duration_minutes INTEGER DEFAULT 60,
      topic TEXT,
      session_kind TEXT DEFAULT 'regular',
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
