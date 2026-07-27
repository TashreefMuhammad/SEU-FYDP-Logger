/**
 * Deterministic analytics engine.
 *
 * Everything in this file is computed arithmetically from the logbook rows.
 * No AI is involved, on purpose: figures that go in front of an accreditation
 * board must be reproducible from the same database, and an LLM cannot
 * guarantee that. The Gemini reports remain a separate, clearly-labelled
 * narrative aid.
 */
import crypto from 'crypto'
import { all, get } from './db'

// ── Policy constants (FYDP Guideline, Revised Draft) ────────────────────────

export const POLICY = {
  groupSizeMin: 3, // Sec. 8
  groupSizeMax: 5, // Sec. 8
  defaultMinSessions: 8, // Sec. 10 — department may specify; 8 is the working default
  /** Sec. 5.1 — max students per FYDP course, by rank of Primary Supervisor */
  loadCapByRank: [
    { match: /professor/i, exclude: /associate|assistant/i, rank: 'Professor', cap: 20 },
    { match: /associate\s+professor/i, rank: 'Associate Professor', cap: 18 },
    { match: /assistant\s+professor/i, rank: 'Assistant Professor', cap: 15 },
    { match: /lecturer/i, rank: 'Confirmed Lecturer (post-workshop)', cap: 10 }
  ],
  /** Sec. 3.1 / 3.2 — supervisor components the logbook is evidence for */
  attendanceMarks: 10,
  continuousAssessmentMarks: { CSE460: 20, CSE461: 20, CSE462: 10 } as Record<string, number>,
  staleSessionDays: 45,
  maxHealthyGapDays: 35
} as const

export const COURSE_TITLES: Record<string, string> = {
  CSE460: 'Final Year Design Project I',
  CSE461: 'Final Year Design Project II',
  CSE462: 'Final Year Design Project III'
}

/** Legacy → BAETE-aligned code map (Guideline Sec. 1) */
export const BAETE_CODES: Record<string, string> = {
  CSE460: 'CSE4098',
  CSE461: 'CSE4198',
  CSE462: 'CSE4298'
}

// ── Flag catalogue ──────────────────────────────────────────────────────────

export type Severity = 'high' | 'moderate' | 'info'

export interface Flag {
  code: string
  label: string
  severity: Severity
  detail?: string
}

// ── Result shapes ───────────────────────────────────────────────────────────

export interface StudentAnalytics {
  student_id: number
  student_code: string
  name: string
  program: string
  email: string
  mobile: string
  sessions_total: number
  sessions_present: number
  sessions_absent: number
  attendance_pct: number
  longest_absence_streak: number
  last_present_date: string | null
  logged_work_entries: number
  logged_plan_entries: number
  documentation_rate: number
  work_volume_words: number
  contribution_share_pct: number
  contribution_ratio: number
  engagement_index: number
  attendance_indicator: number
  ca_evidence_indicator: number
  ca_evidence_max: number
  presence: number[]
  flags: Flag[]
  risk: 'low' | 'moderate' | 'high'
}

export interface SessionAnalytics {
  id: number
  log_date: string
  next_log_date: string
  start_time: string
  end_time: string
  duration_minutes: number
  venue: string
  topic: string
  session_kind: string
  present_count: number
  roster_count: number
  attendance_pct: number
  documented_entries: number
  gap_days: number | null
}

export interface GroupAnalytics {
  group: {
    id: number
    group_name: string
    project_title: string
    course_code: string
    course_title: string
    baete_code: string
    semester: string
    academic_year: string
    co_supervisor_name: string
    co_supervisor_designation: string
    min_required_sessions: number
    status: string
  }
  roster_count: number
  sessions_held: number
  first_session: string | null
  last_session: string | null
  span_days: number
  contact_hours: number
  avg_gap_days: number
  max_gap_days: number
  cadence_stdev_days: number
  group_attendance_pct: number
  documentation_completeness_pct: number
  contribution_imbalance: number
  meets_minimum_sessions: boolean
  group_size_compliant: boolean
  days_since_last_session: number | null
  students: StudentAnalytics[]
  sessions: SessionAnalytics[]
  flags: Flag[]
  risk: 'low' | 'moderate' | 'high'
}

