import React, { useState, useEffect } from 'react';
import { Trophy, Award, Search, Filter, Edit3, X, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import './Performance.css';

const Performance = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [globalTarget, setGlobalTarget] = useState(400);

  // Manual Points Modal
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [pointsAdjustment, setPointsAdjustment] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    // 2. Get completed task points (legacy tasks & manual adjustments)
    const { data: taskData } = await supabase
      .from('tasks')
      .select('assignee_id, points_awarded')
      .in('status', ['done', 'completed'])
      .not('assignee_id', 'is', null);

    // 2.5 Get completed task points from new task_assignees schema
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
        setGlobalTarget(targetPts);
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
      const oldTaskPts = taskData
        ? taskData.filter(t => t.assignee_id === emp.id).reduce((sum, t) => sum + (t.points_awarded || 0), 0)
        : 0;

      const newTaskPts = taskAssigneeData
        ? taskAssigneeData.filter(ta => ta.employee_id === emp.id).reduce((sum, ta) => sum + (ta.tasks?.points_awarded || 0), 0)
        : 0;

      const meetingPts = meetingData
        ? meetingData.filter(m => m.employee_id === emp.id).reduce((sum, m) => sum + (m.points_earned || 0), 0)
        : 0;

      return {
        id: emp.id,
        name: emp.name,
        dept: emp.department,
        points: oldTaskPts + newTaskPts + meetingPts,
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

  // Podium users (always top 3 of the filtered list, if available)
  const podium1 = filteredLeaderboard[0];
  const podium2 = filteredLeaderboard[1];
  const podium3 = filteredLeaderboard[2];
  const listUsers = filteredLeaderboard.slice(3);

  const handleEditPoints = (emp) => {
    setSelectedEmp(emp);
    setPointsAdjustment(0);
    setAdjustmentReason('');
    setShowPointsModal(true);
  };

  const submitPointsAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedEmp || pointsAdjustment === 0) return;

    setIsSubmitting(true);
    
    // We log the manual adjustment as a completed 'system' task so it automatically factors into their score
    const { error } = await supabaseAdmin.from('tasks').insert([{
      title: `Admin Adjustment: ${adjustmentReason || 'Manual override'}`,
      description: `Manual point adjustment by Admin.`,
      status: 'done',
      assignee_id: selectedEmp.id,
      points_awarded: parseInt(pointsAdjustment)
    }]);

    if (!error) {
      toast.success(`Successfully adjusted points for ${selectedEmp.name}`);
      fetchLeaderboard(); // Refresh scores
      setShowPointsModal(false);
    } else {
      toast.error("Failed to adjust points: " + error.message);
    }
    setIsSubmitting(false);
  };


  const handleEditTarget = async () => {
    const newTarget = prompt("Enter new GLOBAL monthly points target (applies to everyone without a specific target):", globalTarget);
    if (newTarget && !isNaN(newTarget) && parseInt(newTarget) > 0) {
      const targetVal = parseInt(newTarget);
      setGlobalTarget(targetVal);

      const { data } = await supabaseAdmin.from('points_config').select('id').eq('rule_key', 'monthlyTarget').single();
      if (data) {
        await supabaseAdmin.from('points_config').update({ points_value: targetVal }).eq('id', data.id);
      } else {
        await supabaseAdmin.from('points_config').insert({ rule_key: 'monthlyTarget', points_value: targetVal });
      }
      fetchLeaderboard();
    }
  };

  const handleEditIndividualTarget = async (emp) => {
    const currentTarget = emp.target;
    const userInput = prompt(`Enter individual target for ${emp.name}:\n(Leave blank or type 0 to reset to Global Target)`, currentTarget);
    
    if (userInput !== null) {
      const ruleKey = `target_${emp.id}`;
      const targetVal = parseInt(userInput);
      
      if (!isNaN(targetVal) && targetVal > 0) {
        // Upsert custom target
        const { data } = await supabaseAdmin.from('points_config').select('id').eq('rule_key', ruleKey).single();
        if (data) {
          await supabaseAdmin.from('points_config').update({ points_value: targetVal }).eq('id', data.id);
        } else {
          await supabaseAdmin.from('points_config').insert({ rule_key: ruleKey, points_value: targetVal });
        }
      } else {
        // Delete custom target if blank or 0
        await supabaseAdmin.from('points_config').delete().eq('rule_key', ruleKey);
      }
      fetchLeaderboard();
    }
  };

  return (
    <div>
      <div className="attendance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Performance Leaderboard</h1>
          <p className="page-subtitle">Track high scores, point metrics, and objective completions.</p>
        </div>
        <button 
          className="btn-primary flex items-center gap-2" 
          onClick={handleEditTarget}
          style={{ padding: '0.6rem 1.2rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--primary)' }}
        >
          <Target size={18} /> Edit Target ({globalTarget})
        </button>
      </div>

      {/* Top 3 Podium (renders only if we have at least 1 record) */}
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
        <div className="filters-bar" style={{ marginBottom: '1.5rem' }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
            <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Search leaderboards..."
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="filter-input"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Calculating leaderboard scores...
                  </td>
                </tr>
              ) : filteredLeaderboard.length > 0 ? (
                filteredLeaderboard.map((emp, index) => {
                  const percent = Math.min(Math.round((emp.points / emp.target) * 100), 100);
                  return (
                    <tr key={emp.id}>
                      <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-secondary)' }}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </td>
                      <td>
                        <div className="employee-cell">
                          <img src={`https://ui-avatars.com/api/?name=${emp.name.replace(' ', '+')}&background=random`} alt={emp.name} />
                          <span style={{ fontWeight: 600 }}>{emp.name}</span>
                        </div>
                      </td>
                      <td>{emp.dept}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{emp.points}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}> / {emp.target} pts</span>
                      </td>
                      <td>
                        <div className="progress-bar-wrapper">
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${percent}%`, backgroundColor: index < 3 ? 'var(--secondary)' : 'var(--primary)' }}></div>
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '40px' }}>{percent}%</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn-secondary flex items-center gap-1"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}
                            onClick={() => handleEditPoints(emp)}
                          >
                            <Edit3 size={14} /> Adjust Points
                          </button>
                          <button 
                            className="btn-secondary flex items-center gap-1"
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}
                            onClick={() => handleEditIndividualTarget(emp)}
                            title="Set custom goal for this employee"
                          >
                            <Target size={14} /> Goal
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No performance logs match standard parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Point Adjustment Modal */}
      {showPointsModal && selectedEmp && (
        <div className="notes-modal-overlay" onClick={() => setShowPointsModal(false)}>
          <div className="notes-modal glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Award size={20} className="text-primary" /> Adjust Points</h3>
              <button onClick={() => setShowPointsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
              Add or subtract performance points for <strong>{selectedEmp.name}</strong>.
            </p>

            <form onSubmit={submitPointsAdjustment}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Points Amount (Use negative for penalties)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={pointsAdjustment}
                  onChange={(e) => setPointsAdjustment(e.target.value)}
                  placeholder="e.g. 50 or -20"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Reason (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="e.g. Outstanding performance bonus"
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowPointsModal(false)} className="btn-close" style={{ margin: 0, padding: '0.6rem 1rem' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting || pointsAdjustment == 0} className="btn-primary" style={{ padding: '0.6rem 1rem' }}>
                  {isSubmitting ? 'Saving...' : 'Apply Points'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Performance;
