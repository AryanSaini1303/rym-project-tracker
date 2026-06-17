import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Tasks from './pages/Tasks';
import Leaves from './pages/Leaves';
import Login from './pages/Login';
import Attendance from './pages/Attendance';
import Meetings from './pages/Meetings';
import Performance from './pages/Performance';
import PointsConfig from './pages/PointsConfig';
import Settings from './pages/Settings';
import VideoCall from './pages/VideoCall';
import Projects from './pages/Projects';
import SharedProject from './pages/SharedProject';
import { supabase } from './lib/supabaseClient';

const ALLOWED_ADMIN_EMAILS = import.meta.env.VITE_ALLOWED_ADMIN_EMAILS
  ? import.meta.env.VITE_ALLOWED_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase())
  : [];

import PullToRefresh from 'react-simple-pull-to-refresh';

import { triggerPushNotification } from './lib/push';

function AppContent() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSidebarDot, setHasSidebarDot] = useState(false);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isSharedProject = location.pathname.startsWith('/share/projects/');

  const handleRefresh = async () => {
    window.location.reload();
  };

  useEffect(() => {
    const verifySession = async (sessionToCheck) => {
      if (!sessionToCheck) {
        setSession(null);
        setIsLoading(false);
        return;
      }
      
      const userEmail = sessionToCheck.user?.email?.toLowerCase();
      if (!ALLOWED_ADMIN_EMAILS.includes(userEmail)) {
        await supabase.auth.signOut();
        setSession(null);
        setIsLoading(false);
        setTimeout(() => toast.error("You don't have access to the admin panel", { id: 'unauthorized-toast' }), 100);
      } else {
        setSession(sessionToCheck);
        setIsLoading(false);
      }
    };

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      verifySession(session);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      verifySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    
    const checkOverdue = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, task_assignees(employee_id, status)')
        .lt('due_date', todayStr);

      if (!overdueTasks) return;

      for (const task of overdueTasks) {
        // Skip if overall task status is done
        if (task.status === 'done' || task.status === 'completed') continue;
        
        const isDone = task.task_assignees && task.task_assignees.length > 0 
          ? task.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed')
          : false;

        if (isDone) continue;

        const linkStr = `/tasks?overdue=${task.id}`;
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('link', linkStr)
          .limit(1);

        if (existing && existing.length > 0) continue; 

        const newNotifications = [];
        
        newNotifications.push({
          user_id: null,
          title: 'Missed Deadline',
          message: `The task "${task.title}" has missed its due date.`,
          type: 'overdue',
          link: linkStr
        });

        if (task.task_assignees) {
          task.task_assignees.forEach(ta => {
            if (ta.status !== 'done' && ta.status !== 'completed') {
              newNotifications.push({
                user_id: ta.employee_id,
                title: 'Missed Deadline',
                message: `Your assigned task "${task.title}" is overdue!`,
                type: 'overdue',
                link: linkStr
              });
            }
          });
        }

        if (newNotifications.length > 0) {
          await supabase.from('notifications').insert(newNotifications);
          await triggerPushNotification(newNotifications);
        }
      }
    };

    checkOverdue();
  }, [session]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: '#ffffff', fontFamily: 'inherit' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(0, 223, 162, 0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Verifying Session...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (isSharedProject) {
    return (
      <Routes>
        <Route path="/share/projects/:id" element={<SharedProject />} />
      </Routes>
    );
  }

  if (isLoginPage) {
    if (session) {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onDotChange={setHasSidebarDot} />
      <div className="main-content">
        <Header onMenuToggle={() => setSidebarOpen(prev => !prev)} hasSidebarDot={hasSidebarDot} />
        <div className="page-content">
          <PullToRefresh onRefresh={handleRefresh}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/points" element={<PointsConfig />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/video-call/:roomId" element={<VideoCall />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </PullToRefresh>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'var(--bg-color)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            fontSize: '0.9rem',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)'
          },
          success: {
            iconTheme: {
              primary: 'var(--primary)',
              secondary: 'var(--bg-color)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger)',
              secondary: 'var(--bg-color)',
            },
          },
        }} 
      />
      <AppContent />
    </Router>
  );
}

export default App;


