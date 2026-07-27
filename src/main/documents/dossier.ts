/**
 * FYDP Supervision Evidence Dossier — the single comprehensive document a
 * supervisor hands to an accreditation panel (BAETE) or the department.
 *
 * It aggregates every group the supervisor holds, states which clause of the
 * FYDP Guideline each section satisfies, and declares its own limitations so a
 * panel can see exactly what the evidence does and does not cover.
 */
import type { PortfolioAnalytics, GroupAnalytics, Flag } from '../analytics'
import { POLICY } from '../analytics'
import { renderStudentSheet, type SignatureMode } from './attendance-sheet'
import {
  esc,
  dash,
  dotDate,
  longDate,
  hhmm,
  durationText,
  letterhead,
  wrapDocument,
  hBarChart,
  columnChart,
  pill,
  attendanceColour,
  type BarDatum
} from './html'

const DOSSIER_CSS = `
  .cover { height: 232mm; position: relative; text-align: center; page-break-after: always; }
  .cover .crest { font-size: 21pt; font-weight: bold; color: #10245c; margin-top: 22mm; letter-spacing: 0.02em; }
  .cover .dept { font-size: 13pt; margin-top: 4px; }
  .cover .band { border-top: 2.5pt solid #10245c; border-bottom: 2.5pt solid #10245c; padding: 12px 0; margin: 26mm 0 8mm; }
  .cover .band .t { font-size: 20pt; font-weight: bold; color: #10245c; line-height: 1.2; }
  .cover .band .s { font-size: 11.5pt; margin-top: 6px; color: #333; }
  .cover .meta { display: inline-block; text-align: left; margin-top: 14mm; font-size: 10.5pt; }
  .cover .meta td { border: none; padding: 3px 10px 3px 0; }
  .cover .foot { position: absolute; bottom: 0; left: 0; right: 0; font-size: 8.5pt; color: #5b6478; }
  .toc { font-size: 10.5pt; }
  .toc td { border: none; padding: 2.5px 0; }
  .toc td.n { width: 12mm; color: #5b6478; }
  .metrics { width: 100%; margin: 8px 0 14px; }
  .metrics td { border: 0.7pt solid #9aa4b8; padding: 6px 8px; width: 25%; }
  .metrics .lbl { display: block; font-size: 8pt; color: #5b6478; text-transform: uppercase; letter-spacing: 0.04em; }
  .metrics .val { display: block; font-size: 13pt; font-weight: bold; color: #10245c; }
  .metrics .sub { display: block; font-size: 8pt; color: #5b6478; }
  .status-met { color: #1f5c33; font-weight: bold; }
  .status-partial { color: #8a5f11; font-weight: bold; }
  .status-not { color: #8a1f1f; font-weight: bold; }
  table.matrix td, table.matrix th { padding: 3px 2px; text-align: center; font-size: 8.5pt; }
  table.matrix td.nm { text-align: left; white-space: nowrap; }
  td.p { background: #eaf5ec; color: #1f5c33; font-weight: bold; }
  td.a { background: #fbe9e9; color: #8a1f1f; font-weight: bold; }
  .grp { page-break-before: always; }
  .sheet { page-break-after: always; }
  table.att th { text-align: center; }
  table.att td.sl { width: 8mm; text-align: center; }
  table.att td.dt { width: 20mm; text-align: center; }
  table.att td.tm { width: 27mm; text-align: center; }
  table.att td.du { width: 15mm; text-align: center; }
  table.att td.rec { width: 34mm; text-align: center; }
  table.att td.ini { width: 20mm; }
  tr.absent td { background: #fbf1f1; }
  .attest { border: 0.7pt solid #9aa4b8; padding: 7px 9px; font-size: 8.5pt; }
  .attest .h { font-weight: bold; color: #10245c; margin-bottom: 3px; font-size: 9pt; }
  .footer-grid { width: 100%; border: none; margin-top: 16px; }
  .footer-grid td { border: none; vertical-align: top; }
  ul.flags { margin: 4px 0 0 16px; padding: 0; font-size: 9pt; }
  ul.flags li { margin-bottom: 2px; }
`

const statusClass = (s: string): string =>
  s === 'met' ? 'status-met' : s === 'partial' ? 'status-partial' : 'status-not'

