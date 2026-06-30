import React, { useState, useEffect } from 'react';
import { Coins, CheckCircle, Save, RotateCcw, AlertTriangle, Plus, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import './PointsConfig.css';

const defaultPoints = {
  clockIn: 5,
  lateClockIn: 2,
  taskDone: 15,
  meetingLogged: 10,
  onboardSuccess: 30,
  onboardFail: 0,
  monthlyTarget: 400
};

const SYSTEM_RULES = ['clockIn', 'lateClockIn', 'taskDone', 'meetingLogged', 'onboardSuccess', 'onboardFail', 'monthlyTarget'];

const PointsConfig = () => {
  const [configs, setConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  // Form states
  const [ruleName, setRuleName] = useState('');
  const [ruleKey, setRuleKey] = useState('');
  const [pointsValue, setPointsValue] = useState(0);
  const [formError, setFormError] = useState('');

  // Fetch configs on mount
  const fetchConfigs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('points_config')
      .select('*')
      .order('rule_name');

    if (!error && data) {
      setConfigs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchConfigs();

    // Auto-refresh if point config is changed from another session
    const configSub = supabase
      .channel('public:points_config_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'points_config' }, () => {
        fetchConfigs();
      })
      .subscribe();

    return () => supabase.removeChannel(configSub);
  }, []);

  // Open Edit Modal
  const handleEditClick = (rule) => {
    setSelectedRule(rule);
    setRuleName(rule.rule_name);
    setRuleKey(rule.rule_key);
    setPointsValue(rule.points_value);
    setFormError('');
    setShowEditModal(true);
  };

  // Open Add Modal
  const handleAddClick = () => {
    setRuleName('');
    setRuleKey('');
    setPointsValue(10);
    setFormError('');
    setShowAddModal(true);
  };

  // Handle auto-generation of Rule Key during entry of Rule Name
  const handleNameChange = (val) => {
    setRuleName(val);
    // Auto-generate camelCase key only if adding a new custom rule
    if (!selectedRule) {
      const generatedKey = val
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
        .replace(/[^a-zA-Z0-9]/g, '');
      setRuleKey(generatedKey);
    }
  };

  // Save Edit Rule
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!ruleName.trim()) {
      setFormError('Please enter a rule name.');
      return;
    }

    const { error } = await supabase
      .from('points_config')
      .update({
        rule_name: ruleName.trim(),
        points_value: parseInt(pointsValue) || 0,
        updated_at: new Date()
      })
      .eq('rule_key', selectedRule.rule_key);

    if (!error) {
      toast.success('Point rule updated successfully!');
      fetchConfigs();
      setShowEditModal(false);
    } else {
      setFormError(error.message);
      toast.error('Failed to update rule.');
    }
  };

  // Add New Rule
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!ruleName.trim() || !ruleKey.trim()) {
      setFormError('Please enter both rule name and rule key.');
      return;
    }

    // Check if key already exists
    if (configs.some(c => c.rule_key.toLowerCase() === ruleKey.toLowerCase())) {
      setFormError('A configuration with this rule key already exists.');
      return;
    }

    const { error } = await supabase
      .from('points_config')
      .insert([{
        rule_key: ruleKey.trim(),
        rule_name: ruleName.trim(),
        points_value: parseInt(pointsValue) || 0
      }]);

    if (!error) {
      toast.success('New point rule added successfully!');
      fetchConfigs();
      setShowAddModal(false);
    } else {
      setFormError(error.message);
      toast.error('Failed to add new point rule.');
    }
  };

  // Delete Rule Action
  const handleDeleteClick = (rule) => {
    const isSystem = SYSTEM_RULES.includes(rule.rule_key);

    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>
          Are you sure you want to delete the rule <strong>"{rule.rule_name}"</strong>?
        </p>
        {isSystem && (
          <p style={{ margin: 0, color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4 }}>
            ⚠️ Warning: This is a system default rule. Deleting it may disable automatic point calculations for this action.
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>Cancel</button>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              const { error } = await supabase
                .from('points_config')
                .delete()
                .eq('rule_key', rule.rule_key);
              
              if (!error) {
                toast.success('Point rule deleted successfully!');
                fetchConfigs();
              } else {
                toast.error('Error deleting point rule: ' + error.message);
              }
            }} 
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  // Reset System Defaults
  const handleReset = async () => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to reset system rules to default weights?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const resetPromises = Object.entries(defaultPoints).map(([key, val]) => 
              supabase.from('points_config').update({ points_value: val, updated_at: new Date() }).eq('rule_key', key)
            );
            const results = await Promise.all(resetPromises);
            const hasError = results.some(r => r.error);
            if (!hasError) {
              toast.success('Reset system rules to factory defaults!');
              fetchConfigs();
            } else {
              toast.error('Error resetting point weights.');
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
          >Reset</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  return (
    <div>
      <div className="attendance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Points Configuration</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Define activity weighting to calculate field staff performance metrics automatically.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={handleAddClick}>
          <Plus size={18} /> Add Point Rule
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          Loading configurations...
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Rule Name</th>
                <th style={{ width: '25%' }}>Rule Key</th>
                <th style={{ width: '15%' }}>Point Value</th>
                <th style={{ width: '20%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => {
                const isSystem = SYSTEM_RULES.includes(config.rule_key);
                return (
                  <tr key={config.id} className="employee-row-hover">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Coins size={18} color={isSystem ? 'var(--primary)' : 'var(--text-secondary)'} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{config.rule_name}</div>
                          {isSystem && (
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'rgba(0, 223, 162, 0.1)', color: 'var(--primary)', borderRadius: '10px', display: 'inline-block', marginTop: '0.25rem', fontWeight: 600 }}>System Default</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {config.rule_key}
                    </td>
                    <td style={{ fontWeight: 800, color: config.points_value > 0 ? 'var(--primary)' : 'var(--text-secondary)', fontSize: '1.05rem' }}>
                      {config.points_value > 0 ? `+${config.points_value}` : config.points_value} pts
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="action-btn" 
                          style={{ border: '1px solid var(--border-color)', padding: '0.4rem' }} 
                          onClick={() => handleEditClick(config)}
                          title="Edit point value"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="action-btn" 
                          style={{ border: '1px solid var(--border-color)', padding: '0.4rem', color: 'var(--danger)' }} 
                          onClick={() => handleDeleteClick(config)}
                          title="Delete rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Warning Notice */}
      <div className="card glass" style={{ borderLeft: '5px solid var(--warning)', display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem', padding: '1.5rem' }}>
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
          <RotateCcw size={16} /> Restore System Defaults
        </button>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal-window glass" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Add Point Rule</h3>
              <button onClick={() => setShowAddModal(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleAddSubmit}>
              {formError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div className="form-group-modal">
                <label>Rule Name</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. Code Review Success"
                  value={ruleName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-modal">
                <label>Rule Key (System Reference)</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="e.g. codeReviewSuccess"
                  value={ruleKey}
                  onChange={(e) => setRuleKey(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  Used to reference this rule in system calculations. Key will be sanitized to letters & numbers.
                </span>
              </div>

              <div className="form-group-modal">
                <label>Point Value</label>
                <input
                  type="number"
                  className="modal-input"
                  placeholder="e.g. 10"
                  value={pointsValue}
                  onChange={(e) => setPointsValue(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="modal-window glass" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>Edit Point Rule</h3>
              <button onClick={() => setShowEditModal(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleEditSubmit}>
              {formError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <div className="form-group-modal">
                <label>Rule Name</label>
                <input
                  type="text"
                  className="modal-input"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  disabled={SYSTEM_RULES.includes(ruleKey)}
                  style={SYSTEM_RULES.includes(ruleKey) ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                  required
                />
                {SYSTEM_RULES.includes(ruleKey) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                    System default rule names cannot be modified.
                  </span>
                )}
              </div>

              <div className="form-group-modal">
                <label>Rule Key (System Reference)</label>
                <input
                  type="text"
                  className="modal-input"
                  value={ruleKey}
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group-modal">
                <label>Point Value</label>
                <input
                  type="number"
                  className="modal-input"
                  value={pointsValue}
                  onChange={(e) => setPointsValue(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointsConfig;
