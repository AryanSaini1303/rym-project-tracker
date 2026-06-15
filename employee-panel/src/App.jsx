import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Leaves from './pages/Leaves';
import Login from './pages/Login';
import Meetings from './pages/Meetings';
import Performance from './pages/Performance';
import Settings from './pages/Settings';
import VideoCall from './pages/VideoCall';
import RegistrationModal from './components/RegistrationModal';
import { supabase } from './lib/supabaseClient';

function AppContent() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const checkProfileExists = async (user) => {
    setIsCheckingProfile(true);
    const { data, error } = await supabase
      .from('employees')
      .select('id, user_id')
      .eq('email', user.email)
      .maybeSingle();

    if (!error && data) {
      // If the admin pre-created the employee, the user_id will be missing.
      // We must link the Google Auth ID to the employee record so the Admin panel can view their deep profile!
      if (!data.user_id) {
        await supabase.from('employees').update({ user_id: user.id }).eq('id', data.id);
      }
      setHasProfile(true);
    } else {
      setHasProfile(false);
    }
    setIsCheckingProfile(false);
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkProfileExists(session.user);
      }
      setIsLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        checkProfileExists(session.user);
      } else {
        setHasProfile(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading || isCheckingProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: '#ffffff' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(0, 223, 162, 0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Verifying Credentials...</p>
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

  // If authenticated but profile doesn't exist yet, render the Registration Modal overlay
  if (!hasProfile) {
    return (
      <RegistrationModal 
        session={session} 
        onComplete={() => checkProfileExists(session.user)} 
      />
    );
  }

  return (
    <div className="app-container">
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
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/leaves" element={<Leaves />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/video-call/:roomId" element={<VideoCall />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