const flagList = (flags: Flag[]): string =>
  flags.length
    ? `<ul class="flags">${flags
        .map(
          (f) =>
            `<li>${pill(f.severity, f.severity.toUpperCase())} ${esc(f.label)}${
              f.detail ? ` <span class="muted small">— ${esc(f.detail)}</span>` : ''
            }</li>`
        )
        .join('')}</ul>`
    : '<p class="small muted">No exceptions recorded.</p>'

// ── Cover and front matter ──────────────────────────────────────────────────

function cover(p: PortfolioAnalytics): string {
  const f = p.faculty
  const semesters = p.by_semester.map((s) => s.semester).join(', ') || '—'
  return `<div class="cover">
    <div class="crest">${dash(f?.university || 'Southeast University')}</div>
    <div class="dept">${dash(f?.department || 'Department of Computer Science and Engineering')}</div>
    <div class="band">
      <div class="t">Final Year Design Project<br>Supervision Evidence Dossier</div>
      <div class="s">Prepared for departmental review and programme accreditation</div>
    </div>
    <table class="meta">
      <tr><td><strong>Primary Supervisor</strong></td><td>${dash(f?.name)}${
        f?.initials ? ` (${esc(f.initials)})` : ''
      }</td></tr>
      <tr><td><strong>Designation</strong></td><td>${dash(f?.designation)}</td></tr>
      ${f?.email ? `<tr><td><strong>Email</strong></td><td>${esc(f.email)}</td></tr>` : ''}
      <tr><td><strong>Semesters covered</strong></td><td>${esc(semesters)}</td></tr>
      <tr><td><strong>Groups covered</strong></td><td>${p.totals.groups} group(s), ${p.totals.students} student(s)</td></tr>
      <tr><td><strong>Sessions evidenced</strong></td><td>${p.totals.sessions} logged session(s), ${
        p.totals.contact_hours
      } contact hours</td></tr>
      <tr><td><strong>Date of issue</strong></td><td>${longDate(p.generated_at)}</td></tr>
      <tr><td><strong>Document ID</strong></td><td class="mono">${esc(p.document_id)}</td></tr>
    </table>
    <div class="foot">
      Generated by the FYDP Supervision Logger from the supervisor's own logbook records.
      All figures are computed arithmetically and are reproducible from the source database.<br>
      Contains student-identifying information — handle under the University's data-protection practice.
    </div>
  </div>`
}

function contents(p: PortfolioAnalytics, opts: DossierOptions): string {
  const items: string[] = [
    'Purpose, Scope and Method',
    'Supervisor Profile and Supervision Load',
    'Portfolio Summary',
    'Compliance with the FYDP Guideline',
    'Attendance and Engagement Distribution',
    'Group Dossiers',
    'Risk Register and Supervisory Interventions',
    'Evidence Inventory, Provenance and Limitations',
    'Declaration and Attestation'
  ]
  const appendices: string[] = ['Appendix A — Consolidated Student Attendance Summary']
  if (opts.includeAttendanceSheets) appendices.push('Appendix B — Departmental Attendance Sheets (per student)')
  if (opts.includeTranscripts) appendices.push('Appendix C — Full Logbook Transcripts')

  return `<h2 style="margin-top:0">Contents</h2>
  <table class="toc">
    ${items.map((t, i) => `<tr><td class="n">${i + 1}.</td><td>${esc(t)}</td></tr>`).join('')}
    ${appendices.map((t) => `<tr><td class="n"></td><td>${esc(t)}</td></tr>`).join('')}
  </table>
  <h2>1. Purpose, Scope and Method</h2>
  <p>This dossier consolidates the supervision record maintained by the named Primary Supervisor for all
  Final Year Design Project groups under their charge. It exists to satisfy Sec. 10 of the departmental FYDP
  Guideline, which requires a structured supervision logbook recording meeting dates, attendance, work
  assigned and completed, decisions taken and next milestones, and to make that record legible to a
  reviewer who was not present at any of the meetings.</p>
  <p>The contents are produced directly from the supervisor's logbook database. Attendance, cadence,
  documentation completeness, contribution share and the derived assessment indicators are all arithmetic
  transformations of stored rows — recomputing them from the same database reproduces the same figures and
  the same checksums. Narrative reports generated with AI assistance are stored separately in the
  application and are deliberately excluded from this dossier, so that nothing presented here depends on a
  generative model.</p>
  <p>Board marking, external examiner assessment and final grade computation are outside the scope of this
  document. They are governed by Sec. 3 and Sec. 6 of the Guideline and are recorded elsewhere.</p>`
}

// ── Sections ────────────────────────────────────────────────────────────────

