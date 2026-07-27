# SEU FYDP Logger

A desktop application for FYDP (Final Year Design Project) supervision logging and report generation at **Southeast University, Bangladesh**.

Built as a practical workaround for faculty supervisors to log sessions, track attendance, and generate formal reports — until the university's UMS integrates this natively.

---

## Features

- **Group & Student Management** — Create groups per course (CSE460/461/462), add students with validated 13-digit SEU student IDs, program, email and mobile; record an assigned Co-Supervisor and the semester's minimum session count
- **Session Logging** — Log each supervision session with date, start/end time, topic of discussion, venue, attendance, work done, work planned, and supervisor notes per student
- **Analysis Portal** — A deterministic dashboard computed arithmetically from the logbook: attendance, cadence, documentation completeness, contribution balance, engagement, derived assessment indicators, Guideline compliance matrix, supervision-load caps and a risk register. No AI involved
- **Departmental Attendance Sheets (PDF)** — The official per-student form, one page per student, with the signature column replaced by a verifiable attendance record (or kept blank for wet signatures)
- **Group Supervision Analysis (PDF)** — Session register, attendance matrix, per-student analysis, derived indicators and the full logbook transcript
- **Comprehensive Supervision Dossier (PDF)** — The accreditation-facing document: portfolio summary, compliance matrix against the FYDP Guideline, per-group dossiers, risk register, evidence provenance, stated limitations, declaration and appendices
- **AI Report Generation** — Narrative reports (attendance, progress, contribution analysis, overall summary) via the Gemini API, exportable as PDF or HTML
- **JSON Import/Export** — Export all data as a portable `.json` file to work from home or share with a co-supervisor; import merges without data loss
- **Feedback & error surfacing** — Every create, update and delete raises a brief confirmation in the top-right corner; failures raise a persistent card carrying the real database message, expandable and copyable for diagnosis. Uncaught exceptions anywhere in the interface are captured and shown the same way
- **Refresh data** — A button in the sidebar re-queries every page from the database on demand, for when a change was made elsewhere (an import, a second window) and the screen is stale
- **Faculty Profile** — Supervisor name, initials, designation appear on all generated documents

### Deterministic vs AI-generated

The application draws a hard line between the two. Everything in the **Analysis Portal** and in the three
PDF documents above is computed from stored rows and is reproducible: regenerating from an unchanged
database yields the same figures and the same checksums. The **AI Reports** page is a separate narrative
aid and is deliberately excluded from the dossier, so nothing placed in front of a board or an
accreditation panel depends on a generative model.

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
│   ├── analytics.ts    # Deterministic metrics, flags and Guideline compliance
│   ├── documents/      # Print templates (pure HTML string builders)
│   │   ├── html.ts             # Shared print CSS, inline SVG charts, helpers
│   │   ├── attendance-sheet.ts # Departmental per-student attendance form
│   │   ├── group-analysis.ts   # Per-group supervision analysis report
│   │   └── dossier.ts          # Comprehensive accreditation dossier
│   └── ipc/
│       ├── db-handlers.ts      # CRUD operations
│       ├── analysis-handlers.ts# Exposes computed analytics to the renderer
│       ├── pdf-handlers.ts     # PDF generation via Chromium printToPDF
│       ├── gemini-handlers.ts  # Gemini AI report generation
│       └── export-handlers.ts  # JSON and HTML export/import
├── preload/            # Exposes window.api to the renderer
└── renderer/src/       # React + TypeScript frontend
    ├── pages/          # Dashboard, Groups, LogSession, Analysis, Reports, ImportExport, Settings
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
| PDF output | Chromium `printToPDF` (no extra dependency) |
| Build | electron-vite + electron-builder |

---

## Sample Data

A fully synthetic portfolio (7 groups, 28 students, 56 sessions across FYDP I–III and two semesters) ships
in `sample-data/fydp-sample-portfolio.json`. Load it through **Import / Export → Import from JSON File** to
explore the Analysis Portal and every document without entering real data. All names, student codes, emails
and phone numbers in it are invented.

To regenerate it (deterministic — same output every run):

```bash
node tools/generate-sample-data.mjs
```

## First-Time Setup (in the app)

1. **Settings** → Enter your name, initials, designation → Save Gemini API key
   - Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Groups & Students** → Create a group (select the FYDP course) → Add students
3. **Log Session** → Select a group → New Session → Mark attendance + enter notes
4. **Analysis Portal** → Review the portfolio and per-group analysis → Generate the attendance sheets,
   group analysis or comprehensive dossier as PDF
5. **AI Reports** → Select a group → Generate narrative report via Gemini → Edit → Export as PDF or HTML

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
