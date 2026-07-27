import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { describeError, toast } from './lib/toast'

// Surface anything that escapes a component or an un-awaited promise, so a
// silent failure can be diagnosed from the UI rather than only the dev console.
window.addEventListener('error', (e) => {
  const info = describeError(e.error ?? e.message)
  toast.error(`Unexpected error: ${info.message}`, info.detail)
})
window.addEventListener('unhandledrejection', (e) => {
  const info = describeError((e as PromiseRejectionEvent).reason)
  toast.error(`Unhandled failure: ${info.message}`, info.detail)
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
