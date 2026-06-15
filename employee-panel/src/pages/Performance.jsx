import React, { useState, useEffect } from 'react';
import { Trophy, Award, Search, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './Performance.css';

const Performance = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    // 1. Get employees list
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('*');

    if (empError) {
      setIsLoading(false);
      return;
    }

    // 2. Get completed task points
    const { data: taskData } = await supabase
      .from('tasks')
      .select('assignee_id, points_awarded')
      .eq('status', 'done');

    // 3. Get successful meeting points
    const { data: meetingData } = await supabase
      .from('meetings')
      .select('employee_id, points_earned')
      .eq('outcome', 'Success');

    // 4. Get targets from config
    let targetPts = 400;
    const individualTargets = {};

    const { data: configData } = await supabase
      .from('points_config')
      .select('rule_key, points_value');
      
    if (configData) {
      const globalObj = configData.find(c => c.rule_key === 'monthlyTarget');
      if (globalObj) {
        targetPts = globalObj.points_value;
      }

      configData.forEach(c => {
        if (c.rule_key.startsWith('target_')) {
          const empId = c.rule_key.replace('target_', '');
          individualTargets[empId] = c.points_value;
        }
      });
    }

    // Combine and calculate
    const formatted = empData.map(emp => {
      const taskPts = taskData
        ? taskData.filter(t => t.assignee_id === emp.id).reduce((sum, t) => sum + t.points_awarded, 0)
        : 0;

      const meetingPts = meetingData
        ? meetingData.filter(m => m.employee_id === emp.id).reduce((sum, m) => sum + m.points_earned, 0)
        : 0;

      return {
        id: emp.id,
        name: emp.name,
        dept: emp.department,
        points: taskPts + meetingPts,
        target: individualTargets[emp.id] || targetPts
      };
    });

    setLeaderboard(formatted);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Sort by points descending
  const sortedLeaderboard = [...leaderboard].sort((a, b) => b.points - a.points);

  const filteredLeaderboard = sortedLeaderboard.filter(emp => {
    const matchesDept = deptFilter === 'All' || emp.dept === deptFilter;
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDept && matchesSearch;
  });

  // Podium users
  const podium1 = filteredLeaderboard[0];
  const podium2 = filteredLeaderboard[1];
  const podium3 = filteredLeaderboard[2];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="attendance-header">
        <div>
          <h1 className="page-title">Company Leaderboard</h1>
          <p className="page-subtitle">View point metrics, monthly progress targets, and standings inside the team.</p>
        </div>
      </div>

      {/* Top 3 Podium */}
      {filteredLeaderboard.length > 0 && (
        <div className="podium-container">
          {/* Rank 2 (Silver) */}
          {podium2 && (
            <div className="card podium-card rank-2 glass">
              <div className="podium-rank" style={{ backgroundColor: '#a9a9a9' }}>2</div>
              <img src={`https://ui-avatars.com/api/?name=${podium2.name.replace(' ', '+')}&background=c0c0c0&color=000`} className="podium-avatar" alt="silver" />
              <div className="podium-name">{podium2.name}</div>
              <div className="podium-dept">{podium2.dept}</div>
              <div className="podium-points">{podium2.points} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>pts</span></div>
            </div>
          )}

          {/* Rank 1 (Gold) */}
          {podium1 && (
            <div className="card podium-card rank-1 glass" style={{ transform: 'scale(1.08)' }}>
              <div className="podium-rank" style={{ backgroundColor: '#ffa500' }}>
                <Trophy size={16} />
              </div>
              <img src={`https://ui-avatars.com/api/?name=${podium1.name.replace(' ', '+')}&background=ffd700&color=000`} className="podium-avatar" alt="gold" />
              <div className="podium-name" style={{ fontSize: '1.15rem' }}>{podium1.name}</div>
              <div className="podium-dept">{podium1.dept}</div>
              <div className="podium-points" style={{ fontSize: '1.4rem' }}>{podium1.points} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>pts</span></div>
            </div>
          )}

          {/* Rank 3 (Bronze) */}
          {podium3 && (
            <div className="card podium-card rank-3 glass">
              <div className="podium-rank" style={{ backgroundColor: '#8b5a2b' }}>3</div>
              <img src={`https://ui-avatars.com/api/?name=${podium3.name.replace(' ', '+')}&background=cd7f32&color=000`} className="podium-avatar" alt="bronze" />
              <div className="podium-name">{podium3.name}</div>
              <div className="podium-dept">{podium3.dept}</div>
              <div className="podium-points">{podium3.points} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>pts</span></div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Directory Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="filters-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
            <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Search leaderboard names..."
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="filter-input"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="All">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Design">Design</option>
            <option value="Marketing">Marketing</option>
            <option value="Sales">Sales</option>
            <option value="Management">Management</option>
          </select>
        </div>

        {/* Directory List */}
        <div className="table-container" style={{ boxShadow: 'none', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Points Logged</th>
                <th>Monthly Progress Target</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.length > 0 ? (
                filteredLeaderboard.map((emp, index) => {
                  const percent = Math.min(Math.round((emp.points / emp.target) * 100), 100);
                  return (
                    <tr key={emp.id}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-secondary)' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </td>
                      <td>
                        <div className="employee-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <img src={`https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`} alt={emp.name} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                          <span style={{ fontWeight: 600 }}>{emp.name}</span>
                        </div>
                      </td>
                      <td>{emp.dept}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{emp.points}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {emp.target} pts</span>
                      </td>
                      <td>
                        <div className="progress-bar-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="progress-track" style={{ height: '8px', flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div className="progress-fill" style={{ height: '100%', width: `${percent}%`, backgroundColor: index < 3 ? 'var(--secondary)' : 'var(--primary)', boxShadow: index < 3 ? '0 0 8px rgba(0, 223, 162, 0.3)' : 'none' }}></div>
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '40px' }}>{percent}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No leaderboard logs match criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Performance;
