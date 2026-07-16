import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, CalendarDays, Settings, Zap, Briefcase, Trophy, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

const Sidebar = ({ isOpen, onClose, onDotChange }) => {
  const location = useLocation();
  const [hasNewTasks, setHasNewTasks] = useState(false);
  const [latestTasksCount, setLatestTasksCount] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (onDotChange) {
      onDotChange(hasNewTasks);
    }
  }, [hasNewTasks, onDotChange]);

  useEffect(() => {
    const checkNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: empData } = await supabase.from('employees').select('id').eq('email', user.email).single();
      if (!empData) return;

      const { count: todoTasks } = await supabase
        .from('task_assignees')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', empData.id)
        .in('status', ['todo', 'in-progress', 'inprogress']);
      
      setLatestTasksCount(todoTasks || 0);
      const lastSeenTasks = parseInt(localStorage.getItem('empLastSeenTasks') || '0', 10);
      
      if ((todoTasks || 0) > lastSeenTasks) {
        setHasNewTasks(true);
      } else if ((todoTasks || 0) < lastSeenTasks) {
        localStorage.setItem('empLastSeenTasks', (todoTasks || 0).toString());
      }

      // Due Date Alerts
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: dueTasks } = await supabase
        .from('tasks')
        .select(`id, title, due_date, task_assignees!inner(status, employee_id)`)
        .eq('task_assignees.employee_id', empData.id)
        .in('task_assignees.status', ['todo', 'inprogress', 'in-progress'])
        .lte('due_date', tomorrowStr)
        .not('due_date', 'is', null);

      if (dueTasks && dueTasks.length > 0) {
        const toastKey = `emp_toast_due_${tomorrowStr}`;
        if (!sessionStorage.getItem(toastKey)) {
          if (dueTasks.length === 1) {
            toast(`Reminder: Task "${dueTasks[0].title}" is due soon!`, { icon: '⏰', duration: 6000, style: { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--warning)' } });
          } else {
            toast(`Reminder: You have ${dueTasks.length} tasks due soon!`, { icon: '⏰', duration: 6000, style: { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--warning)' } });
          }
          sessionStorage.setItem(toastKey, 'true');
        }
      }
    };

    checkNotifications();
    const sub = supabase
      .channel('public:emp_sidebar_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_assignees' }, () => {
         setHasNewTasks(true);
         checkNotifications();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_assignees' }, (payload) => {
         if (payload.new && (payload.new.status === 'todo' || payload.new.status === 'inprogress' || payload.new.status === 'in-progress')) setHasNewTasks(true);
         checkNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/tasks') {
      localStorage.setItem('empLastSeenTasks', latestTasksCount.toString());
      setHasNewTasks(false);
    }
  }, [location.pathname, latestTasksCount]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="nav-icon" /> },
    { name: 'My Tasks', path: '/tasks', icon: <CheckSquare className="nav-icon" /> },
    { name: 'My Meetings', path: '/meetings', icon: <Briefcase className="nav-icon" /> },
    { name: 'Leave Requests', path: '/leaves', icon: <CalendarDays className="nav-icon" /> },
    { name: 'Leaderboard', path: '/performance', icon: <Trophy className="nav-icon" /> },
  ];

  const handleNavClick = (itemName) => {
    if (itemName === 'My Tasks') {
      localStorage.setItem('empLastSeenTasks', latestTasksCount.toString());
      setHasNewTasks(false);
    }
    onClose?.(); // close sidebar on mobile after nav
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Check if iOS
      const isIos = /ipad|iphone|ipod/i.test(navigator.userAgent.toLowerCase());
      if (isIos) {
        toast('To install on iPhone/iPad: Tap the Share icon ⍗ at the bottom and select "Add to Home Screen".', { icon: '🍎', duration: 8000, style: { background: 'var(--card-bg)', color: 'var(--text-primary)' } });
      } else {
        toast('App can only be installed in Production or when PWA criteria are met.', { icon: 'ℹ️', style: { background: 'var(--card-bg)', color: 'var(--text-primary)' } });
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />

      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img 
            src="/logo.png" 
            alt="RYM Grenergy" 
            style={{ maxHeight: '45px', objectFit: 'contain' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={26} color="var(--primary)" />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--primary)', letterSpacing: '0.02em' }}>RYM</span>
              <span style={{ fontWeight: 600, fontSize: '0.6rem', color: '#ffffff', letterSpacing: '0.14em' }}>GRENERGY</span>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink 
              key={item.name} 
              to={item.path} 
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.name)}
            >
              {item.icon}
              {item.name}
              {item.name === 'My Tasks' && hasNewTasks && location.pathname !== '/tasks' && <div className="nav-dot"></div>}
            </NavLink>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
          {(!window.matchMedia('(display-mode: standalone)').matches) && (
            <button className="nav-link" onClick={handleInstallClick} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
              <Download className="nav-icon" />
              Install App
            </button>
          )}
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Settings className="nav-icon" />
            Settings
          </NavLink>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
