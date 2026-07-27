import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Faculty
  getFaculty: () => ipcRenderer.invoke('faculty:get'),
  saveFaculty: (data: any) => ipcRenderer.invoke('faculty:save', data),

  // Groups
  getGroups: () => ipcRenderer.invoke('groups:getAll'),
  createGroup: (data: any) => ipcRenderer.invoke('groups:create', data),
  updateGroup: (id: number, data: any) => ipcRenderer.invoke('groups:update', id, data),
  deleteGroup: (id: number) => ipcRenderer.invoke('groups:delete', id),

  // Students
  getStudentsByGroup: (groupId: number) => ipcRenderer.invoke('students:getByGroup', groupId),
  addStudent: (data: any) => ipcRenderer.invoke('students:add', data),
  updateStudent: (id: number, data: any) => ipcRenderer.invoke('students:update', id, data),
  deleteStudent: (id: number) => ipcRenderer.invoke('students:delete', id),

  // Sessions
  getSessionsByGroup: (groupId: number) => ipcRenderer.invoke('sessions:getByGroup', groupId),
  createSession: (data: any) => ipcRenderer.invoke('sessions:create', data),
  updateSession: (id: number, data: any) => ipcRenderer.invoke('sessions:update', id, data),
  deleteSession: (id: number) => ipcRenderer.invoke('sessions:delete', id),

  // Student Logs
  getStudentLogsBySession: (sessionId: number) =>
    ipcRenderer.invoke('studentLogs:getBySession', sessionId),
  saveStudentLog: (data: any) => ipcRenderer.invoke('studentLogs:save', data),

  // Reports
  getReportsByGroup: (groupId: number) => ipcRenderer.invoke('reports:getByGroup', groupId),
  saveReport: (data: any) => ipcRenderer.invoke('reports:save', data),
  updateReportEdited: (id: number, content: string) =>
    ipcRenderer.invoke('reports:updateEdited', id, content),
  deleteReport: (id: number) => ipcRenderer.invoke('reports:delete', id),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

  // Gemini
  generateReport: (type: string, payload: any) =>
    ipcRenderer.invoke('gemini:generate', type, payload),

  // Analysis (deterministic, computed in the main process)
  getGroupAnalysis: (groupId: number) => ipcRenderer.invoke('analysis:group', groupId),
  getPortfolioAnalysis: () => ipcRenderer.invoke('analysis:portfolio'),
  getPolicy: () => ipcRenderer.invoke('analysis:policy'),

  // PDF documents
  exportAttendanceSheets: (groupId: number, options?: any) =>
    ipcRenderer.invoke('pdf:attendanceSheets', groupId, options ?? {}),
  exportAllAttendanceSheets: (options?: any) =>
    ipcRenderer.invoke('pdf:allAttendanceSheets', options ?? {}),
  exportGroupAnalysisPdf: (groupId: number, options?: any) =>
    ipcRenderer.invoke('pdf:groupAnalysis', groupId, options ?? {}),
  exportDossierPdf: (options?: any) => ipcRenderer.invoke('pdf:dossier', options ?? {}),
  exportReportAsPdf: (reportId: number) => ipcRenderer.invoke('pdf:report', reportId),

  // Import/Export
  exportToJson: () => ipcRenderer.invoke('export:toJson'),
  importFromJson: () => ipcRenderer.invoke('export:fromJson'),
  exportReportAsHtml: (reportId: number) => ipcRenderer.invoke('export:reportAsHtml', reportId)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
