import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Loader2, PhoneOff, Copy } from 'lucide-react';
import { supabaseAdmin } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [adminInfo, setAdminInfo] = useState({ name: 'Admin', email: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      if (user) {
        setAdminInfo({
          name: user.user_metadata?.full_name || 'Admin',
          email: user.email || ''
        });
      }
      setIsLoading(false);
    }
    init();
  }, []);

  const handleEndCall = async () => {
    // Optional: Update the database to mark the call as ended
    await supabaseAdmin
      .from('video_calls')
      .update({ status: 'ended' })
      .eq('room_name', roomId);

    navigate('/meetings'); // Or wherever you want them to return
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
            <PhoneOff size={18} /> End Call & Return
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
            displayName: adminInfo.name,
            email: adminInfo.email
          }}
          onApiReady={(externalApi) => {
            // You can attach events here if needed, like listening for participant joined
            // externalApi.addListener('videoConferenceLeft', handleEndCall);
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
