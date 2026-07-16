import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './components/Header.css'
import './components/Sidebar.css'
import './pages/Login.css'
import './pages/Dashboard.css'
import './pages/Attendance.css'
import './pages/Projects.css'
import './pages/Tasks.css'
import './pages/Meetings.css'
import './pages/Employees.css'
import './pages/Performance.css'
import './pages/PointsConfig.css'
import './pages/Leaves.css'
import './pages/Settings.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
