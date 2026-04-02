import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Download, Upload, FileJson, Shield, RefreshCw } from 'lucide-react'

export default function ImportExport() {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [loading, setLoading] = useState<'export' | 'import' | null>(null)

  const handleExport = async () => {
    setStatus(null)
    setLoading('export')
    try {
      const result = await window.api.exportToJson()
      if (result.success) {
        setStatus({ type: 'success', message: `Exported to: ${result.path}` })
      } else if (result.message !== 'Cancelled') {
        setStatus({ type: 'error', message: result.message ?? 'Export failed.' })
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message })
    } finally {
      setLoading(null)
    }
  }

  const handleImport = async () => {
    setStatus(null)
    setLoading('import')
    try {
      const result = await window.api.importFromJson()
      if (result.success) {
        setStatus({
          type: 'success',
          message: 'Data imported successfully. Refresh the app to see changes (Ctrl+R).'
        })
      } else if (result.message !== 'Cancelled') {
        setStatus({ type: 'error', message: result.message ?? 'Import failed.' })
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: e.message })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Import / Export</h1>

      {status && (
        <Alert variant={status.type === 'success' ? 'success' : 'error'} className="mb-5">
          {status.message}
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download size={16} className="text-blue-600" />
              Export to JSON
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              Export all groups, students, log sessions, and generated reports to a single{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">.json</code> file. Use this to:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Work from home — import on another PC</li>
              <li>Share with a co-supervisor</li>
              <li>Keep a manual backup</li>
            </ul>
            <Alert variant="info">
              <Shield size={13} className="inline mr-1" />
              Your Gemini API key is <strong>never</strong> included in the export.
            </Alert>
            <Button onClick={handleExport} disabled={!!loading}>
              {loading === 'export' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <FileJson size={14} />
              )}
              {loading === 'export' ? 'Exporting...' : 'Export Data as JSON'}
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload size={16} className="text-green-600" />
              Import from JSON
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              Load a previously exported JSON file. Existing records are updated (not duplicated); new records are added.
            </p>
            <Alert variant="warning">
              Importing merges data — it does <strong>not</strong> wipe your existing local data. If the same group or session exists, it will be updated with the imported values.
            </Alert>
            <Button variant="secondary" onClick={handleImport} disabled={!!loading}>
              {loading === 'import' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              {loading === 'import' ? 'Importing...' : 'Import from JSON File'}
            </Button>
          </CardContent>
        </Card>

        {/* JSON format reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson size={16} className="text-gray-400" />
              JSON Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-3">The exported file follows this structure:</p>
            <pre className="bg-gray-50 rounded-md p-4 text-xs text-gray-700 overflow-x-auto">
{`{
  "_meta": { "exportedAt": "...", "version": "1.0" },
  "faculty": { "name": "...", "initials": "...", ... },
  "groups": [
    {
      "id": 1,
      "group_name": "Group A",
      "project_title": "...",
      "students": [ { "student_id": "...", "name": "..." } ],
      "sessions": [
        {
          "log_date": "2025-03-01",
          "studentLogs": [
            {
              "student_code": "2021-1-60-001",
              "student_name": "Rashed Karim",
              "present": 1,
              "work_done": "...",
              "work_planned": "..."
            }
          ]
        }
      ]
    }
  ]
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
