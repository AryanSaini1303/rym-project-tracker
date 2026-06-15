import React, { useState, useEffect } from 'react';
import { Search, Calendar, Video, X, ExternalLink, Copy, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import './Meetings.css';

const Meetings = () => {
  const [videoCalls, setVideoCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [isStartingCall, setIsStartingCall] = useState(false);
  
  // Scheduling State
  const [callType, setCallType] = useState('instant'); // 'instant' or 'scheduled'
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('12:00');
  const [generatedLink, setGeneratedLink] = useState('');

  const fetchVideoCalls = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('video_calls')
      .select(`
        id,
        room_name,
        status,
        created_at,
        employees:employee_id (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVideoCalls(data);
    }
    setIsLoading(false);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabaseAdmin.from('employees').select('id, name').order('name');
    if (data) {
      setEmployees(data);
    }
  };

  useEffect(() => {
    fetchVideoCalls();
    fetchEmployees();
  }, []);

  const handleStartVideoCall = async (e) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) return;
    
    setIsStartingCall(true);
    // Generate a random room name
    const roomName = `RYM-Call-${Math.floor(Math.random() * 1000000)}`;

    const { data: { user } } = await supabaseAdmin.auth.getUser();

    // Insert into video_calls table
    await supabaseAdmin.from('video_calls').insert([{
      admin_id: user?.id,
      employee_id: selectedEmpIds[0], // primary invitee
      room_name: roomName,
      status: callType === 'instant' ? 'active' : `scheduled for ${scheduledDate} ${scheduledTime}`
    }]);

    // Notify all selected employees
    const notifications = selectedEmpIds.map(empId => ({
      user_id: empId,
      title: callType === 'instant' ? 'Incoming Video Call' : `Scheduled Video Call`,
      message: callType === 'instant' 
        ? 'The admin has invited you to a live video meeting.' 
        : `A video meeting has been scheduled for ${scheduledDate} at ${scheduledTime}.`,
      type: 'call',
      link: `/video-call/${roomName}`
    }));
    
    await supabaseAdmin.from('notifications').insert(notifications);

    setIsStartingCall(false);
    fetchVideoCalls(); // Refresh table
    
    if (callType === 'instant') {
      setShowVideoModal(false);
      setSelectedEmpIds([]); // reset
      navigate(`/video-call/${roomName}`);
    } else {
      // If scheduled, just show the generated link
      setGeneratedLink(`${window.location.origin}/video-call/${roomName}`);
    }
  };

  const handleDeleteCall = async (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to delete this meeting log?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            const { error } = await supabaseAdmin
              .from('video_calls')
              .delete()
              .eq('id', id);
            
            if (!error) {
              setVideoCalls(videoCalls.filter(call => call.id !== id));
              toast.success('Meeting deleted successfully!');
            } else {
              toast.error("Failed to delete meeting: " + error.message);
            }
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Delete</button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const resetModal = () => {
    setShowVideoModal(false);
    setGeneratedLink('');
    setCallType('instant');
    setSelectedEmpIds([]);
  };

  const filteredCalls = videoCalls.filter(call => {
    const empName = call.employees?.name || 'Unknown';
    return empName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           call.room_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div>
      <div className="attendance-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Video Calls Log</h1>
          <p className="page-subtitle">History of all generated Jitsi meeting rooms and invitations.</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowVideoModal(true)}>
          <Video size={18} /> Start Video Call
        </button>
      </div>

      {/* Filter Options */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="input-wrapper" style={{ width: '100%' }}>
          <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
          <input
            type="text"
            className="filter-input"
            placeholder="Search calls by employee or room name..."
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card table-container" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Invited Employee</th>
              <th>Room Name</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  Loading video call history...
                </td>
              </tr>
            ) : filteredCalls.length > 0 ? (
              filteredCalls.map((call) => (
                <tr key={call.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-secondary" />
                      {new Date(call.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td>
                    <div className="employee-cell">
                      <img src={`https://ui-avatars.com/api/?name=${(call.employees?.name || 'Unknown').replace(' ', '+')}&background=random`} alt="Avatar" />
                      <span style={{ fontWeight: 600 }}>{call.employees?.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{call.room_name}</td>
                  <td>
                    <span className={`status-badge ${call.status?.includes('active') ? 'in-progress' : call.status?.includes('scheduled') ? 'pending' : 'completed'}`} style={{ textTransform: 'capitalize' }}>
                      {call.status || 'Ended'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button 
                        className="btn-primary flex items-center gap-1"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => navigate(`/video-call/${call.room_name}`)}
                        title="Join Meeting"
                      >
                        <ExternalLink size={14} /> Join
                      </button>
                      <button 
                        className="btn-secondary flex items-center gap-1"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
                        onClick={() => {
                          const externalLink = `https://8x8.vc/vpaas-magic-cookie-df0279ea8bd9405fa9607ecfdca150ff/${call.room_name}`;
                          navigator.clipboard.writeText(externalLink);
                          toast.success('External Jitsi link copied! Share this with your client.');
                        }}
                        title="Copy External Meeting Link"
                      >
                        <Copy size={14} /> Copy Link
                      </button>
                      <button 
                        onClick={() => handleDeleteCall(call.id)} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', opacity: 0.8, cursor: 'pointer', marginLeft: '0.5rem' }} 
                        title="Delete Meeting"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No video calls match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Video Call Modal */}
      {showVideoModal && (
        <div className="notes-modal-overlay" onClick={resetModal}>
          <div className="notes-modal glass" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Video size={20} className="text-primary" /> Start Video Call</h3>
              <button onClick={resetModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            {generatedLink ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <h4 style={{ color: 'var(--success)', marginBottom: '1rem' }}>Meeting Scheduled Successfully!</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  The employees have been notified. Share this public link with any external clients:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <input type="text" readOnly value={`https://8x8.vc/vpaas-magic-cookie-df0279ea8bd9405fa9607ecfdca150ff/${generatedLink.split('/').pop()}`} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none' }} />
                  <button 
                    className="btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const externalLink = `https://8x8.vc/vpaas-magic-cookie-df0279ea8bd9405fa9607ecfdca150ff/${generatedLink.split('/').pop()}`;
                      navigator.clipboard.writeText(externalLink);
                      toast.success('External link copied!');
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                </div>
                <button className="btn-secondary mt-4" onClick={resetModal}>Close</button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                  Select an employee to start or schedule a video call.
                </p>
                
                <form onSubmit={handleStartVideoCall}>
                  {/* Call Type Toggle */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        checked={callType === 'instant'} 
                        onChange={() => setCallType('instant')} 
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>Start Instantly</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        checked={callType === 'scheduled'} 
                        onChange={() => setCallType('scheduled')} 
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      <span>Schedule for Later</span>
                    </label>
                  </div>

                  {/* Scheduled Inputs */}
                  {callType === 'scheduled' && (
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Date</label>
                        <input type="date" className="form-input" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Time</label>
                        <input type="time" className="form-input" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} required />
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Select Employees (Multiple allowed)</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  {employees.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>No employees found.</div>
                  ) : (
                    employees.map(emp => (
                      <label 
                        key={emp.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem', 
                          padding: '0.75rem 1rem', 
                          cursor: 'pointer', 
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedEmpIds.includes(emp.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmpIds([...selectedEmpIds, emp.id]);
                            } else {
                              setSelectedEmpIds(selectedEmpIds.filter(id => id !== emp.id));
                            }
                          }}
                          style={{ accentColor: 'var(--primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '0.95rem', fontWeight: selectedEmpIds.includes(emp.id) ? '600' : '400', color: selectedEmpIds.includes(emp.id) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {emp.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={resetModal} className="btn-close" style={{ margin: 0, padding: '0.6rem 1rem' }}>Cancel</button>
                    <button type="submit" disabled={isStartingCall || selectedEmpIds.length === 0} className="btn-primary" style={{ padding: '0.6rem 1rem' }}>
                      {isStartingCall ? 'Processing...' : callType === 'instant' ? 'Connect Now' : 'Schedule Meeting'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Meetings;
