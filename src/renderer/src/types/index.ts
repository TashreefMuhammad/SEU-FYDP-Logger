export interface Faculty {
  id: number
  name: string
  initials: string
  designation: string
  department: string
  university: string
  email: string
  updated_at: string
}

export const FYDP_COURSES = [
  { code: 'CSE460', title: 'Final Year Design Project I' },
  { code: 'CSE461', title: 'Final Year Design Project II' },
  { code: 'CSE462', title: 'Final Year Design Project III' }
] as const

export type FYDPCourseCode = 'CSE460' | 'CSE461' | 'CSE462'

export interface Group {
  id: number
  group_name: string
  project_title: string
  course_code: FYDPCourseCode | ''
  semester: string
  academic_year: string
  co_supervisor_name: string
  co_supervisor_designation: string
  min_required_sessions: number
  status: string
  created_at: string
}

export interface Student {
  id: number
  student_id: string
  name: string
  program: string
  email: string
  mobile: string
  group_id: number
}

export interface LogSession {
  id: number
  group_id: number
  log_date: string
  next_log_date: string
  venue: string
  start_time: string
  end_time: string
  duration_minutes: number
  topic: string
  session_kind: string
  created_at: string
}

export interface StudentLog {
  id: number
  session_id: number
  student_id: number
  student_code: string
  student_name: string
  present: number
  work_done: string
  work_planned: string
  faculty_notes: string
}

export interface Report {
  id: number
  group_id: number
  report_type: 'attendance' | 'progress' | 'contribution' | 'summary'
  generated_content: string
  edited_content: string
  generated_at: string
}

export interface Settings {
  gemini_api_key?: string
  [key: string]: string | undefined
}


// ── Analysis result shapes ──────────────────────────────────────────────────
// Mirrors src/main/analytics.ts — keep the two in sync.

export type Severity = 'high' | 'moderate' | 'info'
export type RiskLevel = 'low' | 'moderate' | 'high'

export interface Flag {
  code: string
  label: string
  severity: Severity
  detail?: string
}

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
  risk: RiskLevel
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
  risk: RiskLevel
}

export interface PortfolioAnalytics {
  generated_at: string
  document_id: string
  faculty: Faculty | null
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
    risk: RiskLevel
  }[]
  compliance: {
    code: string
    reference: string
    requirement: string
    status: 'met' | 'partial' | 'not met'
    evidence: string
  }[]
  groups: GroupAnalytics[]
}

export type SignatureMode = 'attested' | 'both' | 'physical'

export interface PdfResult {
  success: boolean
  path?: string
  message?: string
}

// ── Window API types (exposed via preload) ──────────────────────────────────
declare global {
  interface Window {
    api: {
      getFaculty: () => Promise<Faculty | null>
      saveFaculty: (data: Partial<Faculty>) => Promise<Faculty>

      getGroups: () => Promise<Group[]>
      createGroup: (data: Partial<Group>) => Promise<Group>
      updateGroup: (id: number, data: Partial<Group>) => Promise<Group>
      deleteGroup: (id: number) => Promise<boolean>

      getStudentsByGroup: (groupId: number) => Promise<Student[]>
      addStudent: (data: Partial<Student>) => Promise<Student>
      updateStudent: (id: number, data: Partial<Student>) => Promise<Student>
      deleteStudent: (id: number) => Promise<boolean>

      getSessionsByGroup: (groupId: number) => Promise<LogSession[]>
      createSession: (data: Partial<LogSession>) => Promise<LogSession>
      updateSession: (id: number, data: Partial<LogSession>) => Promise<LogSession>
      deleteSession: (id: number) => Promise<boolean>

      getStudentLogsBySession: (sessionId: number) => Promise<StudentLog[]>
      saveStudentLog: (data: Partial<StudentLog> & { present: boolean }) => Promise<boolean>

      getReportsByGroup: (groupId: number) => Promise<Report[]>
      saveReport: (data: Partial<Report>) => Promise<Report>
      updateReportEdited: (id: number, content: string) => Promise<boolean>
      deleteReport: (id: number) => Promise<boolean>

      getSettings: () => Promise<Settings>
      setSetting: (key: string, value: string) => Promise<boolean>

      generateReport: (type: string, payload: any) => Promise<string>

      getGroupAnalysis: (groupId: number) => Promise<GroupAnalytics | null>
      getPortfolioAnalysis: () => Promise<PortfolioAnalytics>
      getPolicy: () => Promise<{
        groupSizeMin: number
        groupSizeMax: number
        defaultMinSessions: number
        attendanceMarks: number
        continuousAssessmentMarks: Record<string, number>
      }>

      exportAttendanceSheets: (
        groupId: number,
        options?: { signatureMode?: SignatureMode; studentIds?: number[] }
      ) => Promise<PdfResult>
      exportAllAttendanceSheets: (options?: { signatureMode?: SignatureMode }) => Promise<PdfResult>
      exportGroupAnalysisPdf: (
        groupId: number,
        options?: { includeTranscript?: boolean }
      ) => Promise<PdfResult>
      exportDossierPdf: (options?: {
        includeAttendanceSheets?: boolean
        includeTranscripts?: boolean
        signatureMode?: SignatureMode
        courseFilter?: string[]
      }) => Promise<PdfResult>
      exportReportAsPdf: (reportId: number) => Promise<PdfResult>

      exportToJson: () => Promise<{ success: boolean; path?: string; message?: string }>
      importFromJson: () => Promise<{ success: boolean; message?: string }>
      exportReportAsHtml: (reportId: number) => Promise<{ success: boolean; path?: string; message?: string }>
    }
  }
}
