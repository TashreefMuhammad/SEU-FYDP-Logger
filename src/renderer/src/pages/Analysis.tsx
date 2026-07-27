import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import type { GroupAnalytics, PortfolioAnalytics, Flag, SignatureMode, StudentAnalytics } from '@/types'
import { FYDP_COURSES } from '@/types'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import ReactECharts from 'echarts-for-react'
import {
  BarChart2,
  FileDown,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  CalendarClock,
  ClipboardCheck,
  FileText,
  AlertTriangle,
  BookOpenCheck
} from 'lucide-react'

// ── Small presentational helpers ────────────────────────────────────────────

const riskVariant = (risk: string): 'success' | 'warning' | 'danger' =>
  risk === 'high' ? 'danger' : risk === 'moderate' ? 'warning' : 'success'

const statusVariant = (s: string): 'success' | 'warning' | 'danger' =>
  s === 'met' ? 'success' : s === 'partial' ? 'warning' : 'danger'

function Metric({
  label,
  value,
  sub,
  tone = 'default'
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const colour =
    tone === 'good' ? 'text-green-700' : tone === 'warn' ? 'text-yellow-700' : tone === 'bad' ? 'text-red-700' : 'text-blue-900'
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${colour}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{sub}</p>}
    </div>
  )
}

function FlagList({ flags }: { flags: Flag[] }) {
  if (!flags.length) return <p className="text-xs text-gray-400">No exceptions raised.</p>
  return (
    <ul className="flex flex-col gap-1">
      {flags.map((f, i) => (
        <li key={`${f.code}-${i}`} className="text-xs flex items-start gap-2">
          <Badge variant={f.severity === 'high' ? 'danger' : f.severity === 'moderate' ? 'warning' : 'info'}>
            {f.severity}
          </Badge>
          <span className="text-gray-700">
            {f.label}
            {f.detail && <span className="text-gray-400"> — {f.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Group view ──────────────────────────────────────────────────────────────

function GroupView({ ga }: { ga: GroupAnalytics }) {
  const attendanceOption = {
    grid: { left: 120, right: 40, top: 10, bottom: 24 },
    xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: {
      type: 'category',
      data: ga.students.map((s) => s.name).reverse(),
      axisLabel: { fontSize: 10 }
    },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    series: [
      {
        type: 'bar',
        data: [...ga.students]
          .reverse()
          .map((s) => ({
            value: s.attendance_pct,
            itemStyle: {
              color: s.attendance_pct >= 90 ? '#16a34a' : s.attendance_pct >= 75 ? '#65a30d' : s.attendance_pct >= 60 ? '#ca8a04' : '#dc2626'
            }
          })),
        label: { show: true, position: 'right', formatter: '{c}%', fontSize: 10 },
        barMaxWidth: 16
      }
    ]
  }

  const cadenceOption = {
    grid: { left: 34, right: 16, top: 16, bottom: 52 },
    xAxis: {
      type: 'category',
      data: ga.sessions.map((s) => formatDate(s.log_date)),
      axisLabel: { rotate: 35, fontSize: 9 }
    },
    yAxis: { type: 'value', max: Math.max(1, ga.roster_count), minInterval: 1, name: 'present' },
    tooltip: {
      trigger: 'axis',
      formatter: (p: any[]) => {
        const i = p[0].dataIndex
        const s = ga.sessions[i]
        return `${formatDate(s.log_date)}<br/>${s.topic || 'No topic recorded'}<br/><b>${s.present_count}/${s.roster_count} present</b>`
      }
    },
    series: [
      {
        type: 'bar',
        data: ga.sessions.map((s) => ({
          value: s.present_count,
          itemStyle: {
            color: s.present_count === s.roster_count ? '#16a34a' : s.present_count === 0 ? '#dc2626' : '#ca8a04'
          }
        })),
        barMaxWidth: 26
      }
    ]
  }

  const parity = ga.roster_count ? 100 / ga.roster_count : 0
  const contributionOption = {
    grid: { left: 120, right: 46, top: 10, bottom: 24 },
    xAxis: { type: 'value', axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', data: ga.students.map((s) => s.name).reverse(), axisLabel: { fontSize: 10 } },
    tooltip: { trigger: 'axis' },
    series: [
      {
        type: 'bar',
        data: [...ga.students].reverse().map((s) => ({
          value: s.contribution_share_pct,
          itemStyle: { color: s.contribution_ratio < 0.6 ? '#dc2626' : s.contribution_ratio > 1.6 ? '#ca8a04' : '#2563eb' }
        })),
        label: { show: true, position: 'right', formatter: '{c}%', fontSize: 10 },
        barMaxWidth: 16,
        markLine: {
          symbol: 'none',
          data: [{ xAxis: parity, label: { formatter: 'parity', fontSize: 9 }, lineStyle: { type: 'dashed', color: '#6b7280' } }]
        }
      }
    ]
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Identity */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">{ga.group.group_name}</h2>
                <Badge variant={riskVariant(ga.risk)}>{ga.risk} risk</Badge>
                {ga.group.course_code && <Badge variant="info">{ga.group.course_code}</Badge>}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{ga.group.project_title || 'No project title recorded'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {ga.group.course_title}
                {ga.group.baete_code && ` · BAETE-aligned ${ga.group.baete_code}`}
                {ga.group.semester && ` · ${ga.group.semester}`}
                {ga.group.co_supervisor_name && ` · Co-supervisor: ${ga.group.co_supervisor_name}`}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500 shrink-0">
              {ga.first_session ? (
                <>
                  <p>
                    {formatDate(ga.first_session)} → {formatDate(ga.last_session!)}
                  </p>
                  <p>{ga.span_days} days of supervision</p>
                </>
              ) : (
                <p>No sessions logged</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <Metric
          label="Sessions logged"
          value={`${ga.sessions_held} / ${ga.group.min_required_sessions}`}
          sub="against semester minimum"
          tone={ga.meets_minimum_sessions ? 'good' : 'warn'}
        />
        <Metric
          label="Group attendance"
          value={`${ga.group_attendance_pct}%`}
          sub={`${ga.roster_count} students on roster`}
          tone={ga.group_attendance_pct >= 85 ? 'good' : ga.group_attendance_pct >= 70 ? 'warn' : 'bad'}
        />
        <Metric label="Contact hours" value={ga.contact_hours} sub={`avg gap ${ga.avg_gap_days} d`} />
        <Metric
          label="Documentation"
          value={`${ga.documentation_completeness_pct}%`}
          sub="attended sessions with a work record"
          tone={ga.documentation_completeness_pct >= 80 ? 'good' : 'warn'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Attendance rate by student</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={attendanceOption} style={{ height: Math.max(140, ga.students.length * 34) }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Documented contribution share</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={contributionOption} style={{ height: Math.max(140, ga.students.length * 34) }} />
            <p className="text-[11px] text-gray-400 mt-1">
              Proxy from recorded work volume. Measures documented activity, not academic merit.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students present per session</CardTitle>
        </CardHeader>
        <CardContent>
          {ga.sessions.length ? (
            <ReactECharts option={cadenceOption} style={{ height: 200 }} />
          ) : (
            <p className="text-sm text-gray-400">No sessions logged yet.</p>
          )}
          {ga.sessions.length > 1 && (
            <p className="text-[11px] text-gray-400 mt-1">
              Mean interval {ga.avg_gap_days} days (σ {ga.cadence_stdev_days}); longest gap {ga.max_gap_days} days.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Attendance matrix */}
      {ga.sessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance matrix</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1 font-medium text-gray-500 sticky left-0 bg-white">Student</th>
                  {ga.sessions.map((s, i) => (
                    <th key={s.id} className="px-1.5 py-1 font-medium text-gray-500" title={formatDate(s.log_date)}>
                      {i + 1}
                    </th>
                  ))}
                  <th className="px-2 py-1 font-medium text-gray-500">%</th>
                </tr>
              </thead>
              <tbody>
                {ga.students.map((st) => (
                  <tr key={st.student_id}>
                    <td className="px-2 py-1 whitespace-nowrap sticky left-0 bg-white">
                      {st.name} <span className="text-gray-400 font-mono">{st.student_code.slice(-4)}</span>
                    </td>
                    {st.presence.map((p, i) => (
                      <td
                        key={i}
                        className={`px-1.5 py-1 text-center font-semibold ${
                          p ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {p ? 'P' : 'A'}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-semibold">{st.attendance_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Derived indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Derived assessment indicators</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-4 py-2 font-medium">Student</th>
                <th className="text-right px-3 py-2 font-medium">Attendance /10</th>
                <th className="text-right px-3 py-2 font-medium">
                  CA evidence /{ga.students[0]?.ca_evidence_max ?? 20}
                </th>
                <th className="text-right px-3 py-2 font-medium">Engagement</th>
                <th className="text-left px-3 py-2 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody>
              {ga.students.map((s) => (
                <tr key={s.student_id} className="border-b border-gray-50">
                  <td className="px-4 py-2">
                    {s.name} <span className="font-mono text-xs text-gray-400">{s.student_code}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{s.attendance_indicator}</td>
                  <td className="px-3 py-2 text-right font-semibold">{s.ca_evidence_indicator}</td>
                  <td className="px-3 py-2 text-right">{s.engagement_index}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {s.sessions_present}/{s.sessions_total} attended · {s.logged_work_entries} work records ·{' '}
                    {s.logged_plan_entries} plans
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3">
            <Alert variant="warning">
              These are <strong>indicators, not marks</strong>. They are arithmetic transformations of the logbook for
              the Attendance and Continuous Assessment components (Guideline Sec. 3.1/3.2). Under Sec. 3.3 the Primary
              Supervisor alone enters the supervisor-component marks.
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Per-student detail */}
      <Card>
        <CardHeader>
          <CardTitle>Student-by-student observations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {ga.students.map((s: StudentAnalytics) => (
            <div key={s.student_id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-semibold text-sm text-gray-900">{s.name}</span>
                <span className="font-mono text-xs text-gray-400">{s.student_code}</span>
                <Badge variant={riskVariant(s.risk)}>{s.risk}</Badge>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {s.sessions_present}/{s.sessions_total} sessions ({s.attendance_pct}%) · work recorded{' '}
                {s.logged_work_entries}× ({s.documentation_rate}%) · contribution {s.contribution_share_pct}% (
                {s.contribution_ratio}× parity) · last attended{' '}
                {s.last_present_date ? formatDate(s.last_present_date) : '—'}
              </p>
              <FlagList flags={s.flags} />
            </div>
          ))}
          {!ga.students.length && <p className="text-sm text-gray-400">No students on the roster.</p>}
        </CardContent>
      </Card>

      {/* Group flags */}
      <Card>
        <CardHeader>
          <CardTitle>Group-level exceptions</CardTitle>
        </CardHeader>
        <CardContent>
          <FlagList flags={ga.flags} />
        </CardContent>
      </Card>
    </div>
  )
}

// ── Portfolio view ──────────────────────────────────────────────────────────

function PortfolioView({ p, onOpenGroup }: { p: PortfolioAnalytics; onOpenGroup: (id: number) => void }) {
  const distributionOption = {
    grid: { left: 70, right: 30, top: 10, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', data: [...p.attendance_distribution].reverse().map((b) => b.bucket), axisLabel: { fontSize: 10 } },
    tooltip: { trigger: 'axis' },
    series: [
      {
        type: 'bar',
        data: [...p.attendance_distribution].reverse().map((b) => ({
          value: b.count,
          itemStyle: {
            color:
              b.bucket === 'Below 50%'
                ? '#dc2626'
                : b.bucket === '50–59%'
                  ? '#ea580c'
                  : b.bucket === '60–74%'
                    ? '#ca8a04'
                    : '#16a34a'
          }
        })),
        label: { show: true, position: 'right', fontSize: 10 },
        barMaxWidth: 18
      }
    ]
  }

  const courseOption = {
    grid: { left: 40, right: 20, top: 28, bottom: 24 },
    legend: { top: 0, textStyle: { fontSize: 10 } },
    xAxis: { type: 'category', data: p.by_course.map((c) => c.course_code) },
    yAxis: { type: 'value', minInterval: 1 },
    tooltip: { trigger: 'axis' },
    series: [
      { name: 'Groups', type: 'bar', data: p.by_course.map((c) => c.groups), barMaxWidth: 22, itemStyle: { color: '#2563eb' } },
      { name: 'Students', type: 'bar', data: p.by_course.map((c) => c.students), barMaxWidth: 22, itemStyle: { color: '#7c3aed' } },
      { name: 'Sessions', type: 'bar', data: p.by_course.map((c) => c.sessions), barMaxWidth: 22, itemStyle: { color: '#0891b2' } }
    ]
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-3">
        <Metric label="Groups supervised" value={p.totals.groups} sub="across all FYDP courses" />
        <Metric label="Students" value={p.totals.students} sub="on active rosters" />
        <Metric label="Sessions logged" value={p.totals.sessions} sub={`${p.totals.contact_hours} contact hours`} />
        <Metric
          label="Mean attendance"
          value={`${p.totals.avg_attendance_pct}%`}
          sub="roster-weighted"
          tone={p.totals.avg_attendance_pct >= 85 ? 'good' : p.totals.avg_attendance_pct >= 70 ? 'warn' : 'bad'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Students by attendance band</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={distributionOption} style={{ height: 190 }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Load by course</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={courseOption} style={{ height: 190 }} />
          </CardContent>
        </Card>
      </div>

      {/* Supervision load vs policy caps */}
      <Card>
        <CardHeader>
          <CardTitle>Supervision load against Guideline Sec. 5.1 caps</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!p.rank && (
            <div className="px-6 py-3">
              <Alert variant="info">
                Supervisor rank could not be read from the designation field, so cap checks are skipped. Set a
                designation such as “Assistant Professor” in Settings to enable them.
              </Alert>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-6 py-2 font-medium">Course</th>
                <th className="text-right px-3 py-2 font-medium">Groups</th>
                <th className="text-right px-3 py-2 font-medium">Students</th>
                <th className="text-right px-3 py-2 font-medium">Active</th>
                <th className="text-right px-3 py-2 font-medium">Cap</th>
                <th className="text-right px-3 py-2 font-medium">Utilisation</th>
                <th className="text-right px-3 py-2 font-medium">Mean attendance</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {p.by_course.map((c) => (
                <tr key={c.course_code} className="border-b border-gray-50">
                  <td className="px-6 py-2">
                    <span className="font-medium">{c.course_code}</span>{' '}
                    <span className="text-xs text-gray-400">/ {c.baete_code}</span>
                    <div className="text-xs text-gray-500">{c.course_title}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{c.groups}</td>
                  <td className="px-3 py-2 text-right">{c.students}</td>
                  <td className="px-3 py-2 text-right">{c.active_students}</td>
                  <td className="px-3 py-2 text-right">{c.cap ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {c.cap_utilisation_pct !== null ? `${c.cap_utilisation_pct}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{c.students ? `${c.avg_attendance_pct}%` : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {c.within_cap === null ? null : c.within_cap ? (
                      <Badge variant="success">within cap</Badge>
                    ) : (
                      <Badge variant="danger">over cap</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-600" />
            Compliance with the FYDP Guideline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-6 py-2 font-medium">Reference</th>
                <th className="text-left px-3 py-2 font-medium">Requirement</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {p.compliance.map((c) => (
                <tr key={c.code} className="border-b border-gray-50 align-top">
                  <td className="px-6 py-2 text-xs font-medium text-gray-700 whitespace-nowrap">{c.reference}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{c.requirement}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{c.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Groups table */}
      <Card>
        <CardHeader>
          <CardTitle>All supervised groups</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-6 py-2 font-medium">Group</th>
                <th className="text-left px-3 py-2 font-medium">Course</th>
                <th className="text-right px-3 py-2 font-medium">Students</th>
                <th className="text-right px-3 py-2 font-medium">Sessions</th>
                <th className="text-right px-3 py-2 font-medium">Attendance</th>
                <th className="text-right px-3 py-2 font-medium">Docs</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {p.groups.map((g) => (
                <tr key={g.group.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-2">
                    <span className="font-medium text-gray-900">{g.group.group_name}</span>
                    <div className="text-xs text-gray-500 max-w-[260px] truncate">{g.group.project_title}</div>
                  </td>
                  <td className="px-3 py-2">
                    {g.group.course_code ? <Badge variant="info">{g.group.course_code}</Badge> : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{g.roster_count}</td>
                  <td className="px-3 py-2 text-right">
                    {g.sessions_held}
                    <span className="text-gray-400">/{g.group.min_required_sessions}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{g.group_attendance_pct}%</td>
                  <td className="px-3 py-2 text-right">{g.documentation_completeness_pct}%</td>
                  <td className="px-3 py-2">
                    <Badge variant={riskVariant(g.risk)}>{g.risk}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onOpenGroup(g.group.id)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Risk register */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-yellow-600" />
            Risk register ({p.risk_register.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {p.risk_register.length === 0 && (
            <p className="text-sm text-gray-400">No exceptions raised across any group.</p>
          )}
          {p.risk_register.map((r, i) => (
            <div key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={riskVariant(r.risk)}>{r.risk}</Badge>
                <span className="text-sm font-medium text-gray-900">{r.subject}</span>
                <span className="text-xs text-gray-400">
                  {r.group_name} · {r.course_code} · {r.scope}
                </span>
              </div>
              <FlagList flags={r.flags} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Analysis() {
  const { groups, setGroups } = useStore()
  const [tab, setTab] = useState<'portfolio' | 'group'>('portfolio')
  const [portfolio, setPortfolio] = useState<PortfolioAnalytics | null>(null)
  const [groupAnalysis, setGroupAnalysis] = useState<GroupAnalytics | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Document options
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('attested')
  const [includeSheets, setIncludeSheets] = useState(true)
  const [includeTranscripts, setIncludeTranscripts] = useState(false)
  const [courseFilter, setCourseFilter] = useState<string[]>([])

  const load = async () => {
    setLoading(true)
    const [p, g] = await Promise.all([window.api.getPortfolioAnalysis(), window.api.getGroups()])
    setPortfolio(p)
    setGroups(g)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (selectedGroupId) window.api.getGroupAnalysis(selectedGroupId).then(setGroupAnalysis)
    else setGroupAnalysis(null)
  }, [selectedGroupId])

  const openGroup = (id: number) => {
    setSelectedGroupId(id)
    setTab('group')
  }

  const run = async (key: string, fn: () => Promise<{ success: boolean; path?: string; message?: string }>) => {
    setStatus(null)
    setBusy(key)
    try {
      const result = await fn()
      if (result.success) setStatus({ type: 'success', message: `Saved to ${result.path}` })
      else if (result.message !== 'Cancelled')
        setStatus({ type: 'error', message: result.message ?? 'Generation failed.' })
    } catch (e: any) {
      setStatus({ type: 'error', message: e?.message ?? 'Generation failed.' })
    } finally {
      setBusy(null)
    }
  }

  const toggleCourse = (code: string) =>
    setCourseFilter((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))

  const DocButton = ({
    id,
    icon: Icon,
    label,
    hint,
    onClick,
    disabled
  }: {
    id: string
    icon: any
    label: string
    hint: string
    onClick: () => void
    disabled?: boolean
  }) => (
    <button
      onClick={onClick}
      disabled={!!busy || disabled}
      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-blue-400 disabled:opacity-50 transition-colors"
    >
      <div className="p-2 rounded-md bg-blue-50 text-blue-600 shrink-0">
        {busy === id ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{busy === id ? 'Generating PDF…' : label}</p>
        <p className="text-xs text-gray-500 leading-snug mt-0.5">{hint}</p>
      </div>
    </button>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis Portal</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Everything below is computed arithmetically from your logbook — no AI involved.
            {portfolio && <span className="font-mono text-xs text-gray-400"> · {portfolio.document_id}</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recompute
        </Button>
      </div>

      {status && (
        <Alert variant={status.type === 'success' ? 'success' : 'error'} className="mb-4">
          {status.message}
        </Alert>
      )}

      {/* Documents panel */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown size={16} className="text-blue-600" />
            Generate documents
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <DocButton
              id="dossier"
              icon={BookOpenCheck}
              label="Comprehensive Supervision Dossier"
              hint="Full accreditation-facing document: portfolio summary, Guideline compliance matrix, per-group dossiers, risk register, provenance, declaration and appendices."
              onClick={() =>
                run('dossier', () =>
                  window.api.exportDossierPdf({
                    includeAttendanceSheets: includeSheets,
                    includeTranscripts,
                    signatureMode,
                    courseFilter: courseFilter.length ? courseFilter : undefined
                  })
                )
              }
              disabled={!portfolio?.groups.length}
            />
            <DocButton
              id="allSheets"
              icon={ClipboardCheck}
              label="Attendance Sheets — all groups"
              hint="Departmental attendance form, one page per student, for every group on record."
              onClick={() => run('allSheets', () => window.api.exportAllAttendanceSheets({ signatureMode }))}
              disabled={!portfolio?.groups.length}
            />
            <DocButton
              id="groupSheets"
              icon={Users}
              label="Attendance Sheets — selected group"
              hint={
                selectedGroupId
                  ? `One page per student of ${groupAnalysis?.group.group_name ?? 'the selected group'}.`
                  : 'Select a group in the Group view first.'
              }
              onClick={() => run('groupSheets', () => window.api.exportAttendanceSheets(selectedGroupId!, { signatureMode }))}
              disabled={!selectedGroupId}
            />
            <DocButton
              id="groupAnalysis"
              icon={BarChart2}
              label="Group Supervision Analysis"
              hint={
                selectedGroupId
                  ? 'Cadence, attendance matrix, individual participation, derived indicators and full logbook transcript for the selected group.'
                  : 'Select a group in the Group view first.'
              }
              onClick={() =>
                run('groupAnalysis', () =>
                  window.api.exportGroupAnalysisPdf(selectedGroupId!, { includeTranscript: true })
                )
              }
              disabled={!selectedGroupId}
            />
          </div>

          {/* Options */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Signature column:</span>
                <select
                  value={signatureMode}
                  onChange={(e) => setSignatureMode(e.target.value as SignatureMode)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="attested">System-verified record (no ink)</option>
                  <option value="both">Verified record + blank initial column</option>
                  <option value="physical">Blank initial column + wet signature line</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-gray-600">
                <input type="checkbox" checked={includeSheets} onChange={(e) => setIncludeSheets(e.target.checked)} />
                Attendance sheets as dossier Appendix B
              </label>
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={includeTranscripts}
                  onChange={(e) => setIncludeTranscripts(e.target.checked)}
                />
                Full logbook transcripts as Appendix C
              </label>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Restrict dossier to:</span>
              {FYDP_COURSES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => toggleCourse(c.code)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    courseFilter.includes(c.code)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {c.code}
                </button>
              ))}
              {courseFilter.length > 0 && (
                <button onClick={() => setCourseFilter([])} className="text-xs text-gray-500 underline">
                  clear
                </button>
              )}
              {courseFilter.length === 0 && <span className="text-xs text-gray-400">all courses</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTab('portfolio')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            tab === 'portfolio' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          <FileText size={13} className="inline mr-1.5" />
          Portfolio
        </button>
        <button
          onClick={() => setTab('group')}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            tab === 'group' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          <CalendarClock size={13} className="inline mr-1.5" />
          Group detail
        </button>
      </div>

      {tab === 'group' && (
        <Card className="mb-5">
          <CardContent className="py-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Select group</label>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    selectedGroupId === g.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  {g.group_name}
                  {g.course_code && <span className="text-xs opacity-70 ml-1.5">{g.course_code}</span>}
                </button>
              ))}
              {!groups.length && <p className="text-sm text-gray-400">No groups yet.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="py-16 text-center text-gray-400">
          <Loader2 size={28} className="mx-auto animate-spin mb-2" />
          <p className="text-sm">Computing analysis…</p>
        </div>
      )}

      {!loading && tab === 'portfolio' && portfolio && (
        portfolio.groups.length ? (
          <PortfolioView p={portfolio} onOpenGroup={openGroup} />
        ) : (
          <Alert variant="info">
            No groups on record yet. Create a group and log a session, or import a JSON file from Import / Export.
          </Alert>
        )
      )}

      {!loading && tab === 'group' && (
        groupAnalysis ? <GroupView ga={groupAnalysis} /> : <Alert variant="info">Select a group to see its analysis.</Alert>
      )}
    </div>
  )
}
