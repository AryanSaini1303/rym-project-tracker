import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, CalendarDays, Settings, Zap, MapPin, Briefcase, Trophy, Coins, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [hasNewLeaves, setHasNewLeaves] = useState(false);
  const [hasNewTasks, setHasNewTasks] = useState(false);

  const [latestLeavesCount, setLatestLeavesCount] = useState(0);
  const [latestTasksCount, setLatestTasksCount] = useState(0);

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

      setHasNewLeaves((pendingLeaves || 0) > lastSeenLeaves);
      setHasNewTasks((reviewTasks || 0) > lastSeenTasks);

      // Admin Due Date Alerts (Company-wide tasks due today or tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: dueTasksAdmin } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          task_assignees(status)
        `)
        .lte('due_date', tomorrowStr)
        .not('due_date', 'is', null);

      if (dueTasksAdmin) {
        const pendingDueTasks = dueTasksAdmin.filter(task => {
          const isDone = task.task_assignees && task.task_assignees.length > 0 
              && task.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
          // If there are no assignees, we check the main status, but here we assume if it's not done by assignees, it's pending
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => {
         checkNotifications();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => {
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

  return (
    <div className="sidebar">
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
          <Zap size={28} color="var(--primary)" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontWeight: 900, fontSize: '1.2rem', color: 'var(--primary)', letterSpacing: '0.02em' }}>RYM</span>
            <span style={{ fontWeight: 600, fontSize: '0.65rem', color: '#ffffff', letterSpacing: '0.14em' }}>GRENERGY</span>
          </div>
        </div>
      </div>

      <div className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink 
            key={item.name} 
            to={item.path} 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (item.name === 'Leave Requests') {
                localStorage.setItem('adminLastSeenLeaves', latestLeavesCount.toString());
                setHasNewLeaves(false);
              }
              if (item.name === 'Tasks') {
                localStorage.setItem('adminLastSeenTasks', latestTasksCount.toString());
                setHasNewTasks(false);
              }
            }}
          >
            {item.icon}
            {item.name}
            {item.name === 'Leave Requests' && hasNewLeaves && location.pathname !== '/leaves' && <div className="nav-dot"></div>}
            {item.name === 'Tasks' && hasNewTasks && location.pathname !== '/tasks' && <div className="nav-dot"></div>}
          </NavLink>
        ))}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <NavLink to="/settings" className="nav-link">
          <Settings className="nav-icon" />
          Settings
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;

