import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, CheckSquare, CalendarDays, Settings, Zap, Briefcase, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [hasNewTasks, setHasNewTasks] = useState(false);

  const [latestTasksCount, setLatestTasksCount] = useState(0);

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
      setHasNewTasks((todoTasks || 0) > lastSeenTasks);

      // Due Date Alerts (Due Today or Tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data: dueTasks } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          task_assignees!inner(status, employee_id)
        `)
        .eq('task_assignees.employee_id', empData.id)
        .in('task_assignees.status', ['todo', 'inprogress', 'in-progress'])
        .lte('due_date', tomorrowStr)
        .not('due_date', 'is', null);

      if (dueTasks && dueTasks.length > 0) {
        // Prevent toast spam by storing the alert state in sessionStorage
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
              if (item.name === 'My Tasks') {
                localStorage.setItem('empLastSeenTasks', latestTasksCount.toString());
                setHasNewTasks(false);
              }
            }}
          >
            {item.icon}
            {item.name}
            {item.name === 'My Tasks' && hasNewTasks && location.pathname !== '/tasks' && <div className="nav-dot"></div>}
          </NavLink>
        ))}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Settings className="nav-icon" />
          Settings
        </NavLink>
      </div>
    </div>
  );
};

export default Sidebar;
