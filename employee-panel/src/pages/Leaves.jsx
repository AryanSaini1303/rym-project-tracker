import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Search, Loader2, Plus, X, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { triggerPushNotification } from '../lib/push';
import './Leaves.css';

const Leaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('Apply'); // 'Apply' or 'Edit'
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);

  // Form states
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchLeaves = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[Employee Leaves] Logged in as:', user?.email);

    if (!user) {
      console.warn('[Employee Leaves] No user logged in');
      setIsLoading(false);
      return;
    }

    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .single();

    console.log('[Employee Leaves] Employee lookup → empData:', empData, '| empError:', empError);

    if (!empData) {
      console.error('[Employee Leaves] No employee record found for email:', user.email);
      setIsLoading(false);
      return;
    }

    setEmployee(empData);

    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('employee_id', empData.id)
      .order('start_date', { ascending: false });

    console.log('[Employee Leaves] Leaves fetch → data:', data, '| error:', error);

    if (!error && data) {
      const formatted = data.map(row => {
        const start = new Date(row.start_date);
        const end = new Date(row.end_date);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        return {
          id: row.id,
          type: row.leave_type,
          startDate: row.start_date,
          endDate: row.end_date,
          duration: `${row.start_date} - ${row.end_date} (${diffDays} Day${diffDays > 1 ? 's' : ''})`,
          reason: row.reason || 'No reason specified.',
          status: row.status
        };
      });
      setLeaves(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setError('');

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError('End date must be on or after the start date.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for your leave request.');
      return;
    }

    setIsSubmitting(true);

    if (modalMode === 'Apply') {
      const { data: newLeave, error: insertError } = await supabase
        .from('leaves')
        .insert([{
          employee_id: employee.id,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          status: 'Pending'
        }])
        .select()
        .single();

      console.log('[Employee Leaves] Insert result → newLeave:', newLeave, '| insertError:', insertError);

      if (!insertError && newLeave) {
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
        const formattedLeave = {
          id: newLeave.id,
          type: newLeave.leave_type,
          startDate: newLeave.start_date,
          endDate: newLeave.end_date,
          duration: `${newLeave.start_date} - ${newLeave.end_date} (${diffDays} Day${diffDays > 1 ? 's' : ''})`,
          reason: newLeave.reason,
          status: newLeave.status
        };

        setLeaves([formattedLeave, ...leaves]);
        setShowModal(false);
        toast.success('Leave request submitted successfully!');

        // Create admin notification
        const newNotification = [{
          user_id: null, // null means it's for all admins
          title: 'New Leave Request',
          message: `${employee?.name || 'An employee'} applied for ${leaveType}.`,
          type: 'leave',
          link: '/leaves'
        }];
        await supabase.from('notifications').insert(newNotification);
        await triggerPushNotification(newNotification);

        // Reset
        setLeaveType('Annual Leave');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate(new Date().toISOString().split('T')[0]);
        setReason('');
      } else {
        toast.error(insertError?.message || 'Failed to submit leave request');
      }
    } else {
      const { data: updatedLeave, error: updateError } = await supabase
        .from('leaves')
        .update({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim()
        })
        .eq('id', selectedLeaveId)
        .select()
        .single();

      if (!updateError && updatedLeave) {
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
        setLeaves(leaves.map(l => l.id === selectedLeaveId ? {
          id: updatedLeave.id,
          type: updatedLeave.leave_type,
          startDate: updatedLeave.start_date,
          endDate: updatedLeave.end_date,
          duration: `${updatedLeave.start_date} - ${updatedLeave.end_date} (${diffDays} Day${diffDays > 1 ? 's' : ''})`,
          reason: updatedLeave.reason,
          status: updatedLeave.status
        } : l));
        setShowModal(false);
        toast.success('Leave request updated successfully!');

        // Reset
        setLeaveType('Annual Leave');
        setStartDate(new Date().toISOString().split('T')[0]);
        setEndDate(new Date().toISOString().split('T')[0]);
        setReason('');
        setSelectedLeaveId(null);
      } else {
        toast.error(updateError?.message || 'Failed to update leave request');
      }
    }
    setIsSubmitting(false);
  };

  const handleDeleteRequest = async (leaveId) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to delete this leave request?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const { error } = await supabase.from('leaves').delete().eq('id', leaveId);
            if (!error) {
              setLeaves(leaves.filter(l => l.id !== leaveId));
              toast.success('Leave request deleted successfully!');
            } else {
              toast.error('Error deleting leave request: ' + error.message);
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={36} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">My Leave Applications</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Submit leave applications and check review states.</p>
        </div>
        <button 
          type="button"
          className="btn-primary flex items-center gap-2" 
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setModalMode('Apply');
            setLeaveType('Annual Leave');
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate(new Date().toISOString().split('T')[0]);
            setReason('');
            setShowModal(true);
          }}
        >
          <Plus size={18} /> Apply for Leave
        </button>
      </div>

      <div className="card table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Leave Type</th>
              <th>Duration</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length > 0 ? (
              leaves.map((leave) => (
                <tr key={leave.id}>
                  <td style={{ fontWeight: 600, color: '#ffffff' }}>{leave.type}</td>
                  <td>{leave.duration}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leave.reason}
                  </td>
                  <td>
                    <span className={`leave-status status-${leave.status.toLowerCase()}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td>
                    {leave.status === 'Pending' ? (
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          className="action-btn" 
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setModalMode('Edit');
                            setSelectedLeaveId(leave.id);
                            setLeaveType(leave.type);
                            setStartDate(leave.startDate);
                            setEndDate(leave.endDate);
                            setReason(leave.reason);
                            setShowModal(true);
                          }}
                          title="Edit Leave"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          type="button"
                          className="action-btn" 
                          style={{ color: 'var(--danger)' }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteRequest(leave.id);
                          }}
                          title="Delete Leave"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Locked</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                  No leave requests submitted yet. Click "Apply for Leave" to create a request!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Apply / Edit Leave Modal */}
      {showModal && ReactDOM.createPortal(
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }} style={{ zIndex: 9999 }}>
          <div className="modal-window glass" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                {modalMode === 'Apply' ? 'Apply for Leave' : 'Edit Leave Request'}
              </h3>
              <button type="button" className="modal-close-btn" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmitLeave}>
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-group-modal">
                <label>Leave Type</label>
                <select
                  className="modal-input"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Maternity/Paternity">Maternity / Paternity</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group-modal" style={{ flex: 1 }}>
                  <label>Start Date</label>
                  <input
                    type="date"
                    className="modal-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group-modal" style={{ flex: 1 }}>
                  <label>End Date</label>
                  <input
                    type="date"
                    className="modal-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group-modal">
                <label>Reason for Leave</label>
                <textarea
                  className="modal-input"
                  style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }}
                  placeholder="State the reason for your leave request..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : modalMode === 'Apply' ? 'Submit Request' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Leaves;
