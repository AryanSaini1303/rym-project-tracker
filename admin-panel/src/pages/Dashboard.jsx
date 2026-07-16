import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, CalendarX } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '../lib/supabaseClient';
import ProjectDetailsModal from '../components/ProjectDetailsModal';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    completionRate: 0,
    pendingTasks: 0,
    onLeaveToday: 0
  });
  const [dashboardProjectModalId, setDashboardProjectModalId] = useState(null);
  const [activities, setActivities] = useState([]);
  const [leaveChartData, setLeaveChartData] = useState([]);
  const [allTasksList, setAllTasksList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [selectedProjFilter, setSelectedProjFilter] = useState('ALL');
  const [employeesList, setEmployeesList] = useState([]);
  const [selectedEmpFilter, setSelectedEmpFilter] = useState('ALL');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('7DAYS');

  // Leave Chart state
  const [rawLeavesList, setRawLeavesList] = useState([]);
  const [selectedLeaveEmpFilter, setSelectedLeaveEmpFilter] = useState('ALL');
  const [selectedLeaveTimeFilter, setSelectedLeaveTimeFilter] = useState('30DAYS');

  useEffect(() => {
    async function loadDashboardData() {
      // 1. Get total employees count
      const { data: empData, count: employeeCount } = await supabase
        .from('employees')
        .select('id, name', { count: 'exact' });
        
      if (empData) setEmployeesList(empData);

      // Fetch Projects
      const { data: projData } = await supabase
        .from('projects')
        .select('id, title');
        
      if (projData) setProjectsList(projData);

      // 2. Get task stats
      const { data: rawTasks } = await supabase
        .from('tasks')
        .select(`
          id,
          status,
          created_at,
          project_id,
          assignee_id,
          task_assignees (
            status
          )
        `);
        
      let allTasks = [];
      if (rawTasks) {
        allTasks = rawTasks.map(t => {
          const getCalculatedStatus = () => {
            if (!t.task_assignees || t.task_assignees.length === 0) return t.status ? t.status.replace('-', '') : 'todo';
            const allDone = t.task_assignees.every(ta => ta.status === 'done' || ta.status === 'completed');
            const allTodo = t.task_assignees.every(ta => !ta.status || ta.status === 'todo');
            if (allDone) return 'done';
            if (allTodo) return 'todo';
            if (t.task_assignees.some(ta => ta.status === 'review' || ta.status === 'in-review')) return 'review';
            return 'inprogress';
          };
          return { ...t, calculatedStatus: getCalculatedStatus() };
        });
        setAllTasksList(allTasks);
      }

      let completedTasksCount = 0;
      let totalTasksCount = 0;

      if (allTasks && allTasks.length > 0) {
        totalTasksCount = allTasks.length;
        completedTasksCount = allTasks.filter(t => t.calculatedStatus === 'done' || t.calculatedStatus === 'completed').length;
      }

      const pendingTasksCount = allTasks 
        ? allTasks.filter(t => t.calculatedStatus !== 'done' && t.calculatedStatus !== 'completed').length 
        : 0;

      const completionRateVal = totalTasksCount > 0 
        ? Math.round((completedTasksCount / totalTasksCount) * 100) 
        : 0;

      // 3. Get leaves approved for today
      const todayStr = new Date().toISOString().split('T')[0];
      const { count: approvedLeavesCount } = await supabase
        .from('leaves')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Approved')
        .lte('start_date', todayStr)
        .gte('end_date', todayStr);

      setStats({
        totalEmployees: employeeCount || 0,
        completionRate: completionRateVal,
        pendingTasks: pendingTasksCount,
        onLeaveToday: approvedLeavesCount || 0
      });

      // Fetch raw leaves for dynamic chart filtering
      const { data: allLeaves } = await supabase.from('leaves').select('employee_id, status, start_date');
      setRawLeavesList(allLeaves || []);

      // 4. Fetch latest activities
      const feed = [];

      const { data: latestAttendance } = await supabase
        .from('attendance')
        .select('date, clock_in, status, employees:employee_id(name)')
        .order('clock_in', { ascending: false })
        .limit(3);

      if (latestAttendance) {
        latestAttendance.forEach(att => {
          if (att.employees) {
            feed.push({
              type: 'attendance',
              name: att.employees.name,
              detail: `clocked in ${(att.status || 'present').toLowerCase()} on ${att.date}`,
              time: att.clock_in ? new Date(att.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
              timestamp: att.clock_in ? new Date(att.clock_in).getTime() : new Date(att.date).getTime()
            });
          }
        });
      }

      const { data: latestMeetings } = await supabase
        .from('meetings')
        .select('date, time, client_name, outcome, points_earned, employees:employee_id(name), created_at')
        .order('created_at', { ascending: false })
        .limit(3);

      if (latestMeetings) {
        latestMeetings.forEach(meet => {
          if (meet.employees) {
            feed.push({
              type: 'meeting',
              name: meet.employees.name,
              detail: `logged meeting with ${meet.client_name} - Outcome: ${meet.outcome} (+${meet.points_earned} pts)`,
              time: `${meet.date} ${meet.time}`,
              timestamp: meet.created_at ? new Date(meet.created_at).getTime() : new Date(meet.date + 'T' + meet.time).getTime()
            });
          }
        });
      }

      const { data: latestLeaves } = await supabase
        .from('leaves')
        .select('start_date, leave_type, status, employees:employee_id(name)')
        .limit(3);

      if (latestLeaves) {
        latestLeaves.forEach(leave => {
          if (leave.employees) {
            feed.push({
              type: 'leave',
              name: leave.employees.name,
              detail: `submitted a leave request for ${leave.start_date} (${leave.leave_type}) - Status: ${leave.status}`,
              time: 'Requested',
              timestamp: new Date(leave.start_date).getTime()
            });
          }
        });
      }

      feed.sort((a, b) => b.timestamp - a.timestamp);
      
      if (feed.length === 0) {
        setActivities([
          {
            type: 'attendance',
            name: 'System',
            detail: 'setup completed. Awaiting clock-ins from field employees.',
            time: 'Just now',
            timestamp: Date.now()
          },
          {
            type: 'meeting',
            name: 'System',
            detail: 'No client meetings logged yet. Executive logs will stream here.',
            time: '1 hour ago',
            timestamp: Date.now() - 3600000
          }
        ]);
      } else {
        setActivities(feed.slice(0, 5));
      }
    }

    loadDashboardData();

    // Auto-refresh when any key activity happens (clock-ins, meetings, leaves, tasks)
    const dashboardSubscription = supabase
      .channel('public:dashboard_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, () => loadDashboardData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(dashboardSubscription);
    };
  }, []);

  // Dynamic calculation for Task Productivity AreaChart
  const filteredTasksForChart = allTasksList.filter(t => {
    const matchProj = selectedProjFilter === 'ALL' || t.project_id === selectedProjFilter;
    const matchEmp = selectedEmpFilter === 'ALL' || t.assignee_id === selectedEmpFilter;
    return matchProj && matchEmp;
  });

  const chartData = [];
  
  if (selectedTimeFilter === '7DAYS') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chartData.push({
        dateStr: d.toISOString().split('T')[0],
        name: days[d.getDay()],
        tasks: 0,
        completed: 0
      });
    }
  } else if (selectedTimeFilter === '30DAYS') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      chartData.push({
        dateStr: d.toISOString().split('T')[0],
        name: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
        tasks: 0,
        completed: 0
      });
    }
  } else if (selectedTimeFilter === 'THIS_MONTH') {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    for (let i = 1; i <= Math.min(today.getDate(), daysInMonth); i++) {
      const d = new Date(currentYear, currentMonth, i);
      // Adjust timezone properly so toISOString doesn't slip to previous day
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      chartData.push({
        dateStr: localDateStr,
        name: `${i} ${d.toLocaleString('default', { month: 'short' })}`,
        tasks: 0,
        completed: 0
      });
    }
  }

  // To fix timezone issues with d.toISOString() for 30DAYS and 7DAYS, we should properly extract local date
  if (selectedTimeFilter === '7DAYS' || selectedTimeFilter === '30DAYS') {
    chartData.forEach(dObj => {
      // Re-assigning dateStr using local time instead of UTC toISOString
      const d = new Date(dObj.dateStr); // this parses UTC 00:00:00, which might be off, let's fix in loop above instead:
    });
  }

  // Let's refine the loop generation for accurate local dates:
  chartData.length = 0; // reset
  if (selectedTimeFilter === '7DAYS') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      chartData.push({ dateStr: localDateStr, name: days[d.getDay()], todo: 0, inprogress: 0, review: 0, done: 0 });
    }
  } else if (selectedTimeFilter === '30DAYS') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      chartData.push({ dateStr: localDateStr, name: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`, todo: 0, inprogress: 0, review: 0, done: 0 });
    }
  } else if (selectedTimeFilter === 'THIS_MONTH') {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    for (let i = 1; i <= today.getDate(); i++) {
      const d = new Date(currentYear, currentMonth, i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      chartData.push({ dateStr: localDateStr, name: `${i} ${d.toLocaleString('default', { month: 'short' })}`, todo: 0, inprogress: 0, review: 0, done: 0 });
    }
  }

  filteredTasksForChart.forEach(task => {
    if (!task.created_at) return;
    const taskDate = task.created_at.split('T')[0];
    const dayObj = chartData.find(d => d.dateStr === taskDate);
    if (dayObj) {
      if (task.calculatedStatus === 'done' || task.calculatedStatus === 'completed') dayObj.done += 1;
      else if (task.calculatedStatus === 'review' || task.calculatedStatus === 'in-review') dayObj.review += 1;
      else if (task.calculatedStatus === 'inprogress' || task.calculatedStatus === 'in-progress') dayObj.inprogress += 1;
      else dayObj.todo += 1;
    }
  });

  // Dynamic calculation for Leave Statistics Stacked BarChart
  const filteredLeavesForChart = rawLeavesList.filter(l => {
    const matchEmp = selectedLeaveEmpFilter === 'ALL' || l.employee_id === selectedLeaveEmpFilter;
    return matchEmp;
  });

  const leaveDataArray = [];
  
  if (selectedLeaveTimeFilter === '7DAYS') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      leaveDataArray.push({ dateStr: localDateStr, name: days[d.getDay()], Approved: 0, Pending: 0, Rejected: 0 });
    }
  } else if (selectedLeaveTimeFilter === '30DAYS') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      leaveDataArray.push({ dateStr: localDateStr, name: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`, Approved: 0, Pending: 0, Rejected: 0 });
    }
  } else if (selectedLeaveTimeFilter === 'THIS_MONTH') {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    for (let i = 1; i <= today.getDate(); i++) {
      const d = new Date(currentYear, currentMonth, i);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      leaveDataArray.push({ dateStr: localDateStr, name: `${i} ${d.toLocaleString('default', { month: 'short' })}`, Approved: 0, Pending: 0, Rejected: 0 });
    }
  }

  filteredLeavesForChart.forEach(leave => {
    if (!leave.start_date) return;
    const leaveDate = leave.start_date.split('T')[0];
    const dayObj = leaveDataArray.find(d => d.dateStr === leaveDate);
    if (dayObj) {
      if (leave.status === 'Approved') dayObj.Approved += 1;
      else if (leave.status === 'Pending') dayObj.Pending += 1;
      else if (leave.status === 'Rejected') dayObj.Rejected += 1;
    }
  });

  return (
    <div style={{ minHeight: '100%', width: '100%', position: 'relative', overflowAnchor: 'none' }}>
      <h1 className="page-title">Dashboard Overview</h1>
      <p className="page-subtitle">Welcome back, here's what's happening today.</p>

      <div className="dashboard-stats">
        <div className="card stat-card">
          <div className="stat-icon-wrapper">
            <Users size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Total Employees</span>
            <span className="stat-value">{stats.totalEmployees}</span>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)', color: 'var(--secondary)' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Tasks Completed</span>
            <span className="stat-value">{stats.completionRate}%</span>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <Clock size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Pending Tasks</span>
            <span className="stat-value">{stats.pendingTasks}</span>
          </div>
        </div>
        
        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
            <CalendarX size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">On Leave Today</span>
            <span className="stat-value">{stats.onLeaveToday}</span>
          </div>
        </div>
      </div>


      <div className="dashboard-charts">
        <div className="card chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>Task Productivity</h3>
              {selectedProjFilter !== 'ALL' && (
                <button 
                  className="btn-primary" 
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', borderRadius: '20px' }}
                  onClick={() => setDashboardProjectModalId(selectedProjFilter)}
                >
                  Open Project Board
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select 
                value={selectedTimeFilter} 
                onChange={(e) => setSelectedTimeFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="7DAYS">Last 7 Days</option>
                <option value="30DAYS">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
              </select>
              
              <select 
                value={selectedProjFilter} 
                onChange={(e) => setSelectedProjFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Projects</option>
                {projectsList.map(proj => (
                  <option key={proj.id} value={proj.id}>{proj.title}</option>
                ))}
              </select>
              
              <select 
                value={selectedEmpFilter} 
                onChange={(e) => setSelectedEmpFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">All Employees</option>
                {employeesList.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ width: '100%', height: 300, minWidth: 0 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                   <linearGradient id="colorTodo" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--text-secondary)" stopOpacity={0.8}/>
                     <stop offset="95%" stopColor="var(--text-secondary)" stopOpacity={0.1}/>
                   </linearGradient>
                   <linearGradient id="colorInprogress" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3182ce" stopOpacity={0.8}/>
                     <stop offset="95%" stopColor="#3182ce" stopOpacity={0.1}/>
                   </linearGradient>
                   <linearGradient id="colorReview" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.8}/>
                     <stop offset="95%" stopColor="var(--warning)" stopOpacity={0.1}/>
                   </linearGradient>
                   <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--success)" stopOpacity={0.8}/>
                     <stop offset="95%" stopColor="var(--success)" stopOpacity={0.1}/>
                   </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }} />
                <Area type="monotone" dataKey="todo" name="To Do" stroke="var(--text-secondary)" fillOpacity={1} fill="url(#colorTodo)" stackId="1" />
                <Area type="monotone" dataKey="inprogress" name="In Progress" stroke="#3182ce" fillOpacity={1} fill="url(#colorInprogress)" stackId="1" />
                <Area type="monotone" dataKey="review" name="In Review" stroke="var(--warning)" fillOpacity={1} fill="url(#colorReview)" stackId="1" />
                <Area type="monotone" dataKey="done" name="Completed" stroke="var(--success)" fillOpacity={1} fill="url(#colorDone)" stackId="1" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>Leave Statistics</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select 
                value={selectedLeaveTimeFilter} 
                onChange={(e) => setSelectedLeaveTimeFilter(e.target.value)}
                style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="7DAYS">Last 7 Days</option>
                <option value="30DAYS">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
              </select>
              <select 
                value={selectedLeaveEmpFilter} 
                onChange={(e) => setSelectedLeaveEmpFilter(e.target.value)}
                style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="ALL">All Employees</option>
                {employeesList.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div style={{ width: '100%', height: 300, minWidth: 0 }}>
            <ResponsiveContainer>
              <BarChart data={leaveDataArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" allowDecimals={false} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}/>
                <Bar dataKey="Approved" stackId="a" fill="var(--success)" barSize={24} />
                <Bar dataKey="Pending" stackId="a" fill="var(--warning)" />
                <Bar dataKey="Rejected" stackId="a" fill="var(--danger)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity Card */}
      <div className="card activity-feed-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Live Updates Feed</h3>
        <div className="activity-list">
          {activities.map((act, idx) => {
            let IconComp = Users;
            let bgStyle = 'rgba(5, 205, 153, 0.1)';
            let colorStyle = 'var(--secondary)';

            if (act.type === 'meeting') {
              IconComp = CheckCircle;
              bgStyle = 'rgba(67, 24, 255, 0.1)';
              colorStyle = 'var(--primary)';
            } else if (act.type === 'leave') {
              IconComp = CalendarX;
              bgStyle = 'rgba(239, 68, 68, 0.1)';
              colorStyle = 'var(--danger)';
            }

            return (
              <div key={idx} className="activity-item">
                <div className="activity-icon" style={{ backgroundColor: bgStyle, color: colorStyle }}>
                  <IconComp size={18} />
                </div>
                <div className="activity-details">
                  <div className="activity-text">
                    {act.name && <strong>{act.name} </strong>}
                    {act.detail}
                  </div>
                  <div className="activity-time">{act.time}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dashboardProjectModalId && (
        <ProjectDetailsModal 
          projectId={dashboardProjectModalId} 
          onClose={() => setDashboardProjectModalId(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
