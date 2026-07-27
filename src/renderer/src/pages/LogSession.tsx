import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { runAction, runLoad, toast } from '@/lib/toast'
import type { Group, LogSession, StudentLog } from '@/types'
import { formatDate, todayIso } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import {
  ChevronDown,
  Plus,
  Save,
  Trash2,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Pencil
} from 'lucide-react'

export default function LogSession() {
  const [searchParams] = useSearchParams()
  const { groups, setGroups } = useStore()
  const refreshTick = useStore((s) => s.refreshTick)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    searchParams.get('group') ? Number(searchParams.get('group')) : null
  )
  const [sessions, setSessions] = useState<LogSession[]>([])
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null)
  const [studentLogs, setStudentLogs] = useState<Record<number, StudentLog[]>>({})
  const [savingLog, setSavingLog] = useState<Record<string, boolean>>({})
  const [savedLog, setSavedLog] = useState<Record<string, boolean>>({})

  // Session dialog
  const [sessionDialog, setSessionDialog] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [editingSession, setEditingSession] = useState<LogSession | null>(null)
  const [sessionForm, setSessionForm] = useState({
    log_date: todayIso(),
    next_log_date: '',
    venue: '',
    start_time: '10:00',
    end_time: '11:00',
    topic: '',
    session_kind: 'regular'
  })

  useEffect(() => {
    runLoad('groups', () => window.api.getGroups()).then((g) => g && setGroups(g))
  }, [refreshTick])

  useEffect(() => {
    if (selectedGroupId) loadSessions(selectedGroupId)
    if (expandedSessionId !== null) loadStudentLogs(expandedSessionId)
  }, [selectedGroupId, refreshTick])

  const loadSessions = async (groupId: number) => {
    const s = await runLoad('sessions', () => window.api.getSessionsByGroup(groupId))
    if (s) setSessions(s)
  }

  const loadStudentLogs = async (sessionId: number) => {
    const logs = await runLoad('session log', () => window.api.getStudentLogsBySession(sessionId))
    if (logs) setStudentLogs((prev) => ({ ...prev, [sessionId]: logs }))
  }

  const toggleSession = (id: number) => {
    const next = expandedSessionId === id ? null : id
    setExpandedSessionId(next)
    if (next !== null) loadStudentLogs(next)
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null

  // ── Session CRUD ──────────────────────────────────────────────────────────
  const openNewSession = () => {
    setEditingSession(null)
    setSessionForm({
      log_date: todayIso(),
      next_log_date: '',
      venue: '',
      start_time: '10:00',
      end_time: '11:00',
      topic: '',
      session_kind: 'regular'
    })
    setSessionDialog(true)
  }

  const openEditSession = (s: LogSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSession(s)
    setSessionForm({
      log_date: s.log_date,
      next_log_date: s.next_log_date ?? '',
      venue: s.venue ?? '',
      start_time: s.start_time ?? '10:00',
      end_time: s.end_time ?? '11:00',
      topic: s.topic ?? '',
      session_kind: s.session_kind ?? 'regular'
    })
    setSessionDialog(true)
  }

  const saveSession = async () => {
    if (!selectedGroupId) return
    if (!sessionForm.topic.trim()) {
      setSessionError('Topic of discussion is required — it is a column on the departmental attendance sheet.')
      return
    }
    setSessionError('')
    if (editingSession) {
      const ok = await runAction(
        'Session updated.',
        () => window.api.updateSession(editingSession.id, { ...sessionForm, group_id: selectedGroupId }),
        { onError: (i) => setSessionError(i.message) }
      )
      if (ok === undefined) return
    } else {
      const created = await runAction(
        'Session logged.',
        () => window.api.createSession({ ...sessionForm, group_id: selectedGroupId }),
        { onError: (i) => setSessionError(i.message) }
      )
      if (created === undefined) return
      setExpandedSessionId(created.id)
    }
    await loadSessions(selectedGroupId)
    setSessionDialog(false)
  }

  const deleteSession = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this session and all its log entries?')) return
    const ok = await runAction('Session deleted.', () => window.api.deleteSession(id))
    if (ok === undefined) return
    if (selectedGroupId) await loadSessions(selectedGroupId)
    if (expandedSessionId === id) setExpandedSessionId(null)
  }

  // ── Student log inline save ───────────────────────────────────────────────
  const updateLog = (sessionId: number, studentId: number, field: keyof StudentLog, value: any) => {
    setStudentLogs((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] ?? []).map((l) =>
        l.student_id === studentId ? { ...l, [field]: value } : l
      )
    }))
  }

  const saveLog = async (log: StudentLog) => {
    const key = `${log.session_id}_${log.student_id}`
    setSavingLog((p) => ({ ...p, [key]: true }))
    const ok = await runAction(
      'Entry saved.',
      () =>
        window.api.saveStudentLog({
          session_id: log.session_id,
          student_id: log.student_id,
          present: !!log.present,
          work_done: log.work_done,
          work_planned: log.work_planned,
          faculty_notes: log.faculty_notes
        }),
      { silent: true }
    )
    setSavingLog((p) => ({ ...p, [key]: false }))
    if (ok === undefined) return
    setSavedLog((p) => ({ ...p, [key]: true }))
    setTimeout(() => setSavedLog((p) => ({ ...p, [key]: false })), 1500)
  }

  const saveAllLogs = async (sessionId: number) => {
    const logs = studentLogs[sessionId] ?? []
    for (const log of logs) await saveLog(log)
    toast.success(`Saved ${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}.`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Log Session</h1>

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
            {groups.length === 0 && (
              <p className="text-sm text-gray-400">No groups found. Create groups first.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedGroup && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{selectedGroup.group_name}</h2>
              {selectedGroup.project_title && (
                <p className="text-sm text-gray-500">{selectedGroup.project_title}</p>
              )}
            </div>
            <Button onClick={openNewSession}>
              <Plus size={14} /> New Session
            </Button>
          </div>

          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <ClipboardList size={36} className="mx-auto text-gray-200 mb-3" />
                <p className="text-sm text-gray-500 mb-3">No sessions yet for this group.</p>
                <Button onClick={openNewSession}>
                  <Plus size={14} /> Start First Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((sess) => {
                const isOpen = expandedSessionId === sess.id
                const logs = studentLogs[sess.id] ?? []
                const presentCount = logs.filter((l) => l.present).length
                return (
                  <Card key={sess.id}>
                    <div
                      className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 rounded-t-lg"
                      onClick={() => toggleSession(sess.id)}
                    >
                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">
                          {formatDate(sess.log_date)}
                          {sess.start_time && (
                            <span className="ml-2 font-normal text-gray-500">
                              {sess.start_time}–{sess.end_time}
                            </span>
                          )}
                          {sess.topic && <span className="font-normal text-gray-700"> · {sess.topic}</span>}
                        </p>
                        {sess.next_log_date && (
                          <p className="text-xs text-gray-500">
                            Next session: {formatDate(sess.next_log_date)}
                          </p>
                        )}
                        {!sess.topic && (
                          <p className="text-xs text-yellow-600">
                            No topic recorded — required on the attendance sheet.
                          </p>
                        )}
                      </div>
                      {isOpen && (
                        <Badge variant={presentCount > 0 ? 'success' : 'default'}>
                          {presentCount}/{logs.length} present
                        </Badge>
                      )}
                      {sess.venue && <Badge>{sess.venue}</Badge>}
                      <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={(e) => openEditSession(sess, e)}>
                          <Pencil size={12} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => deleteSession(sess.id, e)}>
                          <Trash2 size={12} className="text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-gray-100 px-5 py-4">
                        {logs.length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-4">
                            No students in this group yet.
                          </p>
                        ) : (
                          <>
                            <div className="flex justify-end mb-3">
                              <Button
                                size="sm"
                                onClick={() => saveAllLogs(sess.id)}
                              >
                                <Save size={13} /> Save All
                              </Button>
                            </div>
                            <div className="flex flex-col gap-4">
                              {logs.map((log) => {
                                const key = `${log.session_id}_${log.student_id}`
                                return (
                                  <div
                                    key={log.student_id}
                                    className={`rounded-lg border p-4 transition-colors ${
                                      log.present
                                        ? 'border-green-200 bg-green-50/40'
                                        : 'border-gray-200 bg-gray-50/40'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 mb-3">
                                      <button
                                        onClick={() =>
                                          updateLog(sess.id, log.student_id, 'present', log.present ? 0 : 1)
                                        }
                                        className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full border transition-colors ${
                                          log.present
                                            ? 'bg-green-100 text-green-700 border-green-300'
                                            : 'bg-gray-100 text-gray-500 border-gray-300'
                                        }`}
                                      >
                                        {log.present ? (
                                          <CheckCircle2 size={14} />
                                        ) : (
                                          <XCircle size={14} />
                                        )}
                                        {log.present ? 'Present' : 'Absent'}
                                      </button>
                                      <div>
                                        <span className="font-semibold text-sm text-gray-900">
                                          {log.student_name}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500 font-mono">
                                          {log.student_code}
                                        </span>
                                      </div>
                                      {savedLog[key] && (
                                        <span className="ml-auto text-xs text-green-600 font-medium">
                                          Saved
                                        </span>
                                      )}
                                    </div>

                                    {log.present ? (
                                      <div className="grid grid-cols-2 gap-3">
                                        <Textarea
                                          label={`Work done (since last session)`}
                                          value={log.work_done ?? ''}
                                          onChange={(e) =>
                                            updateLog(sess.id, log.student_id, 'work_done', e.target.value)
                                          }
                                          placeholder="What did this student accomplish since the last session?"
                                          className="text-sm"
                                          rows={3}
                                        />
                                        <Textarea
                                          label={`Planned work (until next session)`}
                                          value={log.work_planned ?? ''}
                                          onChange={(e) =>
                                            updateLog(sess.id, log.student_id, 'work_planned', e.target.value)
                                          }
                                          placeholder="What will this student work on until the next session?"
                                          className="text-sm"
                                          rows={3}
                                        />
                                        <Textarea
                                          label="Supervisor notes (optional)"
                                          value={log.faculty_notes ?? ''}
                                          onChange={(e) =>
                                            updateLog(sess.id, log.student_id, 'faculty_notes', e.target.value)
                                          }
                                          placeholder="Any private notes for this student..."
                                          className="text-sm col-span-2"
                                          rows={2}
                                        />
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 italic">
                                        Student absent — no log entry required.
                                      </p>
                                    )}

                                    <div className="flex justify-end mt-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => saveLog(log)}
                                        disabled={savingLog[key]}
                                      >
                                        <Save size={12} />
                                        {savingLog[key] ? 'Saving...' : 'Save'}
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Session dialog */}
      <Dialog
        open={sessionDialog}
        onClose={() => setSessionDialog(false)}
        title={editingSession ? 'Edit Session' : 'New Log Session'}
      >
        <div className="flex flex-col gap-4">
          {sessionError && <Alert variant="error">{sessionError}</Alert>}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Log Date *"
              type="date"
              value={sessionForm.log_date}
              onChange={(e) => setSessionForm({ ...sessionForm, log_date: e.target.value })}
            />
            <Input
              label="Start Time"
              type="time"
              value={sessionForm.start_time}
              onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
            />
            <Input
              label="End Time"
              type="time"
              value={sessionForm.end_time}
              onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Input
              label="Topic of Discussion *"
              value={sessionForm.topic}
              onChange={(e) => setSessionForm({ ...sessionForm, topic: e.target.value })}
              placeholder="e.g. Idea finalization with methodology confirmation"
            />
            <p className="text-xs text-gray-400">
              Printed verbatim in the Topics of Discussion column of the attendance sheet.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Next Session Date"
              type="date"
              value={sessionForm.next_log_date}
              onChange={(e) => setSessionForm({ ...sessionForm, next_log_date: e.target.value })}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Session Type</label>
              <select
                value={sessionForm.session_kind}
                onChange={(e) => setSessionForm({ ...sessionForm, session_kind: e.target.value })}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="regular">Regular supervision meeting</option>
                <option value="milestone">Milestone / progress review</option>
                <option value="presentation">Presentation rehearsal</option>
                <option value="remedial">Remedial / catch-up meeting</option>
              </select>
            </div>
          </div>
          <Input
            label="Venue / Location"
            value={sessionForm.venue}
            onChange={(e) => setSessionForm({ ...sessionForm, venue: e.target.value })}
            placeholder="e.g. Room 401, Lab 2"
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setSessionDialog(false)}>Cancel</Button>
            <Button onClick={saveSession}>
              {editingSession ? 'Save Changes' : 'Create Session'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