function supervisorSection(p: PortfolioAnalytics): string {
  const f = p.faculty
  const capRows = p.by_course
    .filter((c) => c.groups > 0 || c.students > 0)
    .map(
      (c) => `<tr>
      <td>${esc(c.course_code)} <span class="muted small">/ ${esc(c.baete_code)}</span><br>
        <span class="small">${esc(c.course_title)}</span></td>
      <td class="num">${c.groups}</td>
      <td class="num">${c.students}</td>
      <td class="num">${c.active_students}</td>
      <td class="num">${c.cap ?? '—'}</td>
      <td class="num">${c.cap_utilisation_pct !== null ? `${c.cap_utilisation_pct}%` : '—'}</td>
      <td class="ctr">${
        c.within_cap === null
          ? '<span class="muted">not assessed</span>'
          : c.within_cap
            ? '<span class="status-met">Within cap</span>'
            : '<span class="status-not">Over cap</span>'
      }</td>
    </tr>`
    )
    .join('')

  return `<h2>2. Supervisor Profile and Supervision Load</h2>
  <table class="kv">
    <tr><td class="k">Name</td><td><strong>${dash(f?.name)}</strong>${f?.initials ? ` (${esc(f.initials)})` : ''}</td></tr>
    <tr><td class="k">Designation</td><td>${dash(f?.designation)}</td></tr>
    <tr><td class="k">Department / University</td><td>${dash(f?.department)}, ${dash(f?.university)}</td></tr>
    <tr><td class="k">Email</td><td>${dash(f?.email)}</td></tr>
    <tr><td class="k">Rank resolved for load cap</td><td>${
      p.rank ? `${esc(p.rank.rank)} — ${p.rank.cap} students per FYDP course (Sec. 5.1)` : '<span class="muted">could not be resolved from the designation field</span>'
    }</td></tr>
  </table>
  ${
    capRows
      ? `<h3>Per-course supervision load against Sec. 5.1 caps</h3>
      <table><thead><tr>
        <th>Course</th><th class="num">Groups</th><th class="num">Students</th>
        <th class="num">Active</th><th class="num">Cap</th><th class="num">Utilisation</th><th class="ctr">Status</th>
      </tr></thead><tbody>${capRows}</tbody></table>
      <p class="small muted">Caps are applied per course, consistent with Sec. 5.1: a supervisor may carry the
      per-course limit in each of FYDP I, II and III concurrently. Only groups still active count towards the
      cap; completed cohorts are shown in the Students column but excluded from the utilisation figure. Slot
      bonuses arising from an assigned Co-Supervisor (Sec. 7.3) are not applied automatically here.</p>`
      : '<p class="muted">No groups on record.</p>'
  }`
}

