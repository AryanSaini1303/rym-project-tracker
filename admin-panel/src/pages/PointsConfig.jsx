import React, { useState, useEffect } from 'react';
import { Coins, CheckCircle, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import './PointsConfig.css';

const defaultPoints = {
  clockIn: 5,
  lateClockIn: 2,
  taskDone: 15,
  meetingLogged: 10,
  onboardSuccess: 30,
  onboardFail: 0
};

const PointsConfig = () => {
  const [points, setPoints] = useState(defaultPoints);

  // Fetch from database on mount
  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('points_config')
      .select('*');

    if (!error && data && data.length > 0) {
      const configObj = {};
      data.forEach(row => {
        configObj[row.rule_key] = row.points_value;
      });
      setPoints(configObj);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleInputChange = (key, val) => {
    const num = parseInt(val) || 0;
    setPoints(prev => ({
      ...prev,
      [key]: num
    }));
  };

  const handleSave = async () => {
    let hasError = false;

    // Loop and update each key in the points_config table
    for (const [key, val] of Object.entries(points)) {
      const { error } = await supabase
        .from('points_config')
        .update({ points_value: val, updated_at: new Date() })
        .eq('rule_key', key);
      
      if (error) {
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      toast.success('Points configuration saved to database successfully!');
    } else {
      toast.error('Error saving point configurations to Supabase.');
    }
  };

  const handleReset = async () => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to reset to default rules?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const resetPromises = Object.entries(defaultPoints).map(([key, val]) => 
              supabase.from('points_config').update({ points_value: val }).eq('rule_key', key)
            );
            const results = await Promise.all(resetPromises);
            const hasError = results.some(r => r.error);
            if (!hasError) {
              setPoints(defaultPoints);
              toast.success('Reset to factory default points!');
            } else {
              toast.error('Error resetting point weights.');
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Reset</button>
        </div>
      </div>
    ), { duration: 5000 });
  };


  return (
    <div>
      <div className="attendance-header">
        <div>
          <h1 className="page-title">Points Configuration</h1>
          <p className="page-subtitle">Define activity weighting to calculate field staff performance metrics automatically.</p>
        </div>
      </div>

      <div className="config-grid">
        {/* Attendance Points */}
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Coins color="var(--primary)" size={24} />
            <h3 style={{ margin: 0 }}>Attendance Rules</h3>
          </div>
          
          <div className="config-item">
            <div className="config-label-desc">
              <span className="config-title">On-Time Check-In</span>
              <span className="config-desc">Points awarded for clocking in before standard office hours.</span>
            </div>
            <input 
              type="number" 
              className="config-input" 
              value={points.clockIn}
              onChange={(e) => handleInputChange('clockIn', e.target.value)}
            />
          </div>

          <div className="config-item">
            <div className="config-label-desc">
              <span className="config-title">Late Check-In</span>
              <span className="config-desc">Reduced points awarded for check-ins after standard start time.</span>
            </div>
            <input 
              type="number" 
              className="config-input" 
              value={points.lateClockIn}
              onChange={(e) => handleInputChange('lateClockIn', e.target.value)}
            />
          </div>
        </div>

        {/* Tasks & Deliverables */}
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Coins color="var(--secondary)" size={24} />
            <h3 style={{ margin: 0 }}>Tasks & Audits</h3>
          </div>
          
          <div className="config-item">
            <div className="config-label-desc">
              <span className="config-title">Task Completion</span>
              <span className="config-desc">Awarded when an assigned task changes state to Done.</span>
            </div>
            <input 
              type="number" 
              className="config-input" 
              value={points.taskDone}
              onChange={(e) => handleInputChange('taskDone', e.target.value)}
            />
          </div>

          <div className="config-item">
            <div className="config-label-desc">
              <span className="config-title">Customer Meetings</span>
              <span className="config-desc">Awarded when an executive registers a direct customer visit.</span>
            </div>
            <input 
              type="number" 
              className="config-input" 
              value={points.meetingLogged}
              onChange={(e) => handleInputChange('meetingLogged', e.target.value)}
            />
          </div>
        </div>

        {/* Onboarding Activities */}
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Coins color="var(--warning)" size={24} />
            <h3 style={{ margin: 0 }}>Sales Onboarding</h3>
          </div>
          
          <div className="config-item">
            <div className="config-label-desc">
              <span className="config-title">Merchant Onboarding (Success)</span>
              <span className="config-desc">Points given upon successful verification check for a new merchant account.</span>
            </div>
            <input 
              type="number" 
              className="config-input" 
              value={points.onboardSuccess}
              onChange={(e) => handleInputChange('onboardSuccess', e.target.value)}
            />
          </div>

          <div className="config-item">
            <div className="config-label-desc">
              <span className="config-title">Verification Rejection (Fail)</span>
              <span className="config-desc">Points awarded for a submission that fails verification checks.</span>
            </div>
            <input 
              type="number" 
              className="config-input" 
              value={points.onboardFail}
              onChange={(e) => handleInputChange('onboardFail', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="card glass" style={{ borderLeft: '5px solid var(--warning)', display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <AlertTriangle size={24} color="var(--warning)" style={{ flexShrink: 0 }} />
        <div>
          <h4 style={{ marginBottom: '0.25rem' }}>Rule Recalculation Notice</h4>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Updating point values does not retroactively change history. Points for past check-ins, tasks, and meetings remain as they were logged under preceding system weights. New weights apply exclusively to actions logged going forward.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button className="btn-primary" style={{ backgroundColor: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={handleReset}>
          <RotateCcw size={16} /> Restore Defaults
        </button>
        <button className="btn-primary" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={handleSave}>
          <Save size={16} /> Save Configurations
        </button>
      </div>

    </div>
  );
};

export default PointsConfig;
