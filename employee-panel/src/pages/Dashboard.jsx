import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Award, CheckSquare, MapPin, Clock, Loader2, Trophy, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    points: 0,
    rank: '--',
    pendingTasks: 0,
    completedTasks: 0,
    target: 400
  });

  // Attendance states
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  const loadDashboardData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    // 1. Get employee details
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('email', user.email)
      .single();

    if (empError || !empData) {
      setIsLoading(false);
      return;
    }

    setEmployee(empData);
    const empId = empData.id;

    // 2. Get today's attendance log
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: attData } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', empId)
      .eq('date', todayStr)
      .maybeSingle();

    setTodayAttendance(attData);

    // 3. Count pending tasks (from task_assignees schema)
    const { count: pendingTaskCount } = await supabase
      .from('task_assignees')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', empId)
      .neq('status', 'done')
      .neq('status', 'completed');

    // 4. Count completed tasks (from task_assignees schema)
    const { count: completedTaskCount } = await supabase
      .from('task_assignees')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', empId)
      .in('status', ['done', 'completed']);

    // 5. Calculate Leaderboard rank and points
    // Fetch all employees and calculate scores
    const { data: allEmps } = await supabase.from('employees').select('id, name');
    
    const { data: taskData } = await supabase
      .from('tasks')
      .select('assignee_id, points_awarded')
      .eq('status', 'done')
      .not('assignee_id', 'is', null);

    const { data: taskAssigneeData } = await supabase
      .from('task_assignees')
      .select(`
        employee_id,
        status,
        tasks (
          points_awarded
        )
      `)
      .in('status', ['done', 'completed']);

    const { data: meetingData } = await supabase
      .from('meetings')
      .select('employee_id, points_earned')
      .eq('outcome', 'Success');

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('employee_id, status')
      .eq('status', 'Present');

    let currentEmpPoints = 0;
    const scores = (allEmps || []).map(emp => {
      const oldTaskPts = taskData
        ? taskData.filter(t => t.assignee_id === emp.id).reduce((sum, t) => sum + (t.points_awarded || 15), 0)
        : 0;

      const newTaskPts = taskAssigneeData
        ? taskAssigneeData.filter(ta => ta.employee_id === emp.id).reduce((sum, ta) => sum + (ta.tasks?.points_awarded || 15), 0)
        : 0;

      const meetPts = meetingData
        ? meetingData.filter(m => m.employee_id === emp.id).reduce((sum, m) => sum + (m.points_earned || 0), 0)
        : 0;
        
      const attPts = attendanceData
        ? attendanceData.filter(a => a.employee_id === emp.id).length * 5
        : 0;

      const total = oldTaskPts + newTaskPts + meetPts + attPts;
      if (emp.id === empId) {
        currentEmpPoints = total;
      }
      return { id: emp.id, points: total };
    });

    // Sort descending by points
    scores.sort((a, b) => b.points - a.points);
    const rankIndex = scores.findIndex(s => s.id === empId);
    const userRank = rankIndex !== -1 ? `#${rankIndex + 1}` : '--';

    // Get target from points_config or fallback to 400
    let targetPts = 400;
    const { data: configData } = await supabase.from('points_config').select('rule_key, points_value');
    if (configData) {
      const globalObj = configData.find(c => c.rule_key === 'monthlyTarget');
      if (globalObj && globalObj.points_value) {
        targetPts = globalObj.points_value;
      }
      const individualObj = configData.find(c => c.rule_key === `target_${empId}`);
      if (individualObj && individualObj.points_value) {
        targetPts = individualObj.points_value;
      }
    }

    setStats({
      points: currentEmpPoints,
      rank: userRank,
      pendingTasks: pendingTaskCount || 0,
      completedTasks: completedTaskCount || 0,
      target: targetPts
    });

    setIsLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleClockIn = async () => {
    if (!employee) return;
    setIsAttendanceLoading(true);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Mock coordinates with small random offset
    const randomOffset = () => (Math.random() - 0.5) * 0.01;
    const lat = 12.9716 + randomOffset();
    const lng = 77.5946 + randomOffset();
    const address = "RYM Grenergy Site Zone B, Bangalore";

    // Determine status (morning clock-in window 9:00 AM - 10:30 AM)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const status = (hours < 10 || (hours === 10 && minutes <= 30)) ? 'Present' : 'Late';

    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        employee_id: employee.id,
        date: todayStr,
        clock_in: now.toISOString(),
        status: status,
        lat: lat,
        lng: lng,
        address: address,
        notes: 'Clocked in via Employee Mobile Web Panel'
      }])
      .select()
      .single();

    if (!error && data) {
      setTodayAttendance(data);
      toast.success('Successfully clocked in!');
      // Reload stats
      loadDashboardData();
    } else {
      toast.error('Error clocking in: ' + (error?.message || 'Unknown error'));
    }

    setIsAttendanceLoading(false);
  };

  const handleClockOut = async () => {
    if (!todayAttendance) return;
    setIsAttendanceLoading(true);

    const now = new Date();

    const { data, error } = await supabase
      .from('attendance')
      .update({
        clock_out: now.toISOString()
      })
      .eq('id', todayAttendance.id)
      .select()
      .single();

    if (!error && data) {
      setTodayAttendance(data);
      toast.success('Successfully clocked out!');
    } else {
      toast.error('Error clocking out: ' + (error?.message || 'Unknown error'));
    }

    setIsAttendanceLoading(false);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={36} />
      </div>
    );
  }

  const formatTime = (isoString) => {
    if (!isoString) return '--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <h1 className="page-title">Executive Dashboard</h1>
      <p className="page-subtitle">Track your daily field attendance, tasks progress, and performance points.</p>

      {/* Grid Stats */}
      <div className="employee-stats">
        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(0, 223, 162, 0.1)', color: 'var(--primary)' }}>
            <Award size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">My Performance Points</span>
            <span className="stat-value">{stats.points} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>pts</span></span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)', color: 'var(--secondary)' }}>
            <Trophy size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Leaderboard Standing</span>
            <span className="stat-value">{stats.rank}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <CheckSquare size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Assigned Active Tasks</span>
            <span className="stat-value">{stats.pendingTasks}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(0, 223, 162, 0.1)', color: 'var(--primary)' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Tasks Completed</span>
            <span className="stat-value">{stats.completedTasks}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-layout">
        {/* Clock In Widget */}
        <div className="card attendance-widget glass">
          <div className="widget-header">
            <Clock size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Daily Field Attendance</h3>
          </div>

          {!todayAttendance ? (
            <div className="widget-body">
              <p className="widget-text">You are not clocked in today. Please register your starting field location coordinates to begin operations.</p>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Morning Clock In:</span>
                  <strong style={{ color: 'var(--success)' }}>9:00 AM - 10:30 AM</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Evening Check Out:</span>
                  <strong style={{ color: 'var(--primary)' }}>6:00 PM - 7:00 PM</strong>
                </div>
              </div>
              <button 
                className="btn-primary clock-btn" 
                onClick={handleClockIn}
                disabled={isAttendanceLoading}
              >
                {isAttendanceLoading ? (
                  <>
                    <Loader2 className="spinner" size={18} /> Logging check-in...
                  </>
                ) : (
                  <>
                    <MapPin size={18} /> Clock In Now (Field Office)
                  </>
                )}
              </button>
            </div>
          ) : !todayAttendance.clock_out ? (
            <div className="widget-body">
              <div className="attendance-info-box">
                <div className="info-line">
                  <span className="info-label">Clocked In At:</span>
                  <span className="info-val">{formatTime(todayAttendance.clock_in)}</span>
                </div>
                <div className="info-line">
                  <span className="info-label">Check-in Punctuality:</span>
                  <span className={`status-badge status-${(todayAttendance.status || 'present').toLowerCase()}`}>
                    {todayAttendance.status || 'Present'}
                  </span>
                </div>
                <div className="info-line" style={{ border: 'none', paddingBottom: 0 }}>
                  <span className="info-label">Registered Coordinates:</span>
                  <span className="info-val" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {Number(todayAttendance.lat).toFixed(4)}, {Number(todayAttendance.lng).toFixed(4)}
                  </span>
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.6rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Expected Check Out Window:</span>
                <strong style={{ color: 'var(--primary)' }}>6:00 PM - 7:00 PM</strong>
              </div>

              <button 
                className="btn-primary clock-btn clock-out-btn" 
                onClick={handleClockOut}
                disabled={isAttendanceLoading}
              >
                {isAttendanceLoading ? (
                  <>
                    <Loader2 className="spinner" size={18} /> Saving checkout...
                  </>
                ) : (
                  <>
                    <Clock size={18} /> Clock Out (End Day)
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="widget-body text-center">
              <div className="success-circle">
                <CheckSquare size={36} color="var(--primary)" />
              </div>
              <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#ffffff' }}>Shift Complete</h4>
              <p className="widget-text" style={{ fontSize: '0.88rem' }}>
                You checked in at <strong>{formatTime(todayAttendance.clock_in)}</strong> and checked out at <strong>{formatTime(todayAttendance.clock_out)}</strong>. Great work today!
              </p>
            </div>
          )}
        </div>

        {/* Daily Target Progress Card */}
        <div className="card progress-panel">
          <h3 style={{ marginBottom: '1.25rem' }}>Monthly Points Objective</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
            Earn performance points by checking in on-time (+5 pts), logging successful client onboardings (+30 pts), and finishing tasks (+15 pts). Achieve your target of {stats.target || 400} points.
          </p>

          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '0.92rem', marginBottom: '0.5rem' }}>
              <span>Objective Milestone</span>
              <span>{Math.min(Math.round((stats.points / (stats.target || 400)) * 100), 100)}%</span>
            </div>
            <div className="progress-track" style={{ height: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
              <div 
                className="progress-fill" 
                style={{ 
                  height: '100%', 
                  width: `${Math.min(Math.round((stats.points / (stats.target || 400)) * 100), 100)}%`, 
                  backgroundColor: 'var(--primary)', 
                  boxShadow: '0 0 10px var(--primary-glow)',
                  borderRadius: '6px',
                  transition: 'width 0.5s ease-out'
                }}
              ></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.5rem' }}>
              <span>{stats.points} points logged</span>
              <span>{stats.target || 400} points Target</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