function portfolioSection(p: PortfolioAnalytics): string {
  const cards: [string, string, string][] = [
    ['Groups Supervised', String(p.totals.groups), 'across all FYDP courses'],
    ['Students', String(p.totals.students), 'on active rosters'],
    ['Sessions Logged', String(p.totals.sessions), `${p.totals.contact_hours} contact hours`],
    ['Mean Attendance', `${p.totals.avg_attendance_pct}%`, 'roster-weighted'],
    ['Documentation Completeness', `${p.totals.documentation_completeness_pct}%`, 'of attended student-sessions'],
    ['Semesters Covered', String(p.by_semester.length), p.by_semester.map((s) => s.semester).join(', ') || '—'],
    ['Groups Meeting Session Minimum', `${p.groups.filter((g) => g.meets_minimum_sessions).length}/${p.totals.groups}`, 'Sec. 10'],
    ['Open Exceptions', String(p.risk_register.length), 'see Section 7']
  ]
  const rows: string[] = []
  for (let i = 0; i < cards.length; i += 4) {
    rows.push(
      `<tr>${cards
        .slice(i, i + 4)
        .map(
          ([l, v, s]) =>
            `<td><span class="lbl">${esc(l)}</span><span class="val">${esc(v)}</span><span class="sub">${esc(s)}</span></td>`
        )
        .join('')}</tr>`
    )
  }

  const courseTable = `<table><thead><tr>
      <th>Course</th><th class="num">Groups</th><th class="num">Students</th>
      <th class="num">Sessions</th><th class="num">Contact Hours</th><th class="num">Mean Attendance</th>
    </tr></thead><tbody>${p.by_course
      .map(
        (c) => `<tr>
      <td>${esc(c.course_code)} — ${esc(c.course_title)}</td>
      <td class="num">${c.groups}</td><td class="num">${c.students}</td>
      <td class="num">${c.sessions}</td><td class="num">${c.contact_hours}</td>
      <td class="num">${c.students ? `${c.avg_attendance_pct}%` : '—'}</td>
    </tr>`
      )
      .join('')}</tbody></table>`

  const semesterTable = p.by_semester.length
    ? `<h3>By semester</h3><table><thead><tr>
        <th>Semester</th><th class="num">Groups</th><th class="num">Students</th><th class="num">Sessions</th>
      </tr></thead><tbody>${p.by_semester
        .map(
          (s) =>
            `<tr><td>${esc(s.semester)}</td><td class="num">${s.groups}</td><td class="num">${s.students}</td><td class="num">${s.sessions}</td></tr>`
        )
        .join('')}</tbody></table>`
    : ''

  const groupBars: BarDatum[] = p.groups.map((g) => ({
    label: `${g.group.group_name} (${g.group.course_code})`,
    value: g.group_attendance_pct,
    display: `${g.group_attendance_pct}%`,
    colour: attendanceColour(g.group_attendance_pct)
  }))

  const sessionBars: BarDatum[] = p.groups.map((g) => ({
    label: `${g.group.group_name}`,
    value: g.sessions_held,
    colour: g.meets_minimum_sessions ? '#2f7a45' : '#b8801f'
  }))

  return `<h2>3. Portfolio Summary</h2>
  <table class="metrics">${rows.join('')}</table>
  <h3>By course</h3>
  ${courseTable}
  ${semesterTable}
  ${groupBars.length ? `<h3>Attendance by group</h3>${hBarChart(groupBars, { max: 100, suffix: '%' })}` : ''}
  ${
    sessionBars.length
      ? `<h3>Sessions logged per group</h3>${columnChart(sessionBars, { height: 150 })}
      <p class="small muted">Green columns meet the minimum session count set for the group; amber columns fall short.</p>`
      : ''
  }`
}

function complianceSection(p: PortfolioAnalytics): string {
  return `<h2>4. Compliance with the FYDP Guideline</h2>
  <p>Each row states a requirement of the departmental FYDP Guideline that the supervision logbook is
  expected to evidence, the status derived from the records in this dossier, and the specific evidence
  supporting that status.</p>
  <table><thead><tr>
    <th style="width:34mm">Reference</th><th>Requirement</th>
    <th class="ctr" style="width:18mm">Status</th><th style="width:62mm">Evidence</th>
  </tr></thead><tbody>${p.compliance
    .map(
      (c) => `<tr>
    <td>${esc(c.reference)}</td>
    <td>${esc(c.requirement)}</td>
    <td class="ctr ${statusClass(c.status)}">${esc(c.status.toUpperCase())}</td>
    <td class="small">${esc(c.evidence)}</td>
  </tr>`
    )
    .join('')}</tbody></table>
  <div class="note">Status values are mechanical: <strong>MET</strong> means every group on record satisfies the
  requirement, <strong>PARTIAL</strong> means some do, and <strong>NOT MET</strong> means none do or no data
  exists. They describe the state of the logbook, not a judgement on the quality of supervision.</div>`
}

function distributionSection(p: PortfolioAnalytics): string {
  const buckets: BarDatum[] = p.attendance_distribution.map((b) => ({
    label: b.bucket,
    value: b.count,
    colour:
      b.bucket === 'Below 50%' ? '#a33' : b.bucket === '50–59%' ? '#b8801f' : b.bucket === '60–74%' ? '#a1651a' : '#2f7a45'
  }))
  const allStudents = p.groups.flatMap((g) => g.students)
  const engagementBands = [
    { label: 'Strong (80–100)', test: (n: number) => n >= 80, colour: '#2f7a45' },
    { label: 'Adequate (65–79)', test: (n: number) => n >= 65 && n < 80, colour: '#4a7a2f' },
    { label: 'Marginal (50–64)', test: (n: number) => n >= 50 && n < 65, colour: '#b8801f' },
    { label: 'Weak (below 50)', test: (n: number) => n < 50, colour: '#a33' }
  ]
  const engagementBars: BarDatum[] = engagementBands.map((b) => ({
    label: b.label,
    value: allStudents.filter((s) => b.test(s.engagement_index)).length,
    colour: b.colour
  }))

  return `<h2>5. Attendance and Engagement Distribution</h2>
  <h3>Students by attendance band</h3>
  ${hBarChart(buckets, { suffix: ' students' })}
  <table><thead><tr><th>Attendance band</th><th class="num">Students</th><th class="num">Share of cohort</th></tr></thead>
  <tbody>${p.attendance_distribution
    .map(
      (b) =>
        `<tr><td>${esc(b.bucket)}</td><td class="num">${b.count}</td><td class="num">${
          p.totals.students ? Math.round((b.count / p.totals.students) * 100) : 0
        }%</td></tr>`
    )
    .join('')}</tbody></table>
  <h3>Students by engagement index</h3>
  ${hBarChart(engagementBars, { suffix: ' students' })}
  <p class="small muted">The engagement index is a composite of attendance (40%), documentation of work
  completed (40%) and documented contribution relative to equal group parity (20%). It is an internal
  monitoring signal, not a mark.</p>`
}

