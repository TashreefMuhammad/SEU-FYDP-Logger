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

export interface Group {
  id: number
  group_name: string
  project_title: string
  semester: string
  academic_year: string
  created_at: string
}

export interface Student {
  id: number
  student_id: string
  name: string
  group_id: number
}

export interface LogSession {
  id: number
  group_id: number
  log_date: string
  next_log_date: string
  venue: string
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

      exportToJson: () => Promise<{ success: boolean; path?: string; message?: string }>
      importFromJson: () => Promise<{ success: boolean; message?: string }>
      exportReportAsHtml: (reportId: number) => Promise<{ success: boolean; path?: string; message?: string }>
    }
  }
}
