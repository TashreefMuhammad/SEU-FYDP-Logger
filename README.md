# SEU FYDP Logger

A desktop application for FYDP (Final Year Design Project) supervision logging and report generation at **Southeast University, Bangladesh**.

Built as a practical workaround for faculty supervisors to log sessions, track attendance, and generate formal reports — until the university's UMS integrates this natively.

---

## Features

- **Group & Student Management** — Create groups per course (CSE460/461/462), add students with validated 13-digit SEU student IDs
- **Session Logging** — Log each supervision session with date, attendance, work done, work planned, and supervisor notes per student
- **AI Report Generation** — Generate formal reports (attendance, progress, contribution analysis, overall summary) via the Gemini API
- **Inline Report Editing** — Edit AI-generated reports before exporting
- **Export Reports** — Save reports as HTML files (printable)
- **JSON Import/Export** — Export all data as a portable `.json` file to work from home or share with a co-supervisor; import merges without data loss
- **Faculty Profile** — Supervisor name, initials, designation appear on all generated reports

## Supported FYDP Courses

| Code | Course |
|---|---|
| CSE460 | Final Year Design Project I |
| CSE461 | Final Year Design Project II |
| CSE462 | Final Year Design Project III |

---

## Download (Windows)

Go to the [Releases](../../releases/latest) page and download the latest `FYDP-Logger-Setup-x.x.x.exe` installer.

No Node.js or any other tools required — just install and run.

---

## For Developers

### Prerequisites

- [Node.js](https://nodejs.org) LTS (v20 or v22 recommended)
- Windows (currently Windows-only build target)

### Getting Started

```bash
git clone https://github.com/tashreefmuhammad/SEU-FYDP-Logger.git
cd SEU-FYDP-Logger
npm install
npm run dev
```

### Build Windows Installer

```bash
npm run dist
```

Output: `dist/FYDP Logger Setup x.x.x.exe`

### Project Structure

```
src/
├── main/               # Electron main process (Node.js)
│   ├── db.ts           # SQLite database via sql.js (WebAssembly)
│   └── ipc/
│       ├── db-handlers.ts      # CRUD operations
│       ├── gemini-handlers.ts  # Gemini AI report generation
│       └── export-handlers.ts  # JSON and HTML export/import
├── preload/            # Exposes window.api to the renderer
└── renderer/src/       # React + TypeScript frontend
    ├── pages/          # Dashboard, Groups, LogSession, Reports, ImportExport, Settings
    ├── components/     # Layout, Sidebar, UI primitives
    └── lib/            # Zustand store, utilities
```

### Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + TypeScript + Tailwind CSS |
| Database | SQLite via [sql.js](https://sql-js.github.io/sql.js/) (pure WASM — no compilation) |
| Charts | Apache ECharts |
| AI Reports | Google Gemini API (`gemini-2.0-flash`) |
| Build | electron-vite + electron-builder |

---

## First-Time Setup (in the app)

1. **Settings** → Enter your name, initials, designation → Save Gemini API key
   - Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Groups & Students** → Create a group (select the FYDP course) → Add students
3. **Log Session** → Select a group → New Session → Mark attendance + enter notes
4. **Reports** → Select a group → Generate report via Gemini → Edit → Export as HTML

---

## Data & Privacy

- All data is stored locally in `%APPDATA%\fydp-logger\fydp-logger.db`
- Your Gemini API key is stored locally and is **never** included in JSON exports
- Log data is sent to the Gemini API only when you explicitly click "Generate Report"

---

## License

MIT — feel free to adapt for your own institution.

---

*Produced with the help of Claude Sonnet 4.6*
