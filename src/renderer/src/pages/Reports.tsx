import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Group, Report } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Dialog } from '@/components/ui/dialog'
import {
  Sparkles,
  FileText,
  Trash2,
  Download,
  Pencil,
  Save,
  Loader2,
  Printer,
  BarChart2,
  Users,
  ClipboardCheck,
  BookOpen
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'

const REPORT_TYPES = [
  { key: 'attendance', label: 'Attendance Report', icon: Users, color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'progress', label: 'Progress Report', icon: BookOpen, color: 'bg-green-50 border-green-200 text-green-700' },
  { key: 'contribution', label: 'Contribution Analysis', icon: BarChart2, color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { key: 'summary', label: 'Overall Summary', icon: ClipboardCheck, color: 'bg-orange-50 border-orange-200 text-orange-700' }
]

export default function Reports() {
  const { groups, faculty } = useStore()
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editingReport, setEditingReport] = useState<Report | null>(null)
  const [editContent, setEditContent] = useState('')

  // Chart data for selected group
  const [chartData, setChartData] = useState<any>(null)

  useEffect(() => {
    if (selectedGroupId) loadReports(selectedGroupId)
  }, [selectedGroupId])

  const loadReports = async (groupId: number) => {
    const r = await window.api.getReportsByGroup(groupId)
    setReports(r)
    await buildChartData(groupId)
  }

  const buildChartData = async (groupId: number) => {
    const sessions = await window.api.getSessionsByGroup(groupId)
    const students = await window.api.getStudentsByGroup(groupId)
    if (!sessions.length || !students.length) { setChartData(null); return }

    // Attendance per student
    const presence: Record<string, number[]> = {}
    for (const s of students) presence[s.name] = []

    for (const sess of sessions) {
      const logs = await window.api.getStudentLogsBySession(sess.id)
      for (const s of students) {
        const log = logs.find((l) => l.student_id === s.id)
        presence[s.name].push(log?.present ? 1 : 0)
      }
    }

    const sessionDates = sessions.map((s) => formatDate(s.log_date))

    setChartData({ presence, sessionDates, students: students.map((s) => s.name) })
  }

  const buildPayload = async (type: string, groupId: number) => {
    const group = groups.find((g) => g.id === groupId)
    const sessions = await window.api.getSessionsByGroup(groupId)
    const students = await window.api.getStudentsByGroup(groupId)

    const sessionsWithLogs = await Promise.all(
      sessions.map(async (sess) => ({
        ...sess,
        log_date_formatted: formatDate(sess.log_date),
        studentLogs: await window.api.getStudentLogsBySession(sess.id)
      }))
    )

    return { faculty, group, students, sessions: sessionsWithLogs }
  }

  const generateReport = async (type: string) => {
    if (!selectedGroupId) return
    if (!faculty) { setError('Set up your faculty profile in Settings first.'); return }
    setError('')
    setGenerating(type)
    try {
      const payload = await buildPayload(type, selectedGroupId)
      const content = await window.api.generateReport(type, payload)
      const saved = await window.api.saveReport({
        group_id: selectedGroupId,
        report_type: type as any,
        generated_content: content
      })
      setReports((prev) => [saved, ...prev])
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate report.')
    } finally {
      setGenerating(null)
    }
  }

  const openEdit = (r: Report) => {
    setEditingReport(r)
    setEditContent(r.edited_content ?? r.generated_content ?? '')
    setEditDialog(true)
  }

  const saveEdit = async () => {
    if (!editingReport) return
    await window.api.updateReportEdited(editingReport.id, editContent)
    setReports((prev) =>
      prev.map((r) => (r.id === editingReport.id ? { ...r, edited_content: editContent } : r))
    )
    setEditDialog(false)
  }

  const deleteReport = async (id: number) => {
    if (!confirm('Delete this report?')) return
    await window.api.deleteReport(id)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  const exportReport = async (r: Report) => {
    const result = await window.api.exportReportAsHtml(r.id)
    if (!result.success && result.message !== 'Cancelled') setError(result.message ?? 'Export failed.')
  }

  const exportReportPdf = async (r: Report) => {
    const result = await window.api.exportReportAsPdf(r.id)
    if (!result.success && result.message !== 'Cancelled') setError(result.message ?? 'Export failed.')
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  const attendanceChartOptions = chartData
    ? {
        tooltip: { trigger: 'axis' },
        legend: { data: chartData.students },
        xAxis: { type: 'category', data: chartData.sessionDates, axisLabel: { rotate: 30 } },
        yAxis: { type: 'value', max: 1, axisLabel: { formatter: (v: number) => (v ? 'Present' : 'Absent') } },
        series: chartData.students.map((name: string) => ({
          name,
          type: 'bar',
          data: chartData.presence[name],
          stack: name
        }))
      }
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Reports</h1>
      <Alert variant="info" className="mb-5">
        These reports are drafted by Gemini from your log entries and are useful as narrative summaries.
        For figures that go in front of a board or an accreditation panel, use the{' '}
        <strong>Analysis Portal</strong>, which computes everything arithmetically from the logbook.
      </Alert>

      {/* Group selector */}
      <Card className="mb-5">
        <CardContent className="py-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">Select Group</label>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                  selectedGroupId === g.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {g.group_name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedGroup && (
        <>
          {error && <Alert variant="error" className="mb-4">{error}</Alert>}

          {/* Generate buttons */}
          <Card className="mb-5">
            <CardHeader>
              <CardTitle>Generate New Report via Gemini AI</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                All log entries for <strong>{selectedGroup.group_name}</strong> will be sent to Gemini to generate the selected report. You can edit the result before exporting.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {REPORT_TYPES.map(({ key, label, icon: Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => generateReport(key)}
                    disabled={!!generating}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-opacity disabled:opacity-50 ${color}`}
                  >
                    {generating === key ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Icon size={16} />
                    )}
                    {generating === key ? 'Generating...' : label}
                    {generating !== key && <Sparkles size={12} className="ml-auto opacity-60" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Attendance chart */}
          {chartData && (
            <Card className="mb-5">
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ReactECharts option={attendanceChartOptions} style={{ height: 220 }} />
              </CardContent>
            </Card>
          )}

          {/* Existing reports */}
          {reports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Reports ({reports.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                      <th className="text-left px-6 py-3 font-medium text-gray-500">Generated</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => {
                      const typeMeta = REPORT_TYPES.find((t) => t.key === r.report_type)
                      const Icon = typeMeta?.icon ?? FileText
                      return (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <Icon size={14} className="text-gray-400" />
                              <span className="font-medium text-gray-800">
                                {typeMeta?.label ?? r.report_type}
                              </span>
                              {r.edited_content !== r.generated_content && (
                                <Badge variant="warning">Edited</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-gray-500">{formatDate(r.generated_at)}</td>
                          <td className="px-6 py-3">
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                                <Pencil size={13} /> Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => exportReportPdf(r)}>
                                <Printer size={13} /> PDF
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => exportReport(r)}>
                                <Download size={13} /> HTML
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteReport(r.id)}>
                                <Trash2 size={13} className="text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Edit dialog */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        title="Edit Report"
        className="max-w-3xl mx-4"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-500">
            Edit the generated Markdown report below. Changes are saved locally.
          </p>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-[50vh] rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={saveEdit}>
              <Save size={14} /> Save Changes
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
