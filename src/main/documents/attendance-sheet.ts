/**
 * Per-student attendance sheet — a faithful rebuild of the departmental form
 * ("Attendance of Final Year Design Project I Student").
 *
 * The one deliberate change: the original form's "Signature of the Student"
 * column cannot be filled by software. It is replaced by an Attendance Record
 * column carrying the recorded status plus a per-row verification code derived
 * from the session and student identifiers, and the sheet closes with a system
 * attestation block. A physical initial column and a wet-signature line can be
 * switched back on for departments that still want ink on paper.
 */
import type { GroupAnalytics, StudentAnalytics } from '../analytics'
import { verificationCode, documentChecksum, COURSE_TITLES } from '../analytics'
import { esc, dash, dotDate, hhmm, durationText, longDate, letterhead, wrapDocument } from './html'

export type SignatureMode = 'attested' | 'both' | 'physical'

export interface AttendanceSheetOptions {
  signatureMode?: SignatureMode
  includeSummary?: boolean
  documentId?: string
  generatedAt?: Date
}

const SHEET_CSS = `
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  table.att { font-size: 9.5pt; }
  table.att th { text-align: center; }
  table.att td.sl { width: 8mm; text-align: center; }
  table.att td.dt { width: 20mm; text-align: center; }
  table.att td.tm { width: 27mm; text-align: center; }
  table.att td.du { width: 15mm; text-align: center; }
  table.att td.ini { width: 20mm; }
  table.att td.rec { width: 34mm; text-align: center; }
  tr.absent td { background: #fbf1f1; }
  .attest { border: 0.7pt solid #9aa4b8; padding: 7px 9px; font-size: 8.5pt; }
  .attest .h { font-weight: bold; color: #10245c; margin-bottom: 3px; font-size: 9pt; }
  .footer-grid { width: 100%; border: none; margin-top: 16px; }
  .footer-grid td { border: none; vertical-align: top; }
`

function summaryLine(s: StudentAnalytics): string {
  return `<table class="kv"><tr>
    <td class="k">Sessions Attended</td>
    <td><strong>${s.sessions_present} of ${s.sessions_total}</strong> (${s.attendance_pct}%)
      &nbsp;·&nbsp; Work recorded in ${s.logged_work_entries} session(s)</td>
  </tr></table>`
}