function groupDossier(g: GroupAnalytics, index: number): string {
  const cards: [string, string][] = [
    ['Sessions', `${g.sessions_held} / ${g.group.min_required_sessions}`],
    ['Attendance', `${g.group_attendance_pct}%`],
    ['Contact hours', String(g.contact_hours)],
    ['Documentation', `${g.documentation_completeness_pct}%`]
  ]

  const matrix =
    g.sessions.length && g.students.length
      ? `<table class="matrix">
        <thead><tr><th class="nm">Student</th>${g.sessions
          .map((_, i) => `<th>${i + 1}</th>`)
          .join('')}<th>%</th></tr></thead>
        <tbody>${g.students
          .map(
            (st) => `<tr><td class="nm">${esc(st.name)}<br><span class="mono">${esc(st.student_code)}</span></td>
          ${st.presence.map((x) => `<td class="${x ? 'p' : 'a'}">${x ? 'P' : 'A'}</td>`).join('')}
          <td><strong>${st.attendance_pct}%</strong></td></tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted small">No attendance matrix available — no sessions logged.</p>'

  return `<div class="grp">
  <h3>6.${index} ${esc(g.group.group_name)} <span class="small muted">${esc(g.group.course_code)}${
    g.group.baete_code ? ` / ${esc(g.group.baete_code)}` : ''
  }</span> ${pill(g.risk)}</h3>
  <table class="kv">
    <tr><td class="k">Title of the Study</td><td><strong>${dash(g.group.project_title)}</strong></td></tr>
    <tr><td class="k">Course</td><td>${dash(g.group.course_code)} — ${dash(g.group.course_title)}</td></tr>
    <tr><td class="k">Semester / AY</td><td>${dash(g.group.semester)}${
      g.group.academic_year ? ` · ${esc(g.group.academic_year)}` : ''
    }</td></tr>
    <tr><td class="k">Roster</td><td>${g.roster_count} student(s) — ${
      g.group_size_compliant ? 'within' : '<strong>outside</strong>'
    } the 3–5 range (Sec. 8)</td></tr>
    ${
      g.group.co_supervisor_name
        ? `<tr><td class="k">Co-Supervisor</td><td>${esc(g.group.co_supervisor_name)}${
            g.group.co_supervisor_designation ? `, ${esc(g.group.co_supervisor_designation)}` : ''
          } <span class="small muted">(Sec. 7 — no separate marks entry, Sec. 3.3)</span></td></tr>`
        : ''
    }
    <tr><td class="k">Supervision period</td><td>${
      g.first_session ? `${longDate(g.first_session)} – ${longDate(g.last_session!)} (${g.span_days} days)` : '&mdash;'
    }</td></tr>
    <tr><td class="k">Key figures</td><td>${cards.map(([k, v]) => `${esc(k)}: <strong>${esc(v)}</strong>`).join(' &nbsp;·&nbsp; ')}</td></tr>
  </table>

  <h4>Session register</h4>
  ${
    g.sessions.length
      ? `<table><thead><tr>
          <th style="width:8mm">SL</th><th style="width:20mm">Date</th><th style="width:25mm">Time</th>
          <th style="width:13mm">Dur.</th><th>Topic of Discussion</th><th class="ctr" style="width:16mm">Present</th>
        </tr></thead><tbody>${g.sessions
          .map(
            (s, i) => `<tr>
          <td class="ctr">${i + 1}</td><td class="ctr">${dotDate(s.log_date)}</td>
          <td class="ctr">${s.start_time ? `${hhmm(s.start_time)}–${hhmm(s.end_time)}` : '&mdash;'}</td>
          <td class="ctr">${esc(durationText(s.duration_minutes))}</td>
          <td>${dash(s.topic)}</td><td class="ctr">${s.present_count}/${s.roster_count}</td>
        </tr>`
          )
          .join('')}</tbody></table>`
      : '<p class="muted small">No sessions logged for this group.</p>'
  }

  <h4>Attendance matrix</h4>
  ${matrix}

  <h4>Individual participation</h4>
  <table><thead><tr>
    <th>Student</th><th class="num">Attend.</th><th class="num">Work records</th>
    <th class="num">Doc. rate</th><th class="num">Contribution</th>
    <th class="num">Attend. ind.<br><span class="small">(of ${POLICY.attendanceMarks})</span></th>
    <th class="num">CA evidence ind.<br><span class="small">(of ${g.students[0]?.ca_evidence_max ?? 20})</span></th>
    <th class="ctr">Status</th>
  </tr></thead><tbody>${g.students
    .map(
      (s) => `<tr>
    <td>${esc(s.name)}<br><span class="mono">${esc(s.student_code)}</span></td>
    <td class="num">${s.attendance_pct}%</td><td class="num">${s.logged_work_entries}</td>
    <td class="num">${s.documentation_rate}%</td><td class="num">${s.contribution_share_pct}%</td>
    <td class="num">${s.attendance_indicator}</td><td class="num">${s.ca_evidence_indicator}</td>
    <td class="ctr">${pill(s.risk)}</td>
  </tr>`
    )
    .join('')}</tbody></table>

  <h4>Observations</h4>
  ${flagList([...g.flags, ...g.students.flatMap((s) => s.flags)])}
</div>`
}