export interface PortfolioAnalytics {
  generated_at: string
  document_id: string
  faculty: any
  rank: { rank: string; cap: number } | null
  totals: {
    groups: number
    students: number
    sessions: number
    contact_hours: number
    avg_attendance_pct: number
    documentation_completeness_pct: number
  }
  by_course: {
    course_code: string
    course_title: string
    baete_code: string
    groups: number
    students: number
    active_students: number
    sessions: number
    contact_hours: number
    avg_attendance_pct: number
    cap: number | null
    cap_utilisation_pct: number | null
    within_cap: boolean | null
  }[]
  by_semester: { semester: string; groups: number; students: number; sessions: number }[]
  attendance_distribution: { bucket: string; count: number }[]
  risk_register: {
    group_name: string
    course_code: string
    subject: string
    scope: 'group' | 'student'
    flags: Flag[]
    risk: 'low' | 'moderate' | 'high'
  }[]
  compliance: { code: string; reference: string; requirement: string; status: 'met' | 'partial' | 'not met'; evidence: string }[]
  groups: GroupAnalytics[]
}

// ── Small helpers ───────────────────────────────────────────────────────────

const wordCount = (s?: string | null): number =>
  !s ? 0 : s.trim().split(/\s+/).filter(Boolean).length

const round = (n: number, dp = 1): number => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

const daysBetween = (a: string, b: string): number => {
  const d1 = new Date(a).getTime()
  const d2 = new Date(b).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2)) return 0
  return Math.round((d2 - d1) / 86_400_000)
}

const stdev = (xs: number[]): number => {
  if (xs.length < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
}

/** Gini coefficient over contribution shares — 0 = perfectly even, 1 = one student did everything */
const gini = (xs: number[]): number => {
  const v = xs.filter((x) => x >= 0)
  const n = v.length
  const total = v.reduce((a, b) => a + b, 0)
  if (n === 0 || total === 0) return 0
  const sorted = [...v].sort((a, b) => a - b)
  let cum = 0
  for (let i = 0; i < n; i++) cum += (i + 1) * sorted[i]
  return round((2 * cum) / (n * total) - (n + 1) / n, 3)
}

/** Stable short code used in place of a handwritten signature (see attendance sheet) */
export function verificationCode(...parts: (string | number)[]): string {
  return crypto
    .createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .slice(0, 6)
    .toUpperCase()
}

export function documentChecksum(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16).toUpperCase()
}

function highestRisk(flags: Flag[]): 'low' | 'moderate' | 'high' {
  if (flags.some((f) => f.severity === 'high')) return 'high'
  if (flags.some((f) => f.severity === 'moderate')) return 'moderate'
  return 'low'
}

// ── Group-level analytics ───────────────────────────────────────────────────

