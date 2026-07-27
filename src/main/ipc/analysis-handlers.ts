import { ipcMain } from 'electron'
import { buildGroupAnalytics, buildPortfolioAnalytics, POLICY } from '../analytics'

export function registerAnalysisHandlers(): void {
  ipcMain.handle('analysis:group', (_e, groupId: number) => buildGroupAnalytics(groupId))

  ipcMain.handle('analysis:portfolio', () => buildPortfolioAnalytics())

  ipcMain.handle('analysis:policy', () => ({
    groupSizeMin: POLICY.groupSizeMin,
    groupSizeMax: POLICY.groupSizeMax,
    defaultMinSessions: POLICY.defaultMinSessions,
    attendanceMarks: POLICY.attendanceMarks,
    continuousAssessmentMarks: POLICY.continuousAssessmentMarks
  }))
}
