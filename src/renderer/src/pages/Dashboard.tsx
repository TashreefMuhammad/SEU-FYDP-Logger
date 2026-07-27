import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { runLoad } from '@/lib/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Users, ClipboardList, Plus, AlertCircle, BarChart3, AlertTriangle } from 'lucide-react'
import type { PortfolioAnalytics } from '@/types'

export default function Dashboard() {
  const { faculty, groups, setGroups, setFaculty } = useStore()
  const refreshTick = useStore((s) => s.refreshTick)
  const [portfolio, setPortfolio] = useState<PortfolioAnalytics | null>(null)

  useEffect(() => {
    runLoad('profile', () => window.api.getFaculty()).then((f) => f !== undefined && setFaculty(f))
    runLoad('groups', () => window.api.getGroups()).then((g) => g && setGroups(g))
    runLoad('dashboard figures', () => window.api.getPortfolioAnalysis()).then(
      (p) => p && setPortfolio(p)
    )
  }, [refreshTick])

  const totalGroups = groups.length
  const statFor = (id: number) => portfolio?.groups.find((g) => g.group.id === id)
  const openExceptions = portfolio?.risk_register.length ?? 0

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        {faculty ? (
          <p className="text-sm text-gray-500 mt-1">
            Welcome, {faculty.name} ({faculty.initials}) — {faculty.designation}, {faculty.department}
          </p>
        ) : (
          <Alert variant="warning" className="mt-3">
            Faculty profile not set up.{' '}
            <Link to="/settings" className="font-semibold underline">
              Go to Settings
            </Link>{' '}
            to add your name and details before generating reports.
          </Alert>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{totalGroups}</p>
              <p className="text-xs text-gray-500">Groups</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2.5 bg-indigo-100 rounded-lg">
              <Users size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{portfolio?.totals.students ?? '—'}</p>
              <p className="text-xs text-gray-500">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2.5 bg-green-100 rounded-lg">
              <ClipboardList size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{portfolio?.totals.sessions ?? '—'}</p>
              <p className="text-xs text-gray-500">Sessions logged</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2.5 bg-purple-100 rounded-lg">
              <BarChart3 size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">
                {portfolio ? `${portfolio.totals.avg_attendance_pct}%` : '—'}
              </p>
              <p className="text-xs text-gray-500">Mean attendance</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className={`p-2.5 rounded-lg ${openExceptions ? 'bg-yellow-100' : 'bg-gray-100'}`}>
              <AlertTriangle size={18} className={openExceptions ? 'text-yellow-600' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{portfolio ? openExceptions : '—'}</p>
              <p className="text-xs text-gray-500">Open exceptions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Groups</CardTitle>
            <Link to="/groups">
              <Button size="sm" variant="outline">
                <Plus size={14} />
                Manage Groups
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <AlertCircle size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No groups yet.</p>
              <Link to="/groups">
                <Button className="mt-3" size="sm">
                  <Plus size={14} /> Add First Group
                </Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Group</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Course</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Project Title</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Semester</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">Sessions</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">Attendance</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{g.group_name}</td>
                    <td className="px-6 py-3">
                      {g.course_code
                        ? <Badge variant="info">{g.course_code}</Badge>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-600 max-w-[220px] truncate">
                      {g.project_title || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {g.semester || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {statFor(g.id) ? (
                        <>
                          {statFor(g.id)!.sessions_held}
                          <span className="text-gray-300">/{statFor(g.id)!.group.min_required_sessions}</span>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">
                      {statFor(g.id) ? `${statFor(g.id)!.group_attendance_pct}%` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {statFor(g.id) ? (
                        <Badge
                          variant={
                            statFor(g.id)!.risk === 'high'
                              ? 'danger'
                              : statFor(g.id)!.risk === 'moderate'
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {statFor(g.id)!.risk}
                        </Badge>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex gap-1 justify-end">
                        <Link to={`/log?group=${g.id}`}>
                          <Button size="sm" variant="ghost">
                            Log Session
                          </Button>
                        </Link>
                        <Link to="/analysis">
                          <Button size="sm" variant="ghost">
                            Analyse
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
