import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
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
  const [isPreRegistered, setIsPreRegistered] = useState(false);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSidebarDot, setHasSidebarDot] = useState(false);
  
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  const checkProfileExists = async (user) => {
    setIsCheckingProfile(true);
    const { data, error } = await supabase
      .from('employees')
      .select('id, user_id, is_active')
      .eq('email', user.email)
      .maybeSingle();

    if (!error && data) {
      if (data.is_active === false) {
        setIsUnauthorized(true);
        setHasProfile(false);
        setIsPreRegistered(false);
      } else if (data.user_id) {
        setHasProfile(true);
        setIsPreRegistered(false);
        setIsUnauthorized(false);
      } else {
        setHasProfile(false);
        setIsPreRegistered(true);
        setIsUnauthorized(false);
      }
    } else {
      setHasProfile(false);
      setIsPreRegistered(false);
      setIsUnauthorized(true);
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
        setIsPreRegistered(false);
        setIsUnauthorized(false);
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

  if (isUnauthorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: '#ffffff', padding: '1rem' }}>
        <div className="card glass" style={{ maxWidth: '450px', textAlign: 'center', padding: '2.5rem 2rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(239, 68, 68, 0.2)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={48} color="var(--danger)" />
            </div>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ffffff' }}>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '2rem' }}>
            Your email address (<strong>{session?.user?.email}</strong>) is not registered in our employee directory or has been deactivated. Please contact your administrator to grant you access.
          </p>
          <button 
            className="btn-primary" 
            style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.1)' }}
            onClick={() => supabase.auth.signOut()}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If authenticated but profile doesn't exist yet, render the Registration Modal overlay
  if (isPreRegistered) {
    return (
      <RegistrationModal 
        session={session} 
        onComplete={() => checkProfileExists(session.user)} 
      />
    );
  }

  // Fallback: If not authorized and doesn't have profile, show loader or access denied
  if (!hasProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: '#ffffff', padding: '1rem' }}>
        <div className="card glass" style={{ maxWidth: '450px', textAlign: 'center', padding: '2.5rem 2rem', borderRadius: 'var(--radius-lg)' }}>
          <AlertTriangle size={48} color="var(--danger)" style={{ margin: '0 auto 1.5rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Unauthorized Access</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '2rem' }}>
            Please make sure you have been added to the system by an administrator.
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={() => supabase.auth.signOut()}>Sign Out</button>
        </div>
      </div>
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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onDotChange={setHasSidebarDot} />
      <div className="main-content">
        <Header onMenuToggle={() => setSidebarOpen(prev => !prev)} hasSidebarDot={hasSidebarDot} />
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
