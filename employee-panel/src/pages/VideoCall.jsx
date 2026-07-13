import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Loader2, PhoneOff, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [empInfo, setEmpInfo] = useState({ name: 'Employee', email: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [participantRecordId, setParticipantRecordId] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Fetch actual employee name from employees table
        const { data } = await supabase
          .from('employees')
          .select('name')
          .eq('email', user.email)
          .single();

        setEmpInfo({
          name: data?.name || user.user_metadata?.full_name || 'Employee',
          email: user.email || ''
        });
      }
      setIsLoading(false);
    }
    init();
  }, []);

  const handleEndCall = () => {
    // Navigate back to the meetings log or dashboard
    navigate('/meetings');
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={36} />
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 80px)', width: '100%', position: 'relative' }}>
      {/* Top Bar for the call */}
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--glass-bg)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Internal Video Call</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => {
              const externalLink = `https://8x8.vc/vpaas-magic-cookie-df0279ea8bd9405fa9607ecfdca150ff/${roomId}`;
              navigator.clipboard.writeText(externalLink);
              toast.success('External invite link copied to clipboard!');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Copy size={18} /> Copy Invite Link
          </button>
          <button 
            onClick={handleEndCall}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <PhoneOff size={18} /> Leave Call & Return
          </button>
        </div>
      </div>

      {/* Jitsi Meeting Wrapper */}
      <div style={{ height: 'calc(100% - 65px)', width: '100%' }}>
        <JitsiMeeting
          domain="8x8.vc"
          roomName={`vpaas-magic-cookie-df0279ea8bd9405fa9607ecfdca150ff/${roomId}`}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableModeratorIndicator: true,
            startScreenSharing: true,
            enableEmailInStats: false
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_CHROME_EXTENSION_BANNER: false
          }}
          userInfo={{
            displayName: empInfo.name,
            email: empInfo.email
          }}
          onApiReady={(externalApi) => {
            externalApi.on('videoConferenceJoined', async () => {
              const { data, error } = await supabase.from('meeting_participants').insert([{
                room_name: roomId,
                participant_name: empInfo.name,
                participant_email: empInfo.email
              }]).select();
              if (data && data[0]) {
                setParticipantRecordId(data[0].id);
              }
            });

            externalApi.on('videoConferenceLeft', async () => {
              // We use state/ref to update left_at
              // However, React state inside this closure might be stale if we're not careful.
              // To handle this, we can just do a general update for the most recent record for this user in this room
              await supabase.from('meeting_participants')
                .update({ left_at: new Date().toISOString() })
                .eq('room_name', roomId)
                .eq('participant_email', empInfo.email)
                .is('left_at', null);
              navigate('/meetings');
            });
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
};

export default VideoCall;
