import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, CalendarDays, Settings, Zap, MapPin, Briefcase, Trophy, Coins, FolderKanban, X, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, onDotChange }) => {
  const location = useLocation();
  const [hasNewLeaves, setHasNewLeaves] = useState(false);
  const [hasNewTasks, setHasNewTasks] = useState(false);

  const [latestLeavesCount, setLatestLeavesCount] = useState(0);
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
      onDotChange(hasNewLeaves || hasNewTasks);
    }
  }, [hasNewLeaves, hasNewTasks, onDotChange]);

  useEffect(() => {
    const checkNotifications = async () => {
      const { count: pendingLeaves } = await supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');
      
      const { count: reviewTasks } = await supabase
        .from('task_assignees')
        .select('*', { count: 'exact', head: true })
        .in('status', ['review', 'in-review']);
        
      setLatestLeavesCount(pendingLeaves || 0);
      setLatestTasksCount(reviewTasks || 0);

      const lastSeenLeaves = parseInt(localStorage.getItem('adminLastSeenLeaves') || '0', 10);
      const lastSeenTasks = parseInt(localStorage.getItem('adminLastSeenTasks') || '0', 10);

      // We check if current count > last seen to show dot on load
      if ((pendingLeaves || 0) > lastSeenLeaves) {
        setHasNewLeaves(true);
      } else if ((pendingLeaves || 0) < lastSeenLeaves) {
        localStorage.setItem('adminLastSeenLeaves', (pendingLeaves || 0).toString());
      }
      
      if ((reviewTasks || 0) > lastSeenTasks) {
        setHasNewTasks(true);
      } else if ((reviewTasks || 0) < lastSeenTasks) {
        localStorage.setItem('adminLastSeenTasks', (reviewTasks || 0).toString());
      }

      // Admin Due Date Alerts
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: dueTasksAdmin } = await supabase
        .from('tasks')
        .select(`id, title, due_date, task_assignees(status)`)
        .lte('due_date', tomorrowStr)
        .not('due_date', 'is', null);

      if (dueTasksAdmin) {
        const pendingDueTasks = dueTasksAdmin.filter(task => {
          const isDone = task.task_assignees && task.task_assignees.length > 0 
              && task.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
          return !isDone;
        });

        if (pendingDueTasks.length > 0) {
          const toastKey = `admin_toast_due_summary_${tomorrowStr}`;
          if (!sessionStorage.getItem(toastKey)) {
            toast(`System Alert: ${pendingDueTasks.length} tasks in the company are due soon and remain pending!`, {
              icon: '⚠️',
              duration: 8000,
              style: { background: 'var(--card-bg)', border: '1px solid var(--warning)', color: 'var(--text-primary)' }
            });
            sessionStorage.setItem(toastKey, 'true');
          }
        }
      }
    };

    checkNotifications();

    const sub = supabase
      .channel('public:admin_sidebar_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leaves' }, () => {
         setHasNewLeaves(true);
         checkNotifications();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leaves' }, (payload) => {
         if (payload.new && payload.new.status === 'Pending') setHasNewLeaves(true);
         checkNotifications();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_assignees' }, () => {
         setHasNewTasks(true);
         checkNotifications();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_assignees' }, (payload) => {
         if (payload.new && (payload.new.status === 'review' || payload.new.status === 'in-review')) setHasNewTasks(true);
         checkNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

  // Clear notification when the route is active
  useEffect(() => {
    if (location.pathname === '/leaves') {
      localStorage.setItem('adminLastSeenLeaves', latestLeavesCount.toString());
      setHasNewLeaves(false);
    }
    if (location.pathname === '/tasks') {
      localStorage.setItem('adminLastSeenTasks', latestTasksCount.toString());
      setHasNewTasks(false);
    }
  }, [location.pathname, latestLeavesCount, latestTasksCount]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="nav-icon" /> },
    { name: 'Employees', path: '/employees', icon: <Users className="nav-icon" /> },
    { name: 'Attendance', path: '/attendance', icon: <MapPin className="nav-icon" /> },
    { name: 'Projects', path: '/projects', icon: <FolderKanban className="nav-icon" /> },
    { name: 'Tasks', path: '/tasks', icon: <CheckSquare className="nav-icon" /> },
    { name: 'Meetings', path: '/meetings', icon: <Briefcase className="nav-icon" /> },
    { name: 'Leave Requests', path: '/leaves', icon: <CalendarDays className="nav-icon" /> },
    { name: 'Performance', path: '/performance', icon: <Trophy className="nav-icon" /> },
    { name: 'Points Config', path: '/points', icon: <Coins className="nav-icon" /> },
  ];

  const handleNavClick = (itemName) => {
    if (itemName === 'Leave Requests') {
      localStorage.setItem('adminLastSeenLeaves', latestLeavesCount.toString());
      setHasNewLeaves(false);
    }
    if (itemName === 'Tasks') {
      localStorage.setItem('adminLastSeenTasks', latestTasksCount.toString());
      setHasNewTasks(false);
    }
    onClose?.(); // close sidebar on mobile after nav
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast('App can only be installed in Production or when PWA criteria are met.', { icon: 'ℹ️', style: { background: 'var(--card-bg)', color: 'var(--text-primary)' } });
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
              {item.name === 'Leave Requests' && hasNewLeaves && location.pathname !== '/leaves' && <div className="nav-dot"></div>}
              {item.name === 'Tasks' && hasNewTasks && location.pathname !== '/tasks' && <div className="nav-dot"></div>}
            </NavLink>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <button className="nav-link" onClick={handleInstallClick} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
            <Download className="nav-icon" />
            Install App
          </button>
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