function riskSection(p: PortfolioAnalytics): string {
  if (!p.risk_register.length)
    return `<h2>7. Risk Register and Supervisory Interventions</h2>
    <p>No exceptions were raised by the monitoring rules across any group in this dossier.</p>`

  return `<h2>7. Risk Register and Supervisory Interventions</h2>
  <p>The register below lists every exception raised automatically by the monitoring rules, ordered by
  severity. Exceptions are diagnostic: they indicate where the logbook shows a departure from expected
  supervision patterns and where a documented intervention is warranted.</p>
  <table><thead><tr>
    <th style="width:26mm">Group</th><th style="width:16mm">Course</th><th style="width:46mm">Subject</th>
    <th class="ctr" style="width:18mm">Level</th><th>Exceptions raised</th>
  </tr></thead><tbody>${p.risk_register
    .map(
      (r) => `<tr>
    <td>${esc(r.group_name)}</td><td>${esc(r.course_code)}</td><td>${esc(r.subject)}</td>
    <td class="ctr">${pill(r.risk)}</td>
    <td class="small">${r.flags
      .map((f) => `${esc(f.label)}${f.detail ? ` <span class="muted">(${esc(f.detail)})</span>` : ''}`)
      .join('<br>')}</td>
  </tr>`
    )
    .join('')}</tbody></table>
  <div class="note">Under Sec. 12 of the Guideline, failure to maintain satisfactory progress, attendance or
  deliverable quality may affect the supervisor-component marks and may require remedial work before final
  presentation. Where an exception above has been addressed, the supervisor should record the intervention
  in the session log so that it appears in subsequent issues of this dossier.</div>`
}

