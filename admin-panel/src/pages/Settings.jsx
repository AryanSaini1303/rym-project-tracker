import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Bell, Shield, Moon, LogOut, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';

const Settings = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: 'Loading...',
    email: 'Loading...',
    phone: ''
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    slackAlerts: false,
    weeklyReports: true
  });

  const [darkMode, setDarkMode] = useState(false);

  // Load user information and theme status
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfile({
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          email: user.email,
          phone: user.phone || ''
        });
      }
    }
    
    loadUser();
    
    const activeTheme = document.documentElement.getAttribute('data-theme');
    setDarkMode(activeTheme === 'dark');
  }, []);

  const toggleNotification = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleTheme = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: profile.name }
    });
    if (!error) {
      await supabase
        .from('employees')
        .update({ name: profile.name })
        .eq('email', profile.email);
      toast.success('Profile updated successfully!');
    } else {
      toast.error('Error updating profile: ' + error.message);
    }
  };

  const handleSignOut = async () => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.95rem' }}>Are you sure you want to sign out?</p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button onClick={() => toast.dismiss(t.id)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.85rem', transition: 'all 0.2s' }}>Cancel</button>
          <button onClick={async () => {
            toast.dismiss(t.id);
            await supabase.auth.signOut();
            navigate('/login');
          }} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--danger)', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.2s' }}>Sign Out</button>
        </div>
      </div>
    ), { duration: 5000 });
  };


  return (
    <div>
      <div className="attendance-header">
        <div>
          <h1 className="page-title">System Settings</h1>
          <p className="page-subtitle">Configure system options, notifications, and profile details.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Shield color="var(--primary)" size={24} />
            <h3 style={{ margin: 0 }}>Admin Profile</h3>
          </div>
          
          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
              <input 
                type="text" 
                className="form-input-box" 
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
              <input 
                type="email" 
                className="form-input-box" 
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Phone Number</label>
              <input 
                type="text" 
                className="form-input-box" 
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }}>
              Update Profile Details
            </button>
          </form>
        </div>

        {/* Configurations Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Bell color="var(--secondary)" size={24} />
            <h3 style={{ margin: 0 }}>System Alerts</h3>
          </div>

          <div className="switch-container">
            <div className="switch-label-desc">
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Email Notifications</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Send alerts when leave requests are created.</span>
            </div>
            <div 
              className={`switch-toggle ${notifications.emailAlerts ? 'active' : ''}`}
              onClick={() => toggleNotification('emailAlerts')}
            ></div>
          </div>

          <div className="switch-container">
            <div className="switch-label-desc">
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Slack Integration</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Log checking alerts directly to #team-tracking.</span>
            </div>
            <div 
              className={`switch-toggle ${notifications.slackAlerts ? 'active' : ''}`}
              onClick={() => toggleNotification('slackAlerts')}
            ></div>
          </div>

          <div className="switch-container" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="switch-label-desc">
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Weekly Digest Reports</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Email PDF scorecards to managers on Sundays.</span>
            </div>
            <div 
              className={`switch-toggle ${notifications.weeklyReports ? 'active' : ''}`}
              onClick={() => toggleNotification('weeklyReports')}
            ></div>
          </div>

          <div className="switch-container" style={{ marginTop: 'auto' }}>
            <div className="switch-label-desc" style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', alignItems: 'center' }}>
              <Moon size={20} color="var(--text-secondary)" />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.92rem', display: 'block' }}>Dark Theme</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Switch layout coloring modes.</span>
              </div>
            </div>
            <div 
              className={`switch-toggle ${darkMode ? 'active' : ''}`}
              onClick={toggleTheme}
            ></div>
          </div>
        </div>
      </div>

      {/* Logout Row */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--danger)', borderLeft: '5px solid var(--danger)' }}>
        <div>
          <h4 style={{ color: 'var(--danger)', marginBottom: '0.2rem' }}>Danger Zone</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sign out of the RYM Admin application and end your session.</p>
        </div>
        <button 
          className="btn-primary" 
          style={{ backgroundColor: 'var(--danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          onClick={handleSignOut}
        >
          <LogOut size={16} /> Sign Out Session
        </button>
      </div>

    </div>
  );
};

export default Settings;