export function buildGroupAnalytics(groupId: number, asOf = new Date()): GroupAnalytics | null {
  const g: any = get('SELECT * FROM groups WHERE id = ?', [groupId])
  if (!g) return null

  const students: any[] = all(
    'SELECT * FROM students WHERE group_id = ? ORDER BY student_id ASC',
    [groupId]
  )
  const sessions: any[] = all(
    'SELECT * FROM log_sessions WHERE group_id = ? ORDER BY log_date ASC',
    [groupId]
  )
  const logsBySession = new Map<number, any[]>()
  for (const s of sessions) {
    logsBySession.set(
      s.id,
      all('SELECT * FROM student_logs WHERE session_id = ?', [s.id])
    )
  }

  const minSessions = Number(g.min_required_sessions) || POLICY.defaultMinSessions
  const courseCode = g.course_code ?? ''

  // ── Sessions ──
  const sessionAnalytics: SessionAnalytics[] = sessions.map((s, i) => {
    const logs = logsBySession.get(s.id) ?? []
    const presentCount = logs.filter((l) => l.present).length
    const documented = logs.filter((l) => wordCount(l.work_done) > 0).length
    return {
      id: s.id,
      log_date: s.log_date,
      next_log_date: s.next_log_date ?? '',
      start_time: s.start_time ?? '',
      end_time: s.end_time ?? '',
      duration_minutes: Number(s.duration_minutes) || 60,
      venue: s.venue ?? '',
      topic: s.topic ?? '',
      session_kind: s.session_kind ?? 'regular',
      present_count: presentCount,
      roster_count: students.length,
      attendance_pct: students.length ? round((presentCount / students.length) * 100, 0) : 0,
      documented_entries: documented,
      gap_days: i === 0 ? null : daysBetween(sessions[i - 1].log_date, s.log_date)
    }
  })

  // ── Per-student ──
  const raw = students.map((st) => {
    const presence: number[] = []
    let present = 0
    let workEntries = 0
    let planEntries = 0
    let words = 0
    let streak = 0
    let longestStreak = 0
    let lastPresent: string | null = null

    for (const s of sessions) {
      const log = (logsBySession.get(s.id) ?? []).find((l) => l.student_id === st.id)
      const isPresent = !!log?.present
      presence.push(isPresent ? 1 : 0)
      if (isPresent) {
        present++
        lastPresent = s.log_date
        streak = 0
        if (wordCount(log?.work_done) > 0) workEntries++
        if (wordCount(log?.work_planned) > 0) planEntries++
        words += wordCount(log?.work_done) + wordCount(log?.work_planned)
      } else {
        streak++
        longestStreak = Math.max(longestStreak, streak)
      }
    }

    return { st, presence, present, workEntries, planEntries, words, longestStreak, lastPresent }
  })

  const totalWords = raw.reduce((a, r) => a + r.words, 0)
  const equalShare = students.length ? 100 / students.length : 0
  const caMax = POLICY.continuousAssessmentMarks[courseCode] ?? 20

  const studentAnalytics: StudentAnalytics[] = raw.map((r) => {
    const total = sessions.length
    const attendancePct = total ? (r.present / total) * 100 : 0
    const documentationRate = r.present ? (r.workEntries / r.present) * 100 : 0
    const sharePct = totalWords ? (r.words / totalWords) * 100 : equalShare
    const ratio = equalShare ? sharePct / equalShare : 1

    // Composite engagement: attendance 40%, documentation 40%, relative contribution 20% (capped at parity)
    const engagement =
      0.4 * attendancePct + 0.4 * documentationRate + 0.2 * Math.min(100, ratio * 100)

    // Derived indicators — supervisor-facing suggestions, not official marks
    const attendanceIndicator = round((attendancePct / 100) * POLICY.attendanceMarks, 1)
    const caIndicator = round(
      (0.5 * documentationRate + 0.3 * attendancePct + 0.2 * Math.min(100, (r.planEntries / Math.max(1, r.present)) * 100)) /
        100 *
        caMax,
      1
    )

    const flags: Flag[] = []
    if (total > 0 && attendancePct < 50)
      flags.push({ code: 'ATTENDANCE_CRITICAL', label: 'Attendance below 50%', severity: 'high', detail: `${round(attendancePct, 0)}% of ${total} sessions` })
    else if (total > 0 && attendancePct < 70)
      flags.push({ code: 'ATTENDANCE_LOW', label: 'Attendance below 70%', severity: 'moderate', detail: `${round(attendancePct, 0)}% of ${total} sessions` })
    if (r.longestStreak >= 3)
      flags.push({ code: 'ABSENCE_STREAK', label: `${r.longestStreak} consecutive sessions missed`, severity: 'high' })
    else if (r.longestStreak === 2)
      flags.push({ code: 'ABSENCE_STREAK_2', label: '2 consecutive sessions missed', severity: 'moderate' })
    if (total >= 2 && r.presence.slice(-2).every((p) => p === 0))
      flags.push({ code: 'RECENT_DISENGAGEMENT', label: 'Absent from the two most recent sessions', severity: 'high' })
    if (r.present > 0 && documentationRate < 60)
      flags.push({ code: 'THIN_DOCUMENTATION', label: 'Work recorded for under 60% of attended sessions', severity: 'moderate', detail: `${r.workEntries}/${r.present} sessions documented` })
    if (students.length > 1 && ratio < 0.6 && totalWords > 0)
      flags.push({ code: 'CONTRIBUTION_LOW', label: 'Documented contribution well below group parity', severity: 'moderate', detail: `${round(sharePct, 1)}% vs ${round(equalShare, 1)}% parity` })
    if (students.length > 1 && ratio > 1.6 && totalWords > 0)
      flags.push({ code: 'CONTRIBUTION_DOMINANT', label: 'Documented contribution well above group parity', severity: 'info', detail: `${round(sharePct, 1)}% vs ${round(equalShare, 1)}% parity` })

    return {
      student_id: r.st.id,
      student_code: r.st.student_id,
      name: r.st.name,
      program: r.st.program ?? 'B.Sc. in CSE',
      email: r.st.email ?? '',
      mobile: r.st.mobile ?? '',
      sessions_total: total,
      sessions_present: r.present,
      sessions_absent: total - r.present,
      attendance_pct: round(attendancePct, 1),
      longest_absence_streak: r.longestStreak,
      last_present_date: r.lastPresent,
      logged_work_entries: r.workEntries,
      logged_plan_entries: r.planEntries,
      documentation_rate: round(documentationRate, 1),
      work_volume_words: r.words,
      contribution_share_pct: round(sharePct, 1),
      contribution_ratio: round(ratio, 2),
      engagement_index: round(engagement, 1),
      attendance_indicator: attendanceIndicator,
      ca_evidence_indicator: caIndicator,
      ca_evidence_max: caMax,
      presence: r.presence,
      flags,
      risk: highestRisk(flags)
    }
  })

  // ── Group aggregates ──
  const gaps = sessionAnalytics.map((s) => s.gap_days).filter((x): x is number => x !== null)
  const first = sessions.length ? sessions[0].log_date : null
  const last = sessions.length ? sessions[sessions.length - 1].log_date : null
  const totalSlots = sessions.length * students.length
  const totalPresent = studentAnalytics.reduce((a, s) => a + s.sessions_present, 0)
  const totalPresentSlots = totalPresent
  const documented = studentAnalytics.reduce((a, s) => a + s.logged_work_entries, 0)
  const asOfIso = asOf.toISOString().split('T')[0]

  const groupFlags: Flag[] = []
  if (sessions.length < minSessions)
    groupFlags.push({
      code: 'BELOW_MIN_SESSIONS',
      label: `Only ${sessions.length} of ${minSessions} required sessions logged`,
      severity: sessions.length < minSessions / 2 ? 'high' : 'moderate',
      detail: 'FYDP Guideline Sec. 10 — regular monitoring meetings'
    })
  if (students.length < POLICY.groupSizeMin || students.length > POLICY.groupSizeMax)
    groupFlags.push({
      code: 'GROUP_SIZE',
      label: `Group size ${students.length} outside the permitted 3–5 range`,
      severity: 'high',
      detail: 'FYDP Guideline Sec. 8'
    })
  if (gaps.length && Math.max(...gaps) > POLICY.maxHealthyGapDays)
    groupFlags.push({
      code: 'IRREGULAR_CADENCE',
      label: `Longest gap between sessions is ${Math.max(...gaps)} days`,
      severity: 'moderate'
    })
  const missingTopics = sessionAnalytics.filter((s) => !s.topic.trim()).length
  if (missingTopics)
    groupFlags.push({
      code: 'MISSING_SESSION_TOPIC',
      label: `${missingTopics} session(s) have no topic of discussion recorded`,
      severity: 'moderate',
      detail: 'Required column on the departmental attendance sheet'
    })
  const imbalance = gini(studentAnalytics.map((s) => s.work_volume_words))
  if (imbalance > 0.25)
    groupFlags.push({
      code: 'CONTRIBUTION_IMBALANCE',
      label: `Uneven documented contribution (imbalance index ${imbalance})`,
      severity: 'moderate',
      detail: 'FYDP Guideline Sec. 8 — individual contribution evidence'
    })
  const daysSinceLast = last ? daysBetween(last, asOfIso) : null
  const groupClosed = g.status === 'completed' || g.status === 'withdrawn'
  if (!groupClosed && daysSinceLast !== null && daysSinceLast > POLICY.staleSessionDays)
    groupFlags.push({
      code: 'STALE_LOG',
      label: `No session logged in the last ${daysSinceLast} days`,
      severity: 'high'
    })
  if (!sessions.length)
    groupFlags.push({ code: 'NO_SESSIONS', label: 'No supervision session logged at all', severity: 'high' })
  if (groupClosed && sessions.length)
    groupFlags.push({
      code: 'CLOSED_COHORT',
      label: `Cohort marked ${g.status}; record retained for archival`,
      severity: 'info'
    })

  const studentRisk = studentAnalytics.flatMap((s) => s.flags)

  return {
    group: {
      id: g.id,
      group_name: g.group_name,
      project_title: g.project_title ?? '',
      course_code: courseCode,
      course_title: COURSE_TITLES[courseCode] ?? '',
      baete_code: BAETE_CODES[courseCode] ?? '',
      semester: g.semester ?? '',
      academic_year: g.academic_year ?? '',
      co_supervisor_name: g.co_supervisor_name ?? '',
      co_supervisor_designation: g.co_supervisor_designation ?? '',
      min_required_sessions: minSessions,
      status: g.status ?? 'active'
    },
    roster_count: students.length,
    sessions_held: sessions.length,
    first_session: first,
    last_session: last,
    span_days: first && last ? daysBetween(first, last) : 0,
    contact_hours: round(sessionAnalytics.reduce((a, s) => a + s.duration_minutes, 0) / 60, 1),
    avg_gap_days: gaps.length ? round(gaps.reduce((a, b) => a + b, 0) / gaps.length, 1) : 0,
    max_gap_days: gaps.length ? Math.max(...gaps) : 0,
    cadence_stdev_days: round(stdev(gaps), 1),
    group_attendance_pct: totalSlots ? round((totalPresentSlots / totalSlots) * 100, 1) : 0,
    documentation_completeness_pct: totalPresentSlots ? round((documented / totalPresentSlots) * 100, 1) : 0,
    contribution_imbalance: imbalance,
    meets_minimum_sessions: sessions.length >= minSessions,
    group_size_compliant: students.length >= POLICY.groupSizeMin && students.length <= POLICY.groupSizeMax,
    days_since_last_session: daysSinceLast,
    students: studentAnalytics,
    sessions: sessionAnalytics,
    flags: groupFlags,
    risk: highestRisk([...groupFlags, ...studentRisk])
  }
}

