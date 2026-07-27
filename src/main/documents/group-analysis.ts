/**
 * Group Supervision Analysis Report — the document a supervisor puts in front
 * of the presentation board (and later, the accreditation panel) to show what
 * actually happened during a semester of supervision.
 *
 * Every number here is computed in analytics.ts from the logbook rows.
 */
import type { GroupAnalytics, StudentAnalytics, Flag } from '../analytics'
import { POLICY, documentChecksum } from '../analytics'
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

const ANALYSIS_CSS = `
  .metrics { width: 100%; margin: 8px 0 14px; }
  .metrics td { border: 0.7pt solid #9aa4b8; padding: 6px 8px; width: 25%; }
  .metrics .lbl { display: block; font-size: 8pt; color: #5b6478; text-transform: uppercase; letter-spacing: 0.04em; }
  .metrics .val { display: block; font-size: 13pt; font-weight: bold; color: #10245c; }
  .metrics .sub { display: block; font-size: 8pt; color: #5b6478; }
  table.matrix td, table.matrix th { padding: 3px 2px; text-align: center; font-size: 8.5pt; }
  table.matrix td.nm { text-align: left; white-space: nowrap; }
  td.p { background: #eaf5ec; color: #1f5c33; font-weight: bold; }
  td.a { background: #fbe9e9; color: #8a1f1f; font-weight: bold; }
  .student-block { page-break-inside: avoid; border: 0.7pt solid #cfd6e4; padding: 8px 10px; margin: 0 0 10px; }
  .student-block h4 { margin-top: 0; }
  ul.flags { margin: 4px 0 0 16px; padding: 0; font-size: 9pt; }
  ul.flags li { margin-bottom: 2px; }
  .transcript { font-size: 9pt; }
  .transcript th { width: 22%; }
`

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

