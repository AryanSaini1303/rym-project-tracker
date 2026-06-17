import React, { useState, useEffect } from 'react';
import { Search, MapPin, CheckCircle, Clock, XCircle, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import './Attendance.css';

const Attendance = () => {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchAttendance = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
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
      .order('clock_in', { ascending: false });

    if (!error && data) {
      const formatted = data.map(row => ({
        id: row.id,
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

    // Auto-refresh when employee clocks in/out or any attendance record changes
    const attendanceSub = supabase
      .channel('public:attendance_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchAttendance();
      })
      .subscribe();

    return () => supabase.removeChannel(attendanceSub);
  }, []);


  // Filter handlers
  const filteredRecords = records.filter(rec => {
    const matchesSearch = rec.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          rec.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' || rec.status === statusFilter;
    const matchesDate = rec.date === dateFilter;
    return matchesSearch && matchesStatus && matchesDate;
  });

  const presentCount = filteredRecords.filter(r => r.status === 'Present').length;
  const lateCount = filteredRecords.filter(r => r.status === 'Late').length;
  const absentCount = filteredRecords.filter(r => r.status === 'Absent').length;

  return (
    <div>
      <div className="attendance-header">
        <div>
          <h1 className="page-title">Attendance Management</h1>
          <p className="page-subtitle">Track check-ins, punctuality, and coordinates in real-time.</p>
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
                <th>Location Coordinate</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
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
                    <td>
                      {rec.status !== 'Absent' ? (
                        <button 
                          className="btn-primary flex items-center gap-1" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => setSelectedRecord(rec)}
                        >
                          <MapPin size={14} /> Map Location
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Location unavailable</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No attendance logs match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Location Modal */}
      {selectedRecord && (
        <div className="location-modal-overlay" onClick={() => setSelectedRecord(null)}>
          <div className="location-modal glass" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem' }}>Check-in Location</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Employee: <strong>{selectedRecord.name}</strong>
            </p>
            
            <div className="mock-map">
              <div className="map-marker">
                <MapPin size={32} fill="var(--danger)" />
                <span>Checked In Here</span>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              <div><strong>Address:</strong> {selectedRecord.address}</div>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                <strong>Coordinates:</strong> {selectedRecord.lat}, {selectedRecord.lng}
              </div>
            </div>

            <button className="btn-close" onClick={() => setSelectedRecord(null)}>
              Close Location Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
