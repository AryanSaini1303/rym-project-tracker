import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Search, Loader2, Video, ExternalLink, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './Meetings.css';

const Meetings = () => {
  const [videoCalls, setVideoCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const navigate = useNavigate();

  const fetchVideoCalls = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data: empData } = await supabase
      .from('employees')
      .select('id')
      .eq('email', user.email)
      .single();

    if (!empData) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('video_calls')
      .select(`
        id,
        room_name,
        status,
        created_at
      `)
      .eq('employee_id', empData.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVideoCalls(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVideoCalls();
  }, []);

  const filteredCalls = videoCalls.filter(call => 
    call.room_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <h1 className="page-title">My Video Calls</h1>
      <p className="page-subtitle">A log of all video meetings you have been invited to.</p>

      {/* Filter and Search */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div className="input-wrapper" style={{ width: '100%' }}>
          <Search className="input-icon" size={18} style={{ left: '0.85rem' }} />
          <input
            type="text"
            className="filter-input"
            placeholder="Search by room name..."
            style={{ width: '100%', paddingLeft: '2.5rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Meeting Link (Room)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <Loader2 className="spinner" size={24} style={{ margin: '0 auto' }} />
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
                    <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: '600' }}>
                      {call.room_name}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${call.status === 'active' ? 'in-progress' : 'completed'}`} style={{ textTransform: 'capitalize' }}>
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
                        <Video size={14} /> Join
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
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No video call invitations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Meetings;
