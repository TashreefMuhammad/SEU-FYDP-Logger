import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useStore } from './lib/store'
import Dashboard from './pages/Dashboard'
import GroupSetup from './pages/GroupSetup'
import LogSession from './pages/LogSession'
import Reports from './pages/Reports'
import ImportExport from './pages/ImportExport'
import Settings from './pages/Settings'

export default function App() {
  const { setFaculty, setGroups, setSettings } = useStore()

  useEffect(() => {
    // Bootstrap global state on startup
    window.api.getFaculty().then(setFaculty)
    window.api.getGroups().then(setGroups)
    window.api.getSettings().then(setSettings)
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/groups" element={<GroupSetup />} />
          <Route path="/log" element={<LogSession />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/transfer" element={<ImportExport />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