function metricCards(ga: GroupAnalytics): string {
  const cards: [string, string, string][] = [
    ['Sessions Logged', String(ga.sessions_held), `minimum expected: ${ga.group.min_required_sessions}`],
    ['Group Attendance', `${ga.group_attendance_pct}%`, `${ga.roster_count} students on roster`],
    ['Contact Hours', String(ga.contact_hours), `across ${ga.span_days} days`],
    ['Documentation', `${ga.documentation_completeness_pct}%`, 'of attended sessions carry a work record'],
    ['Average Interval', `${ga.avg_gap_days} d`, `longest gap ${ga.max_gap_days} d`],
    ['Contribution Balance', String(ga.contribution_imbalance), '0 = even, 1 = fully one-sided'],
    ['Last Session', ga.last_session ? dotDate(ga.last_session) : '—', ga.days_since_last_session !== null ? `${ga.days_since_last_session} days ago` : 'no sessions'],
    ['Overall Status', ga.risk.toUpperCase(), `${ga.flags.length} group-level exception(s)`]
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
  return `<table class="metrics">${rows.join('')}</table>`
}

function sessionRegister(ga: GroupAnalytics): string {
  if (!ga.sessions.length) return '<p class="muted">No sessions logged.</p>'
  return `<table>
    <thead><tr>
      <th style="width:8mm">SL</th><th style="width:20mm">Date</th><th style="width:26mm">Time</th>
      <th style="width:14mm">Dur.</th><th>Topic of Discussion</th><th style="width:22mm">Venue</th>
      <th class="ctr" style="width:16mm">Present</th><th class="ctr" style="width:14mm">Gap</th>
    </tr></thead>
    <tbody>${ga.sessions
      .map(
        (s, i) => `<tr>
        <td class="ctr">${i + 1}</td>
        <td class="ctr">${dotDate(s.log_date)}</td>
        <td class="ctr">${s.start_time ? `${hhmm(s.start_time)}–${hhmm(s.end_time)}` : '&mdash;'}</td>
        <td class="ctr">${esc(durationText(s.duration_minutes))}</td>
        <td>${dash(s.topic)}</td>
        <td>${dash(s.venue)}</td>
        <td class="ctr">${s.present_count}/${s.roster_count}</td>
        <td class="ctr">${s.gap_days === null ? '&mdash;' : `${s.gap_days} d`}</td>
      </tr>`
      )
      .join('')}</tbody>
  </table>`
}

function attendanceMatrix(ga: GroupAnalytics): string {
  if (!ga.sessions.length || !ga.students.length) return ''
  const header = ga.sessions.map((s, i) => `<th title="${esc(s.log_date)}">${i + 1}</th>`).join('')
  const rows = ga.students
    .map(
      (st) => `<tr>
      <td class="nm">${esc(st.name)}<br><span class="mono">${esc(st.student_code)}</span></td>
      ${st.presence.map((p) => `<td class="${p ? 'p' : 'a'}">${p ? 'P' : 'A'}</td>`).join('')}
      <td><strong>${st.attendance_pct}%</strong></td>
    </tr>`
    )
    .join('')
  return `<table class="matrix">
    <thead><tr><th class="nm">Student</th>${header}<th>%</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="small muted">Columns are sessions in chronological order; session dates are listed in the register above. P = present, A = absent.</p>`
}

function studentTable(ga: GroupAnalytics): string {
  return `<table>
    <thead><tr>
      <th>Student</th><th class="num">Attend.</th><th class="num">Present/Total</th>
      <th class="num">Work Records</th><th class="num">Doc. Rate</th>
      <th class="num">Contribution</th><th class="num">Engagement</th><th class="ctr">Status</th>
    </tr></thead>
    <tbody>${ga.students
      .map(
        (s) => `<tr>
      <td>${esc(s.name)}<br><span class="mono">${esc(s.student_code)}</span></td>
      <td class="num">${s.attendance_pct}%</td>
      <td class="num">${s.sessions_present}/${s.sessions_total}</td>
      <td class="num">${s.logged_work_entries}</td>
      <td class="num">${s.documentation_rate}%</td>
      <td class="num">${s.contribution_share_pct}%</td>
      <td class="num">${s.engagement_index}</td>
      <td class="ctr">${pill(s.risk)}</td>
    </tr>`
      )
      .join('')}</tbody>
  </table>`
}

function indicatorTable(ga: GroupAnalytics): string {
  const caMax = ga.students[0]?.ca_evidence_max ?? 20
  return `<table>
    <thead><tr>
      <th>Student</th>
      <th class="num">Attendance Indicator<br><span class="small">(of ${POLICY.attendanceMarks})</span></th>
      <th class="num">Continuous-Assessment Evidence Indicator<br><span class="small">(of ${caMax})</span></th>
      <th>Basis</th>
    </tr></thead>
    <tbody>${ga.students
      .map(
        (s) => `<tr>
      <td>${esc(s.name)} <span class="mono">${esc(s.student_code)}</span></td>
      <td class="num">${s.attendance_indicator}</td>
      <td class="num">${s.ca_evidence_indicator}</td>
      <td class="small">${s.sessions_present}/${s.sessions_total} sessions attended; work recorded in ${
        s.logged_work_entries
      }; plan recorded in ${s.logged_plan_entries}</td>
    </tr>`
      )
      .join('')}</tbody>
  </table>
  <div class="note warn"><strong>These are indicators, not marks.</strong> They are arithmetic transformations of the
  logbook evidence for the Attendance and Continuous Assessment components described in Sec. 3.1/3.2 of the FYDP
  Guideline. Under Sec. 3.3 the supervisor-component marks are entered solely by the Primary Supervisor, who may
  depart from these figures on documented academic grounds.</div>`
}

function studentNarratives(ga: GroupAnalytics): string {
  return ga.students
    .map((s: StudentAnalytics) => {
      const parity = ga.roster_count ? (100 / ga.roster_count).toFixed(1) : '0'
      return `<div class="student-block">
      <h4>${esc(s.name)} <span class="mono">${esc(s.student_code)}</span> ${pill(s.risk)}</h4>
      <table class="kv small">
        <tr><td class="k">Attendance</td><td>${s.sessions_present} of ${s.sessions_total} sessions (${
          s.attendance_pct
        }%); longest unbroken absence ${s.longest_absence_streak} session(s); last attended ${
          s.last_present_date ? longDate(s.last_present_date) : '—'
        }</td></tr>
        <tr><td class="k">Documentation</td><td>Work-done recorded for ${s.logged_work_entries} of ${
          s.sessions_present
        } attended session(s) (${s.documentation_rate}%); forward plan recorded ${s.logged_plan_entries} time(s)</td></tr>
        <tr><td class="k">Documented contribution</td><td>${s.contribution_share_pct}% of the group's recorded work volume (equal-share parity is ${parity}%; ratio ${
          s.contribution_ratio
        }×)</td></tr>
        <tr><td class="k">Engagement index</td><td>${s.engagement_index} / 100</td></tr>
      </table>
      ${flagList(s.flags)}
    </div>`
    })
    .join('')
}

function transcript(ga: GroupAnalytics, logsBySession: Map<number, any[]>): string {
  if (!ga.sessions.length) return ''
  return ga.sessions
    .map((sess, i) => {
      const logs = logsBySession.get(sess.id) ?? []
      const byStudent = ga.students
        .map((st) => {
          const log = logs.find((l: any) => l.student_id === st.student_id)
          const present = st.presence[i] === 1
          if (!present)
            return `<tr><th>${esc(st.name)}</th><td class="muted">Absent — no entry recorded.</td></tr>`
          return `<tr><th>${esc(st.name)}</th><td>
            <strong>Work done:</strong> ${dash(log?.work_done)}<br>
            <strong>Work planned:</strong> ${dash(log?.work_planned)}
            ${log?.faculty_notes ? `<br><strong>Supervisor note:</strong> ${esc(log.faculty_notes)}` : ''}
          </td></tr>`
        })
        .join('')
      return `<div class="avoid-break" style="margin-bottom:10px">
        <h4>Session ${i + 1} — ${dotDate(sess.log_date)}${sess.topic ? `: ${esc(sess.topic)}` : ''}</h4>
        <table class="transcript"><tbody>${byStudent}</tbody></table>
      </div>`
    })
    .join('')
}

export interface GroupAnalysisOptions {
  includeTranscript?: boolean
  generatedAt?: Date
  documentId?: string
  /** Raw student_logs keyed by session id — required only when includeTranscript is true */
  logsBySession?: Map<number, any[]>
}

export function renderGroupAnalysis(
  ga: GroupAnalytics,
  faculty: any,
  opts: GroupAnalysisOptions = {}
): string {
  const generatedAt = opts.generatedAt ?? new Date()

  const attendanceBars: BarDatum[] = ga.students.map((s) => ({
    label: `${s.name.split(' ').slice(0, 2).join(' ')} (${s.student_code.slice(-4)})`,
    value: s.attendance_pct,
    display: `${s.attendance_pct}%`,
    colour: attendanceColour(s.attendance_pct)
  }))

  const contributionBars: BarDatum[] = ga.students.map((s) => ({
    label: `${s.name.split(' ').slice(0, 2).join(' ')} (${s.student_code.slice(-4)})`,
    value: s.contribution_share_pct,
    display: `${s.contribution_share_pct}%`,
    colour: s.contribution_ratio < 0.6 ? '#a33' : s.contribution_ratio > 1.6 ? '#b8801f' : '#2f4f8a'
  }))

  const sessionCols: BarDatum[] = ga.sessions.map((s, i) => ({
    label: `S${i + 1} ${dotDate(s.log_date).slice(0, 5)}`,
    value: s.present_count,
    colour: s.present_count === s.roster_count ? '#2f7a45' : s.present_count === 0 ? '#a33' : '#b8801f'
  }))

  const checksum = documentChecksum({
    id: ga.group.id,
    sessions: ga.sessions.map((s) => [s.id, s.log_date, s.present_count]),
    students: ga.students.map((s) => [s.student_code, s.attendance_pct, s.work_volume_words])
  })

  const body = `
  ${letterhead({
    university: faculty?.university || 'Southeast University',
    department: faculty?.department || 'Department of CSE',
    documentTitle: 'FYDP Supervision Analysis Report',
    subtitle: `${ga.group.course_code}${ga.group.baete_code ? ` / ${ga.group.baete_code}` : ''} — ${
      ga.group.course_title
    }`
  })}

  <table class="kv">
    <tr><td class="k">Group</td><td><strong>${dash(ga.group.group_name)}</strong> ${pill(ga.risk)}</td></tr>
    <tr><td class="k">Title of the Study</td><td>${dash(ga.group.project_title)}</td></tr>
    <tr><td class="k">Semester / Academic Year</td><td>${dash(ga.group.semester)}${
      ga.group.academic_year ? ` · ${esc(ga.group.academic_year)}` : ''
    }</td></tr>
    <tr><td class="k">Primary Supervisor</td><td>${dash(faculty?.name)}${
      faculty?.designation ? `, ${esc(faculty.designation)}` : ''
    }</td></tr>
    ${
      ga.group.co_supervisor_name
        ? `<tr><td class="k">Co-Supervisor</td><td>${esc(ga.group.co_supervisor_name)}${
            ga.group.co_supervisor_designation ? `, ${esc(ga.group.co_supervisor_designation)}` : ''
          }</td></tr>`
        : ''
    }
    <tr><td class="k">Supervision Period</td><td>${
      ga.first_session ? `${longDate(ga.first_session)} to ${longDate(ga.last_session!)}` : '&mdash;'
    }</td></tr>
    <tr><td class="k">Report Generated</td><td>${longDate(generatedAt.toISOString())}${
      opts.documentId ? ` · <span class="mono">${esc(opts.documentId)}</span>` : ''
    }</td></tr>
  </table>

  <h2>1. Supervision at a Glance</h2>
  ${metricCards(ga)}
  <p>${esc(ga.group.group_name)} held <strong>${ga.sessions_held}</strong> logged supervision session(s)
  against a semester expectation of ${ga.group.min_required_sessions}, accumulating
  ${ga.contact_hours} supervision contact hours across ${ga.span_days} days. Aggregate roster attendance
  stands at ${ga.group_attendance_pct}%, and ${ga.documentation_completeness_pct}% of attended
  student-sessions carry a written record of work completed. Group size is
  ${ga.roster_count} student(s), which is ${
    ga.group_size_compliant ? 'within' : 'outside'
  } the 3–5 range required by Sec. 8 of the FYDP Guideline.</p>

  <h2>2. Meeting Cadence and Session Register</h2>
  ${sessionRegister(ga)}
  ${
    sessionCols.length
      ? `<h3>Students present per session</h3>${columnChart(sessionCols, {
          max: Math.max(1, ga.roster_count),
          height: 155
        })}`
      : ''
  }
  <p class="small muted">Mean interval between sessions ${ga.avg_gap_days} days (standard deviation
  ${ga.cadence_stdev_days} days); longest interval ${ga.max_gap_days} days.</p>

  <h2>3. Attendance Record</h2>
  ${attendanceMatrix(ga)}
  ${attendanceBars.length ? `<h3>Attendance rate by student</h3>${hBarChart(attendanceBars, { max: 100, suffix: '%' })}` : ''}

  <h2>4. Individual Participation and Contribution</h2>
  ${studentTable(ga)}
  ${
    contributionBars.length
      ? `<h3>Documented contribution share</h3>${hBarChart(contributionBars, {
          max: Math.max(100 / Math.max(1, ga.roster_count) * 2, ...contributionBars.map((b) => b.value)),
          suffix: '%'
        })}
      <p class="small muted">Contribution share is a proxy computed from the volume of work-done and
      work-planned text recorded for each student. It measures documented activity, not academic merit,
      and should be read together with the supervisor's own judgement.</p>`
      : ''
  }

  <h2>5. Student-by-Student Analysis</h2>
  ${studentNarratives(ga)}

  <h2>6. Derived Assessment Indicators</h2>
  ${indicatorTable(ga)}

  <h2>7. Group-Level Observations</h2>
  ${flagList(ga.flags)}

  ${
    opts.includeTranscript && opts.logsBySession
      ? `<div class="page-break"></div><h2>Appendix A — Full Logbook Transcript</h2>${transcript(
          ga,
          opts.logsBySession
        )}`
      : ''
  }

  <h2>Attestation</h2>
  <p class="small">The figures in this report were computed arithmetically from the supervision logbook
  maintained for this group under Sec. 10 of the FYDP Guideline. No narrative content has been generated
  by an AI model. Record checksum <span class="mono">${checksum}</span>; recomputing this report from an
  unaltered logbook reproduces the same checksum.</p>
  <table class="footer-grid" style="width:100%;border:none;margin-top:24px">
    <tr>
      <td style="border:none;width:50%"><div class="sig-line">${dash(faculty?.name)}<br>
        <span class="small">${dash(faculty?.designation)}, ${dash(faculty?.department)}</span></div></td>
      <td style="border:none"><div class="sig-line">Chairman / FYDP Committee</div></td>
    </tr>
  </table>`

  return wrapDocument({
    title: `FYDP Supervision Analysis — ${ga.group.group_name}`,
    body,
    extraCss: ANALYSIS_CSS
  })
}
