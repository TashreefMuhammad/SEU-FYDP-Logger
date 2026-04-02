import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Group, Student } from '@/types'
import { FYDP_COURSES } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { Alert } from '@/components/ui/alert'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Users,
  FolderOpen
} from 'lucide-react'

type GroupForm = Omit<Group, 'id' | 'created_at'>
type StudentForm = Omit<Student, 'id'>

const SEU_STUDENT_ID_REGEX = /^\d{13}$/

const emptyGroup: GroupForm = {
  group_name: '',
  project_title: '',
  course_code: '',
  semester: '',
  academic_year: ''
}

export default function GroupSetup() {
  const { groups, setGroups, selectedGroupId, setSelectedGroupId, students, setStudents } = useStore()
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null)
  const [studentsByGroup, setStudentsByGroup] = useState<Record<number, Student[]>>({})

  // Group dialog
  const [groupDialog, setGroupDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroup)
  const [groupError, setGroupError] = useState('')

  // Student dialog
  const [studentDialog, setStudentDialog] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [studentForm, setStudentForm] = useState<StudentForm>({ student_id: '', name: '', group_id: 0 })
  const [studentError, setStudentError] = useState('')

  useEffect(() => {
    window.api.getGroups().then(setGroups)
  }, [])

  const loadStudents = async (groupId: number) => {
    const s = await window.api.getStudentsByGroup(groupId)
    setStudentsByGroup((prev) => ({ ...prev, [groupId]: s }))
  }

  const toggleGroup = (id: number) => {
    const next = expandedGroupId === id ? null : id
    setExpandedGroupId(next)
    if (next !== null) loadStudents(next)
  }

  // ── Group CRUD ────────────────────────────────────────────────────────────
  const openNewGroup = () => {
    setEditingGroup(null)
    setGroupForm(emptyGroup)
    setGroupError('')
    setGroupDialog(true)
  }

  const openEditGroup = (g: Group) => {
    setEditingGroup(g)
    setGroupForm({ group_name: g.group_name, project_title: g.project_title, course_code: g.course_code ?? '', semester: g.semester, academic_year: g.academic_year })
    setGroupError('')
    setGroupDialog(true)
  }

  const saveGroup = async () => {
    if (!groupForm.group_name.trim()) {
      setGroupError('Group name is required.')
      return
    }
    if (editingGroup) {
      await window.api.updateGroup(editingGroup.id, groupForm)
    } else {
      await window.api.createGroup(groupForm)
    }
    const updated = await window.api.getGroups()
    setGroups(updated)
    setGroupDialog(false)
  }

  const deleteGroup = async (g: Group) => {
    if (!confirm(`Delete group "${g.group_name}"? This will also remove all students and sessions.`)) return
    await window.api.deleteGroup(g.id)
    const updated = await window.api.getGroups()
    setGroups(updated)
    if (expandedGroupId === g.id) setExpandedGroupId(null)
  }

  // ── Student CRUD ──────────────────────────────────────────────────────────
  const openNewStudent = (groupId: number) => {
    setEditingStudent(null)
    setStudentForm({ student_id: '', name: '', group_id: groupId })
    setStudentError('')
    setStudentDialog(true)
  }

  const openEditStudent = (s: Student) => {
    setEditingStudent(s)
    setStudentForm({ student_id: s.student_id, name: s.name, group_id: s.group_id })
    setStudentError('')
    setStudentDialog(true)
  }

  const saveStudent = async () => {
    if (!studentForm.student_id.trim() || !studentForm.name.trim()) {
      setStudentError('Student ID and Name are required.')
      return
    }
    if (!SEU_STUDENT_ID_REGEX.test(studentForm.student_id.trim())) {
      setStudentError('Student ID must be exactly 13 digits (e.g. 2021160001234).')
      return
    }
    if (editingStudent) {
      await window.api.updateStudent(editingStudent.id, studentForm)
    } else {
      await window.api.addStudent(studentForm)
    }
    await loadStudents(studentForm.group_id)
    setStudentDialog(false)
  }

  const deleteStudent = async (s: Student) => {
    if (!confirm(`Remove "${s.name}" from group?`)) return
    await window.api.deleteStudent(s.id)
    await loadStudents(s.group_id)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Groups & Students</h1>
        <Button onClick={openNewGroup}>
          <Plus size={14} /> New Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-500 text-sm mb-3">No groups yet. Create your first group to get started.</p>
            <Button onClick={openNewGroup}>
              <Plus size={14} /> Add Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const isOpen = expandedGroupId === g.id
            const gStudents = studentsByGroup[g.id] ?? []
            return (
              <Card key={g.id}>
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 rounded-lg"
                  onClick={() => toggleGroup(g.id)}
                >
                  {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{g.group_name}</p>
                    {g.project_title && (
                      <p className="text-xs text-gray-500 truncate">{g.project_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {g.course_code && <Badge variant="info">{g.course_code}</Badge>}
                    {g.semester && <Badge>{g.semester}</Badge>}
                    {g.academic_year && <Badge>{g.academic_year}</Badge>}
                  </div>
                  <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => openEditGroup(g)}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteGroup(g)}>
                      <Trash2 size={13} className="text-red-500" />
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Users size={14} />
                        Students ({gStudents.length})
                      </p>
                      <Button size="sm" variant="outline" onClick={() => openNewStudent(g.id)}>
                        <UserPlus size={13} /> Add Student
                      </Button>
                    </div>

                    {gStudents.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">
                        No students yet. Add students to this group.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                            <th className="pb-2 font-medium">Student ID</th>
                            <th className="pb-2 font-medium">Name</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {gStudents.map((s) => (
                            <tr key={s.id} className="border-b border-gray-50">
                              <td className="py-2 font-mono text-gray-700">{s.student_id}</td>
                              <td className="py-2 text-gray-800">{s.name}</td>
                              <td className="py-2 flex gap-1 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => openEditStudent(s)}>
                                  <Pencil size={12} />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteStudent(s)}>
                                  <Trash2 size={12} className="text-red-500" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Group dialog */}
      <Dialog
        open={groupDialog}
        onClose={() => setGroupDialog(false)}
        title={editingGroup ? 'Edit Group' : 'New Group'}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Group Name *"
            value={groupForm.group_name}
            onChange={(e) => setGroupForm({ ...groupForm, group_name: e.target.value })}
            placeholder="e.g. Group 4A"
            error={groupError}
          />
          <Input
            label="Project Title"
            value={groupForm.project_title}
            onChange={(e) => setGroupForm({ ...groupForm, project_title: e.target.value })}
            placeholder="e.g. Smart Home Automation System"
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Course *</label>
            <select
              value={groupForm.course_code}
              onChange={(e) => setGroupForm({ ...groupForm, course_code: e.target.value as any })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select course —</option>
              {FYDP_COURSES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Semester"
              value={groupForm.semester}
              onChange={(e) => setGroupForm({ ...groupForm, semester: e.target.value })}
              placeholder="e.g. Spring 2025"
            />
            <Input
              label="Academic Year"
              value={groupForm.academic_year}
              onChange={(e) => setGroupForm({ ...groupForm, academic_year: e.target.value })}
              placeholder="e.g. 2024-25"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setGroupDialog(false)}>Cancel</Button>
            <Button onClick={saveGroup}>
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Student dialog */}
      <Dialog
        open={studentDialog}
        onClose={() => setStudentDialog(false)}
        title={editingStudent ? 'Edit Student' : 'Add Student'}
      >
        <div className="flex flex-col gap-4">
          {studentError && <Alert variant="error">{studentError}</Alert>}
          <div className="flex flex-col gap-1">
            <Input
              label="Student ID * (13 digits)"
              value={studentForm.student_id}
              onChange={(e) => setStudentForm({ ...studentForm, student_id: e.target.value.replace(/\D/g, '').slice(0, 13) })}
              placeholder="e.g. 2021160001234"
              maxLength={13}
            />
            <p className="text-xs text-gray-400">Digits only · exactly 13 characters</p>
          </div>
          <Input
            label="Full Name *"
            value={studentForm.name}
            onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
            placeholder="e.g. Rashed Karim"
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setStudentDialog(false)}>Cancel</Button>
            <Button onClick={saveStudent}>
              {editingStudent ? 'Save Changes' : 'Add Student'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
