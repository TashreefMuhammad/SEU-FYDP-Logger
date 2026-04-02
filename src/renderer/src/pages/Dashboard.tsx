import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Users, ClipboardList, FileText, Plus, AlertCircle } from 'lucide-react'

export default function Dashboard() {
  const { faculty, groups, setGroups, setFaculty } = useStore()

  useEffect(() => {
    window.api.getFaculty().then(setFaculty)
    window.api.getGroups().then(setGroups)
  }, [])

  const totalGroups = groups.length

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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalGroups}</p>
              <p className="text-sm text-gray-500">Groups</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="p-3 bg-green-100 rounded-lg">
              <ClipboardList size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-sm text-gray-500">Total Log Sessions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-5">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-sm text-gray-500">Reports Generated</p>
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
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Project Title</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Semester</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Created</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{g.group_name}</td>
                    <td className="px-6 py-3 text-gray-600 max-w-[220px] truncate">
                      {g.project_title || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      {g.semester ? (
                        <Badge variant="info">{g.semester}</Badge>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{formatDate(g.created_at)}</td>
                    <td className="px-6 py-3">
                      <Link to={`/log?group=${g.id}`}>
                        <Button size="sm" variant="ghost">
                          Log Session
                        </Button>
                      </Link>
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
