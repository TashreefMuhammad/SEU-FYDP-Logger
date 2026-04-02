import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Save, Eye, EyeOff, ExternalLink } from 'lucide-react'

export default function Settings() {
  const { faculty, setFaculty, settings, setSettings } = useStore()
  const [form, setForm] = useState({
    name: '',
    initials: '',
    designation: '',
    department: 'Department of CSE',
    university: 'Southeast University',
    email: ''
  })
  const [apiKey, setApiKey] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-1.5-flash')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keySaved, setKeySaved] = useState(false)

  useEffect(() => {
    if (faculty) {
      setForm({
        name: faculty.name ?? '',
        initials: faculty.initials ?? '',
        designation: faculty.designation ?? '',
        department: faculty.department ?? 'Department of CSE',
        university: faculty.university ?? 'Southeast University',
        email: faculty.email ?? ''
      })
    }
    window.api.getSettings().then((s) => {
      setSettings(s)
      setApiKey(s.gemini_api_key ?? '')
      setGeminiModel(s.gemini_model ?? 'gemini-1.5-flash')
    })
  }, [faculty])

  const handleSaveFaculty = async () => {
    const result = await window.api.saveFaculty(form)
    setFaculty(result)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveApiKey = async () => {
    await window.api.setSetting('gemini_api_key', apiKey.trim())
    await window.api.setSetting('gemini_model', geminiModel.trim())
    setKeySaved(true)
    setTimeout(() => setKeySaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Faculty Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Faculty Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            This information appears on all generated reports and the app sidebar.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Tashreef Muhammad"
            />
            <Input
              label="Initials *"
              value={form.initials}
              onChange={(e) => setForm({ ...form, initials: e.target.value })}
              placeholder="e.g. TM"
            />
          </div>
          <Input
            label="Designation"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="e.g. Lecturer"
          />
          <Input
            label="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <Input
            label="University"
            value={form.university}
            onChange={(e) => setForm({ ...form, university: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="your@seu.edu.bd"
          />

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveFaculty} disabled={!form.name || !form.initials}>
              <Save size={14} /> Save Profile
            </Button>
            {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          </div>
        </CardContent>
      </Card>

      {/* Gemini API Key */}
      <Card>
        <CardHeader>
          <CardTitle>Gemini API Key</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="info">
            The API key is stored locally on this PC only and is never exported in JSON backups.
            Get a free key from{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                // Open external via electron shell
                ;(window as any).electron?.shell?.openExternal('https://aistudio.google.com/app/apikey')
              }}
              className="font-semibold underline"
            >
              Google AI Studio <ExternalLink size={11} className="inline" />
            </a>
          </Alert>

          <div className="relative">
            <Input
              label="Gemini API Key"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <Input
              label="Gemini Model"
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              placeholder="e.g. gemini-1.5-flash"
            />
            <p className="text-xs text-gray-400">
              Check{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); (window as any).electron?.shell?.openExternal('https://aistudio.google.com') }}
                className="underline text-blue-500"
              >
                Google AI Studio
              </a>
              {' '}for models available to your account. Common options:{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">gemini-1.5-flash</code>,{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">gemini-2.0-flash</code>,{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">gemini-2.5-flash-preview-04-17</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
              <Save size={14} /> Save API Key
            </Button>
            {keySaved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
