import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, Clock, XCircle, Calendar, RefreshCw, MinusCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Attendance = () => {
  const [records, setRecords] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    
    const [{ data, error }, { data: empData, error: empError }] = await Promise.all([
      supabase
        .from('attendance')
        .select(`
          id,
          employee_id,
          date,
          clock_in,
          clock_out,
          status,
          lat,
          lng,
          address,
          notes,
          employees:employee_id (
            name,
            email
          )
        `)
        .order('clock_in', { ascending: false }),
      supabase.from('employees').select('id, name, email')
    ]);

    if (!empError && empData) {
      setAllEmployees(empData);
    }

    if (!error && data) {
      const formatted = data.map(row => ({
        id: row.id,
        empId: row.employee_id,
        name: row.employees?.name || 'Unknown',
        email: row.employees?.email || 'N/A',
        date: row.date,
        clockIn: row.clock_in ? new Date(row.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        clockOut: row.clock_out ? new Date(row.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        status: row.status,
        lat: Number(row.lat) || 0,
        lng: Number(row.lng) || 0,
        address: row.address || 'N/A'
      }));
      setRecords(formatted);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAttendance();

    const handleUpdate = () => {
      fetchAttendance();
    };

    window.addEventListener('supabase_realtime_update', handleUpdate);

    return () => window.removeEventListener('supabase_realtime_update', handleUpdate);
  }, []);


  // Filter handlers
  const recordsForDate = records.filter(rec => rec.date === dateFilter);
  const presentEmpIds = new Set(recordsForDate.map(r => r.empId));

  const inactiveRecords = allEmployees
    .filter(emp => !presentEmpIds.has(emp.id))
    .map(emp => ({
      id: `inactive-${emp.id}-${dateFilter}`,
      empId: emp.id,
      name: emp.name,
      email: emp.email,
      date: dateFilter,
      clockIn: '--',
      clockOut: '--',
      status: 'Inactive',
      lat: 0,
      lng: 0,
      address: 'N/A'
    }));

  const combinedRecords = [...recordsForDate, ...inactiveRecords];

  const filteredRecords = combinedRecords.filter(rec => {
    const matchesSearch = rec.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          rec.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const presentCount = filteredRecords.filter(r => r.status === 'Present').length;
  const lateCount = filteredRecords.filter(r => r.status === 'Late').length;
  const absentCount = filteredRecords.filter(r => r.status === 'Absent').length;
  const inactiveCount = filteredRecords.filter(r => r.status === 'Inactive').length;

  return (
    <div>
      <div className="attendance-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-subtitle">Track check-ins (Morning: 9:00 - 10:30 AM), check-outs (6:00 - 7:00 PM), and coordinates in real-time.</p>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="attendance-stats">
        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(67, 24, 255, 0.1)', color: 'var(--primary)' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Total Active</span>
            <span className="stat-value">{presentCount + lateCount}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(5, 205, 153, 0.1)', color: 'var(--secondary)' }}>
            <CheckCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">On-Time</span>
            <span className="stat-value">{presentCount}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <Clock size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Late Check-ins</span>
            <span className="stat-value">{lateCount}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
            <XCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Absent</span>
            <span className="stat-value">{absentCount}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(158, 158, 158, 0.1)', color: 'var(--text-secondary)' }}>
            <MinusCircle size={28} />
          </div>
          <div className="stat-info">
            <span className="stat-title">Inactive</span>
            <span className="stat-value">{inactiveCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="filters-bar">
          <div className="input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
            <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
            <input
              type="text"
              className="filter-input"
              placeholder="Search by employee name or email..."
              style={{ width: '100%', paddingLeft: '2.5rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="date"
              className="filter-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <select
              className="filter-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="table-container" style={{ boxShadow: 'none', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    Loading attendance logs...
                  </td>
                </tr>
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <div className="employee-cell">
                        <img src={`https://ui-avatars.com/api/?name=${rec.name.replace(' ', '+')}&background=random`} alt={rec.name} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{rec.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rec.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{rec.date}</td>
                    <td>{rec.clockIn}</td>
                    <td>{rec.clockOut}</td>
                    <td>
                      <span className={`status-badge status-${rec.status.toLowerCase()}`}>
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No attendance logs match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Location Modal Removed */}
    </div>
  );
};

export default Attendance;
