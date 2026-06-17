import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { triggerPushNotification } from '../lib/push';
import './Leaves.css';

const Leaves = () => {
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchLeaves = async () => {
    setIsLoading(true);

    // Debug: log current auth user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('[Admin Leaves] Auth user:', user?.email, '| Auth error:', authError);

    const { data, error } = await supabase
      .from('leaves')
      .select(`
        id,
        leave_type,
        start_date,
        end_date,
        reason,
        status,
        employee_id,
        employees:employee_id (
          name
        )
      `)
      .order('start_date', { ascending: false });

    // Debug: always log the raw result
    console.log('[Admin Leaves] Supabase result → data:', data, '| error:', error);

    if (error) {
      console.error('[Admin Leaves] FETCH ERROR:', error.message, error.details, error.hint);
    }

    if (!error && data) {
      const formatted = data.map(row => {
        const start = new Date(row.start_date);
        const end = new Date(row.end_date);
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        return {
          id: row.id,
          name: row.employees?.name || 'Unknown',
          type: row.leave_type,
          duration: `${row.start_date} - ${row.end_date} (${diffDays} Day${diffDays > 1 ? 's' : ''})`,
          reason: row.reason || 'No reason specified',
          status: row.status,
          employee_id: row.employee_id
        };
      });
      console.log('[Admin Leaves] Formatted leaves count:', formatted.length);
      setLeaves(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLeaves();

    // Auto-refresh when an employee submits a new leave request or status changes
    const leavesSubscription = supabase
      .channel('public:leaves')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leaves' }, (payload) => {
        console.log('[Admin Leaves] Realtime update received, auto-refreshing...');
        fetchLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leavesSubscription);
    };
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    const { error } = await supabase
      .from('leaves')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setLeaves(leaves.map(l => l.id === id ? { ...l, status: newStatus } : l));
      toast.success('Leave status updated successfully!');
      
      // Create notification
      const leaveRecord = leaves.find(l => l.id === id);
      if (leaveRecord && leaveRecord.employee_id) {
      const newNotification = [{
          user_id: leaveRecord.employee_id,
          title: `Leave Request ${newStatus}`,
          message: `Your ${leaveRecord.type} request has been ${newStatus.toLowerCase()}.`,
          type: 'leave',
          link: '/leaves'
        }];
        await supabase.from('notifications').insert(newNotification);
        await triggerPushNotification(newNotification);
      }
    } else {
      alert('Error updating status: ' + error.message);
    }
  };

  const filteredLeaves = leaves.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          l.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });


  return (
    <div>
      <h1 className="page-title">Leave Requests</h1>
      <p className="page-subtitle">Review and manage employee leave applications.</p>

      {/* Filters Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
            <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Search by name or reason..."
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="filter-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="card table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Duration</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading leave requests...
                </td>
              </tr>
            ) : filteredLeaves.length > 0 ? (
              filteredLeaves.map((leave) => (
                <tr key={leave.id}>
                  <td>
                    <div className="employee-cell">
                      <img src={`https://ui-avatars.com/api/?name=${leave.name.replace(' ', '+')}&background=random`} alt={leave.name} />
                      <div style={{ fontWeight: 600 }}>{leave.name}</div>
                    </div>
                  </td>
                  <td>{leave.type}</td>
                  <td>{leave.duration}</td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {leave.reason}
                  </td>
                  <td>
                    <span className={`leave-status status-${leave.status.toLowerCase()}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td>
                    {leave.status === 'Pending' ? (
                      <div className="leave-actions">
                        <button className="btn-approve" onClick={() => handleStatusChange(leave.id, 'Approved')}>Approve</button>
                        <button className="btn-reject" onClick={() => handleStatusChange(leave.id, 'Rejected')}>Reject</button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Processed as <strong>{leave.status}</strong>
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No leave applications found matching filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaves;