function evidenceSection(p: PortfolioAnalytics, opts: DossierOptions): string {
  const totalLogEntries = p.groups.reduce(
    (a, g) => a + g.sessions_held * g.roster_count,
    0
  )
  return `<h2>8. Evidence Inventory, Provenance and Limitations</h2>
  <h3>What this dossier is built from</h3>
  <table><thead><tr><th>Record type</th><th class="num">Count</th><th>Captured at</th></tr></thead><tbody>
    <tr><td>Supervised groups</td><td class="num">${p.totals.groups}</td><td>Group registration</td></tr>
    <tr><td>Students on roster</td><td class="num">${p.totals.students}</td><td>Group registration</td></tr>
    <tr><td>Supervision sessions</td><td class="num">${p.totals.sessions}</td><td>Time of each meeting</td></tr>
    <tr><td>Per-student session entries</td><td class="num">${totalLogEntries}</td><td>Time of each meeting</td></tr>
    <tr><td>Supervision contact hours</td><td class="num">${p.totals.contact_hours}</td><td>Derived from session durations</td></tr>
  </tbody></table>

  <h3>Provenance</h3>
  <p>Records are entered by the supervisor in the FYDP Supervision Logger, stored locally, and exported as
  a portable JSON file for backup and continuity. This dossier is regenerated from that store on demand;
  the Document ID and per-section checksums change whenever the underlying records change, which lets a
  reviewer confirm that a printed copy corresponds to a specific state of the logbook.</p>

  <h3>Stated limitations</h3>
  <ul>
    <li><strong>Attendance is supervisor-recorded.</strong> The original departmental form carries a
    per-session student signature. Where this dossier reports attendance, the authority is the supervisor's
    contemporaneous entry plus the row-level verification codes, not a student's handwriting.</li>
    <li><strong>Contribution share is a documentation proxy.</strong> It is computed from the volume of
    recorded work text per student. A student who worked substantially but was described briefly will show a
    lower share. It is a monitoring signal for the supervisor, not a measure of academic merit.</li>
    <li><strong>Derived indicators are not marks.</strong> Attendance and continuous-assessment indicators
    are arithmetic suggestions. Under Sec. 3.3 the Primary Supervisor alone enters the supervisor-component
    marks and may depart from these figures.</li>
    <li><strong>Board and external examiner assessment is not covered.</strong> Sec. 3 board marks, Sec. 6
    board composition and Sec. 9 external examiner records sit outside this document.</li>
    <li><strong>Scope is one supervisor.</strong> This dossier covers only the groups held by the named
    supervisor. Departmental aggregation across supervisors is a separate exercise.</li>
    ${
      !opts.includeTranscripts
        ? '<li><strong>Full logbook transcripts are excluded from this issue.</strong> The per-session work-done, work-planned and supervisor-note text can be included as Appendix C on request.</li>'
        : ''
    }
  </ul>`
}

function declarationSection(p: PortfolioAnalytics): string {
  const f = p.faculty
  return `<h2>9. Declaration and Attestation</h2>
  <p>I declare that the supervision records consolidated in this dossier were maintained by me during the
  semesters stated, that the sessions listed were held as recorded, and that the attendance and progress
  entries reflect my contemporaneous observation of each student's participation. The figures presented
  are computed from those records without manual adjustment.</p>
  <table class="kv small">
    <tr><td class="k">Document ID</td><td class="mono">${esc(p.document_id)}</td></tr>
    <tr><td class="k">Issued</td><td>${longDate(p.generated_at)}</td></tr>
    <tr><td class="k">Coverage</td><td>${p.totals.groups} group(s), ${p.totals.students} student(s), ${
      p.totals.sessions
    } session(s)</td></tr>
  </table>
  <table class="footer-grid">
    <tr>
      <td style="width:33%"><div class="sig-line" style="width:52mm">${dash(f?.name)}<br>
        <span class="small">${dash(f?.designation)}<br>Primary Supervisor</span></div></td>
      <td style="width:33%"><div class="sig-line" style="width:52mm">Co-Supervisor<br>
        <span class="small">(where assigned, Sec. 7)</span></div></td>
      <td><div class="sig-line" style="width:52mm">Chairman<br>
        <span class="small">${dash(f?.department)}</span></div></td>
    </tr>
  </table>`
}

function appendixA(p: PortfolioAnalytics): string {
  const rows = p.groups
    .flatMap((g) =>
      g.students.map(
        (s) => `<tr>
      <td>${esc(s.student_code)}</td><td>${esc(s.name)}</td>
      <td>${esc(g.group.group_name)}</td><td>${esc(g.group.course_code)}</td>
      <td>${esc(g.group.semester)}</td>
      <td class="num">${s.sessions_present}/${s.sessions_total}</td>
      <td class="num">${s.attendance_pct}%</td>
      <td class="num">${s.logged_work_entries}</td>
      <td class="num">${s.engagement_index}</td>
      <td class="ctr">${pill(s.risk)}</td>
    </tr>`
      )
    )
    .join('')
  return `<div class="page-break"></div>
  <h2>Appendix A — Consolidated Student Attendance Summary</h2>
  <p class="small muted">One row per student across every group in this dossier, sorted by group.</p>
  <table><thead><tr>
    <th>Student Code</th><th>Name</th><th>Group</th><th>Course</th><th>Semester</th>
    <th class="num">Present/Total</th><th class="num">Attend.</th><th class="num">Work rec.</th>
    <th class="num">Engagement</th><th class="ctr">Status</th>
  </tr></thead><tbody>${rows || '<tr><td colspan="10" class="ctr muted">No students on record.</td></tr>'}</tbody></table>`
}

