import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/Header.css'
import './components/Sidebar.css'
import './components/RegistrationModal.css'
import './pages/Login.css'
import './pages/Dashboard.css'
import './pages/Tasks.css'
import './pages/Meetings.css'
import './pages/Performance.css'
import './pages/Leaves.css'
import './pages/Settings.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