// ── Portfolio-level analytics ───────────────────────────────────────────────

function resolveRank(designation: string): { rank: string; cap: number } | null {
  const d = designation ?? ''
  for (const entry of POLICY.loadCapByRank) {
    if (!entry.match.test(d)) continue
    if ((entry as any).exclude && (entry as any).exclude.test(d)) continue
    return { rank: entry.rank, cap: entry.cap }
  }
  return null
}

export function buildPortfolioAnalytics(asOf = new Date()): PortfolioAnalytics {
  const faculty = get('SELECT * FROM faculty WHERE id = 1')
  const groupRows: any[] = all('SELECT id FROM groups ORDER BY course_code ASC, group_name ASC')
  const groups = groupRows
    .map((r) => buildGroupAnalytics(r.id, asOf))
    .filter((g): g is GroupAnalytics => g !== null)

  const rank = resolveRank(faculty?.designation ?? '')

  const totalStudents = groups.reduce((a, g) => a + g.roster_count, 0)
  const totalSessions = groups.reduce((a, g) => a + g.sessions_held, 0)
  const attendanceWeighted = groups.reduce((a, g) => a + g.group_attendance_pct * g.roster_count, 0)
  const docWeighted = groups.reduce((a, g) => a + g.documentation_completeness_pct * g.roster_count, 0)

  // ── Per course ──
  const courseCodes = Object.keys(COURSE_TITLES)
  const by_course = courseCodes.map((code) => {
    const gs = groups.filter((g) => g.group.course_code === code)
    const students = gs.reduce((a, g) => a + g.roster_count, 0)
    // Caps in Sec. 5.1 constrain concurrent load, so completed cohorts are excluded
    const activeStudents = gs
      .filter((g) => g.group.status !== 'completed' && g.group.status !== 'withdrawn')
      .reduce((a, g) => a + g.roster_count, 0)
    const att = gs.reduce((a, g) => a + g.group_attendance_pct * g.roster_count, 0)
    return {
      course_code: code,
      course_title: COURSE_TITLES[code],
      baete_code: BAETE_CODES[code],
      groups: gs.length,
      students,
      active_students: activeStudents,
      sessions: gs.reduce((a, g) => a + g.sessions_held, 0),
      contact_hours: round(gs.reduce((a, g) => a + g.contact_hours, 0), 1),
      avg_attendance_pct: students ? round(att / students, 1) : 0,
      cap: rank?.cap ?? null,
      cap_utilisation_pct: rank ? round((activeStudents / rank.cap) * 100, 1) : null,
      within_cap: rank ? activeStudents <= rank.cap : null
    }
  })

  // ── Per semester ──
  const semesterMap = new Map<string, { groups: number; students: number; sessions: number }>()
  for (const g of groups) {
    const key = g.group.semester || 'Unspecified'
    const e = semesterMap.get(key) ?? { groups: 0, students: 0, sessions: 0 }
    e.groups++
    e.students += g.roster_count
    e.sessions += g.sessions_held
    semesterMap.set(key, e)
  }

  // ── Attendance distribution ──
  const buckets = [
    { bucket: '90–100%', test: (p: number) => p >= 90 },
    { bucket: '75–89%', test: (p: number) => p >= 75 && p < 90 },
    { bucket: '60–74%', test: (p: number) => p >= 60 && p < 75 },
    { bucket: '50–59%', test: (p: number) => p >= 50 && p < 60 },
    { bucket: 'Below 50%', test: (p: number) => p < 50 }
  ]
  const allStudents = groups.flatMap((g) => g.students)
  const attendance_distribution = buckets.map((b) => ({
    bucket: b.bucket,
    count: allStudents.filter((s) => b.test(s.attendance_pct)).length
  }))

  // ── Risk register ──
  const risk_register: PortfolioAnalytics['risk_register'] = []
  for (const g of groups) {
    if (g.flags.length)
      risk_register.push({
        group_name: g.group.group_name,
        course_code: g.group.course_code,
        subject: g.group.group_name,
        scope: 'group',
        flags: g.flags,
        risk: highestRisk(g.flags)
      })
    for (const s of g.students) {
      if (s.flags.some((f) => f.severity !== 'info'))
        risk_register.push({
          group_name: g.group.group_name,
          course_code: g.group.course_code,
          subject: `${s.name} (${s.student_code})`,
          scope: 'student',
          flags: s.flags.filter((f) => f.severity !== 'info'),
          risk: s.risk
        })
    }
  }
  const order = { high: 0, moderate: 1, low: 2 }
  risk_register.sort((a, b) => order[a.risk] - order[b.risk])

  // ── Compliance matrix against the FYDP Guideline ──
  const sizeOk = groups.filter((g) => g.group_size_compliant).length
  const minOk = groups.filter((g) => g.meets_minimum_sessions).length
  const topicOk = groups.filter((g) => !g.flags.some((f) => f.code === 'MISSING_SESSION_TOPIC')).length
  const compliance: PortfolioAnalytics['compliance'] = [
    {
      code: 'SEC-8',
      reference: 'Sec. 8 — Group Formation',
      requirement: 'Each FYDP group consists of 3 to 5 students.',
      status: groups.length === 0 ? 'not met' : sizeOk === groups.length ? 'met' : 'partial',
      evidence: `${sizeOk} of ${groups.length} groups within the 3–5 range.`
    },
    {
      code: 'SEC-10-A',
      reference: 'Sec. 10 — Supervisor Logbook',
      requirement: 'A structured supervision logbook is maintained for each group.',
      status: groups.length && groups.every((g) => g.sessions_held > 0) ? 'met' : groups.length ? 'partial' : 'not met',
      evidence: `${totalSessions} logged sessions across ${groups.length} groups; ${round(
        totalStudents ? docWeighted / totalStudents : 0,
        1
      )}% of attended sessions carry a written work record.`
    },
    {
      code: 'SEC-10-B',
      reference: 'Sec. 10 — Regular monitoring meetings',
      requirement: 'Each group holds regular monitoring meetings during the semester.',
      status: groups.length === 0 ? 'not met' : minOk === groups.length ? 'met' : 'partial',
      evidence: `${minOk} of ${groups.length} groups met the minimum session count set for the semester.`
    },
    {
      code: 'SEC-10-C',
      reference: 'Sec. 10 — Logbook content',
      requirement: 'The logbook records meeting dates, attendance, work assigned and completed, and next milestones.',
      status: groups.length === 0 ? 'not met' : topicOk === groups.length ? 'met' : 'partial',
      evidence: `${topicOk} of ${groups.length} groups have a topic of discussion recorded for every session; per-student work-done and work-planned fields are captured per session.`
    },
    {
      code: 'SEC-3',
      reference: 'Sec. 3.1 / 3.2 — Supervisor marks components',
      requirement: 'Attendance and Continuous Assessment marks are evidence-based.',
      status: totalSessions ? 'met' : 'not met',
      evidence: 'Attendance and continuous-assessment indicators are derived arithmetically per student and reproducible from this logbook.'
    },
    {
      code: 'SEC-5.1',
      reference: 'Sec. 5.1 — Supervision load limits',
      requirement: 'A supervisor does not exceed the per-course student cap for their rank (concurrent load).',
      status: !rank ? 'partial' : by_course.every((c) => c.within_cap !== false) ? 'met' : 'not met',
      evidence: rank
        ? `Rank resolved as ${rank.rank} (cap ${rank.cap} students per course). Active load — ` +
          by_course
            .filter((c) => c.students > 0)
            .map((c) => `${c.course_code}: ${c.active_students}/${rank.cap}`)
            .join('; ')
        : 'Supervisor rank could not be resolved from the designation field; cap check not performed.'
    },
    {
      code: 'SEC-12',
      reference: 'Sec. 12 — Semester monitoring',
      requirement: 'Monitoring is performed separately in each semester.',
      status: semesterMap.size ? 'met' : 'not met',
      evidence: `Records held for ${semesterMap.size} semester(s): ${[...semesterMap.keys()].join(', ') || '—'}.`
    }
  ]

  const totals = {
    groups: groups.length,
    students: totalStudents,
    sessions: totalSessions,
    contact_hours: round(groups.reduce((a, g) => a + g.contact_hours, 0), 1),
    avg_attendance_pct: totalStudents ? round(attendanceWeighted / totalStudents, 1) : 0,
    documentation_completeness_pct: totalStudents ? round(docWeighted / totalStudents, 1) : 0
  }

  return {
    generated_at: asOf.toISOString(),
    document_id: `FYDP-LOG-${asOf.toISOString().split('T')[0]}-${documentChecksum({
      totals,
      groups: groups.map((g) => [g.group.id, g.sessions_held, g.roster_count])
    }).slice(0, 8)}`,
    faculty,
    rank,
    totals,
    by_course,
    by_semester: [...semesterMap.entries()].map(([semester, v]) => ({ semester, ...v })),
    attendance_distribution,
    risk_register,
    compliance,
    groups
  }
}