function appendixB(p: PortfolioAnalytics, mode: SignatureMode): string {
  const sheets = p.groups.flatMap((g) =>
    g.students.map((s) =>
      renderStudentSheet(g, s, p.faculty, {
        signatureMode: mode,
        documentId: p.document_id,
        generatedAt: new Date(p.generated_at)
      })
    )
  )
  if (!sheets.length) return ''
  return `<div class="page-break"></div>
  <h2>Appendix B — Departmental Attendance Sheets</h2>
  <p class="small muted">One sheet per student, in the departmental format. The per-session student
  signature column is replaced by a system-verified attendance record; see the attestation block on each sheet.</p>
  <div class="page-break"></div>
  ${sheets.join('\n')}`
}

function appendixC(p: PortfolioAnalytics, logsByGroup: Map<number, Map<number, any[]>>): string {
  const blocks = p.groups
    .map((g) => {
      const logsBySession = logsByGroup.get(g.group.id)
      if (!logsBySession || !g.sessions.length) return ''
      const sessions = g.sessions
        .map((sess, i) => {
          const logs = logsBySession.get(sess.id) ?? []
          const rows = g.students
            .map((st) => {
              const log = logs.find((l: any) => l.student_id === st.student_id)
              if (st.presence[i] !== 1)
                return `<tr><th style="width:24%">${esc(st.name)}</th><td class="muted">Absent — no entry recorded.</td></tr>`
              return `<tr><th style="width:24%">${esc(st.name)}</th><td>
                <strong>Work done:</strong> ${dash(log?.work_done)}<br>
                <strong>Work planned:</strong> ${dash(log?.work_planned)}
                ${log?.faculty_notes ? `<br><strong>Supervisor note:</strong> ${esc(log.faculty_notes)}` : ''}
              </td></tr>`
            })
            .join('')
          return `<div class="avoid-break" style="margin-bottom:9px">
            <h4>Session ${i + 1} — ${dotDate(sess.log_date)}${sess.topic ? `: ${esc(sess.topic)}` : ''}</h4>
            <table style="font-size:9pt"><tbody>${rows}</tbody></table>
          </div>`
        })
        .join('')
      return `<h3>${esc(g.group.group_name)} — ${esc(g.group.course_code)}</h3>${sessions}`
    })
    .filter(Boolean)
    .join('')

  if (!blocks) return ''
  return `<div class="page-break"></div>
  <h2>Appendix C — Full Logbook Transcripts</h2>
  <p class="small muted">Verbatim per-student entries as recorded at each session.</p>
  ${blocks}`
}

// ── Entry point ─────────────────────────────────────────────────────────────

export interface DossierOptions {
  includeAttendanceSheets?: boolean
  includeTranscripts?: boolean
  signatureMode?: SignatureMode
  courseFilter?: string[]
  logsByGroup?: Map<number, Map<number, any[]>>
}

export function renderDossier(p: PortfolioAnalytics, opts: DossierOptions = {}): string {
  const filtered: PortfolioAnalytics = opts.courseFilter?.length
    ? { ...p, groups: p.groups.filter((g) => opts.courseFilter!.includes(g.group.course_code)) }
    : p

  const body = `
  ${cover(filtered)}
  ${contents(filtered, opts)}
  ${supervisorSection(filtered)}
  ${portfolioSection(filtered)}
  <div class="page-break"></div>
  ${complianceSection(filtered)}
  ${distributionSection(filtered)}
  <div class="page-break"></div>
  <h2>6. Group Dossiers</h2>
  <p>One subsection per supervised group, each carrying the group's identification block, session register,
  attendance matrix, individual participation figures and any exceptions raised.</p>
  ${
    filtered.groups.length
      ? filtered.groups.map((g, i) => groupDossier(g, i + 1)).join('')
      : '<p class="muted">No groups on record.</p>'
  }
  <div class="page-break"></div>
  ${riskSection(filtered)}
  ${evidenceSection(filtered, opts)}
  ${declarationSection(filtered)}
  ${appendixA(filtered)}
  ${opts.includeAttendanceSheets ? appendixB(filtered, opts.signatureMode ?? 'attested') : ''}
  ${opts.includeTranscripts && opts.logsByGroup ? appendixC(filtered, opts.logsByGroup) : ''}`

  return wrapDocument({
    title: 'FYDP Supervision Evidence Dossier',
    body,
    extraCss: DOSSIER_CSS
  })
}
