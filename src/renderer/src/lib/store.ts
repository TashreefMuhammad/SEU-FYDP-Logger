import { create } from 'zustand'
import type { Faculty, Group, Student, LogSession, StudentLog, Report, Settings } from '../types'

interface AppStore {
  faculty: Faculty | null
  groups: Group[]
  selectedGroupId: number | null
  students: Student[]
  sessions: LogSession[]
  selectedSessionId: number | null
  studentLogs: StudentLog[]
  reports: Report[]
  settings: Settings

  setFaculty: (f: Faculty | null) => void
  setGroups: (g: Group[]) => void
  setSelectedGroupId: (id: number | null) => void
  setStudents: (s: Student[]) => void
  setSessions: (s: LogSession[]) => void
  setSelectedSessionId: (id: number | null) => void
  setStudentLogs: (l: StudentLog[]) => void
  setReports: (r: Report[]) => void
  setSettings: (s: Settings) => void
}

export const useStore = create<AppStore>((set) => ({
  faculty: null,
  groups: [],
  selectedGroupId: null,
  students: [],
  sessions: [],
  selectedSessionId: null,
  studentLogs: [],
  reports: [],
  settings: {},

  setFaculty: (faculty) => set({ faculty }),
  setGroups: (groups) => set({ groups }),
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
  setStudents: (students) => set({ students }),
  setSessions: (sessions) => set({ sessions }),
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setStudentLogs: (studentLogs) => set({ studentLogs }),
  setReports: (reports) => set({ reports }),
  setSettings: (settings) => set({ settings })
}))