export function renderStudentSheet(
  ga: GroupAnalytics,
  student: StudentAnalytics,
  faculty: any,
  opts: AttendanceSheetOptions = {}
): string {
  const mode = opts.signatureMode ?? 'attested'
  const showInitial = mode === 'both' || mode === 'physical'
  const showRecord = mode !== 'physical'
  const courseTitle = ga.group.course_title || COURSE_TITLES[ga.group.course_code] || 'Final Year Design Project'

  const rows = ga.sessions
    .map((sess, i) => {
      const present = student.presence[i] === 1
      const time =
        sess.start_time && sess.end_time
          ? `${hhmm(sess.start_time)} –<br>${hhmm(sess.end_time)}`
          : sess.start_time
            ? hhmm(sess.start_time)
            : '&mdash;'
      const code = verificationCode(sess.id, student.student_id, sess.log_date, present ? 'P' : 'A')
      return `<tr class="${present ? '' : 'absent'}">
        <td class="sl">${i + 1}.</td>
        <td class="dt">${dotDate(sess.log_date)}</td>
        <td class="tm">${time}</td>
        <td class="du">${esc(durationText(sess.duration_minutes))}</td>
        <td>${dash(sess.topic)}</td>
        ${showRecord
          ? `<td class="rec">${present ? 'Present' : 'Absent'}<br><span class="mono">${code}</span></td>`
          : ''}
        ${showInitial ? '<td class="ini"></td>' : ''}
      </tr>`
    })
    .join('')

  const emptyRows =
    ga.sessions.length === 0
      ? `<tr><td colspan="${4 + (showRecord ? 1 : 0) + (showInitial ? 1 : 0) + 1}" class="ctr muted" style="padding:14px">
          No supervision session has been logged for this group.
        </td></tr>`
      : ''

  const generatedAt = opts.generatedAt ?? new Date()
  const checksum = documentChecksum({
    g: ga.group.id,
    s: student.student_id,
    sessions: ga.sessions.map((x, i) => [x.id, x.log_date, student.presence[i]])
  })

  const attestation = `
    <div class="attest">
      <div class="h">System Attestation (in place of per-session student signature)</div>
      Attendance for each session above was recorded by the supervisor in the FYDP Supervision Logger
      at the time of the meeting. Each row carries a verification code derived from the session and
      student identifiers; the codes are reproducible from the source logbook and change if any row is altered.
      <table class="kv small" style="margin-top:5px">
        <tr><td class="k">Record checksum</td><td class="mono">${checksum}</td></tr>
        <tr><td class="k">Sheet generated</td><td>${longDate(generatedAt.toISOString())} at ${generatedAt
          .toTimeString()
          .slice(0, 5)}</td></tr>
        ${opts.documentId ? `<tr><td class="k">Document ID</td><td class="mono">${esc(opts.documentId)}</td></tr>` : ''}
        <tr><td class="k">Sessions on this sheet</td><td>${ga.sessions.length}</td></tr>
      </table>
    </div>`

  const supervisorBlock = `
    <div><strong>Name of the Supervisor:</strong> ${dash(faculty?.name)}${
      faculty?.designation ? `, ${esc(faculty.designation)}` : ''
    }</div>
    ${
      ga.group.co_supervisor_name
        ? `<div><strong>Co-Supervisor:</strong> ${esc(ga.group.co_supervisor_name)}${
            ga.group.co_supervisor_designation ? `, ${esc(ga.group.co_supervisor_designation)}` : ''
          }</div>`
        : ''
    }
    ${
      mode === 'attested'
        ? ''
        : `<div class="sig-line">Signature of the Supervisor</div>`
    }`

  return `<div class="sheet">
  ${letterhead({
    university: faculty?.university || 'Southeast University',
    department: faculty?.department || 'Department of CSE',
    documentTitle: `Attendance of ${courseTitle} Student`,
    subtitle: `${ga.group.group_name}${ga.group.semester ? ` · ${ga.group.semester}` : ''}`
  })}

  <table class="kv">
    <tr><td class="k">Student Name</td><td><strong>${dash(student.name)}</strong></td></tr>
    <tr><td class="k">Student Code</td><td>${dash(student.student_code)} &nbsp;&nbsp;·&nbsp;&nbsp; <strong>Program:</strong> ${dash(
      student.program
    )}</td></tr>
    <tr><td class="k">Student Email</td><td>${dash(student.email)} &nbsp;&nbsp;·&nbsp;&nbsp; <strong>Mobile:</strong> ${dash(
      student.mobile
    )}</td></tr>
    <tr><td class="k">Title of the Study</td><td>${dash(ga.group.project_title)}</td></tr>
    <tr><td class="k">Course Code</td><td>${dash(ga.group.course_code)}${
      ga.group.baete_code ? ` <span class="muted small">(BAETE-aligned: ${esc(ga.group.baete_code)})</span>` : ''
    }</td></tr>
    <tr><td class="k">Semester</td><td>${dash(ga.group.semester)}${
      ga.group.academic_year ? ` <span class="muted small">· AY ${esc(ga.group.academic_year)}</span>` : ''
    }</td></tr>
  </table>

  <table class="att">
    <thead>
      <tr>
        <th class="sl">SL</th>
        <th class="dt">Date</th>
        <th class="tm">Time</th>
        <th class="du">Duration</th>
        <th>Topics of Discussion</th>
        ${showRecord ? '<th class="rec">Attendance Record</th>' : ''}
        ${showInitial ? '<th class="ini">Initial</th>' : ''}
      </tr>
    </thead>
    <tbody>${rows}${emptyRows}</tbody>
  </table>

  ${opts.includeSummary === false ? '' : summaryLine(student)}

  <table class="footer-grid">
    <tr>
      <td style="width:52%; padding-right:8mm">${supervisorBlock}</td>
      <td>${attestation}</td>
    </tr>
  </table>
</div>`
}

/** One PDF, one page per student — mirrors how the departmental form is filed */
export function renderAttendanceSheetDocument(
  ga: GroupAnalytics,
  faculty: any,
  opts: AttendanceSheetOptions = {},
  studentIds?: number[]
): string {
  const students = studentIds?.length
    ? ga.students.filter((s) => studentIds.includes(s.student_id))
    : ga.students

  const body = students.length
    ? students.map((s) => renderStudentSheet(ga, s, faculty, opts)).join('\n')
    : `<div class="note warn">This group has no students on the roster, so no attendance sheet could be produced.</div>`

  return wrapDocument({
    title: `FYDP Attendance — ${ga.group.group_name}`,
    body,
    extraCss: SHEET_CSS
  })
}

/** Every student of every group in one file, grouped by course then group */
export function renderBulkAttendanceSheets(
  groups: GroupAnalytics[],
  faculty: any,
  opts: AttendanceSheetOptions = {}
): string {
  const sheets = groups.flatMap((ga) => ga.students.map((s) => renderStudentSheet(ga, s, faculty, opts)))
  return wrapDocument({
    title: 'FYDP Attendance Sheets',
    body: sheets.length
      ? sheets.join('\n')
      : '<div class="note warn">No students found in any group.</div>',
    extraCss: SHEET_CSS
  })
}
