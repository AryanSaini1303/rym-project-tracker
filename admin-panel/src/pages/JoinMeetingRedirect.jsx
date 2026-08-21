import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Video, XCircle } from 'lucide-react';

const JoinMeetingRedirect = () => {
  const { roomId } = useParams();
  const [status, setStatus] = useState('checking'); // checking, valid, invalid

  useEffect(() => {
    const checkRoom = async () => {
      try {
        const { data, error } = await supabase
          .from('video_calls')
          .select('id')
          .eq('room_name', roomId)
          .single();

        if (error || !data) {
          setStatus('invalid');
        } else {
          setStatus('valid');
          // Room is valid, redirect to Jitsi
          window.location.href = `https://8x8.vc/vpaas-magic-cookie-df0279ea8bd9405fa9607ecfdca150ff/${roomId}`;
        }
      } catch (err) {
        setStatus('invalid');
      }
    };

    if (roomId) {
      checkRoom();
    } else {
      setStatus('invalid');
    }
  }, [roomId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#05070c', color: '#ffffff', fontFamily: 'inherit' }}>
      {status === 'checking' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ border: '4px solid rgba(0, 223, 162, 0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
          <p style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>Checking meeting validity...</p>
        </div>
      )}

      {status === 'valid' && (
        <div style={{ textAlign: 'center', animation: 'fadeIn 0.5s ease-out' }}>
          <Video size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Meeting Found!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting you to the video room...</p>
        </div>
      )}

      {status === 'invalid' && (
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '2rem', background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.2)', borderRadius: 'var(--radius-lg)' }}>
          <XCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem auto' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--danger)' }}>Meeting Invalid</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            This meeting is no longer valid or has been cancelled by the host. 
            Please contact the organizer if you believe this is a mistake.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        :root {
          --primary: #00dfa2;
          --danger: #ff3b30;
          --text-primary: #f8fafc;
          --text-secondary: #94a3b8;
          --radius-lg: 12px;
        }
      `}</style>
    </div>
  );
};

export default JoinMeetingRedirect;
