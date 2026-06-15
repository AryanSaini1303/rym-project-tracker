import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Bell, Moon, LogOut, CheckCircle, Loader2, Award } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import toast from 'react-hot-toast';
import CompleteProfileModal from '../components/CompleteProfileModal';
import './Settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: '',
    role: '',
    department: '',
    profileData: {}
  });

  const [darkMode, setDarkMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState(false);

  useEffect(() => {
    async function loadEmployee() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('email', user.email)
          .single();

        if (!error && data) {
          setEmployee(data);
          setProfile({
            name: data.name,
            email: data.email,
            phone: data.phone_number || '',
            avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${data.name.replace(' ', '+')}&background=00dfa2&color=000`,
            role: data.role + ' (' + data.department + ')',
            department: data.department,
            profileData: user.user_metadata?.profile || {}
          });
        }
      }
      setIsLoading(false);
    }
    
    loadEmployee();
    
    const activeTheme = document.documentElement.getAttribute('data-theme');
    setDarkMode(activeTheme === 'dark');
  }, []);

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
    if (!profile.name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }

    setIsSaving(true);

    // 1. Update user metadata in auth
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: profile.name }
    });

    if (authError) {
      toast.error('Error saving auth: ' + authError.message);
      setIsSaving(false);
      return;
    }

    // 2. Update employee record
    if (employee) {
      const { error: dbError } = await supabase
        .from('employees')
        .update({
          name: profile.name.trim(),
          phone_number: profile.phone.trim() || null
        })
        .eq('id', employee.id);

      if (dbError) {
        toast.error('Error saving database profile: ' + dbError.message);
      } else {
        toast.success('Profile updated successfully!');
      }
    }
    setIsSaving(false);
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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="spinner" size={36} />
      </div>
    );
  }

  const requiredFields = ['gender', 'marital_status', 'dob', 'doj', 'aadhaar_card', 'blood_group', 'insurance', 'phone', 'emergency_contact', 'account_holder_name', 'bank_name', 'account_number', 'ifsc_code', 'branch', 'current_address', 'permanent_address'];
  const filledFields = requiredFields.filter(f => profile.profileData[f] && profile.profileData[f].trim() !== '').length;
  const completionPercent = Math.round((filledFields / requiredFields.length) * 100);

  return (
    <div>
      <div className="attendance-header">
        <div>
          <h1 className="page-title">Profile Settings</h1>
          <p className="page-subtitle">Manage your personal profile details and system preferences.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="card">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Shield color="var(--primary)" size={24} />
            <h3 style={{ margin: 0 }}>My Profile</h3>
          </div>
          
          <form onSubmit={handleSaveProfile}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
              <input 
                type="text" 
                className="form-input-box" 
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
              <input 
                type="email" 
                className="form-input-box" 
                value={profile.email}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>Phone Number</label>
              <input 
                type="text" 
                className="form-input-box" 
                placeholder="e.g. +91 98765 43210"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={isSaving}>
              {isSaving ? 'Saving Updates...' : 'Update Profile Details'}
            </button>
          </form>

          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <Award color="var(--primary)" size={20} />
              <h4 style={{ margin: 0 }}>Advanced Profile Information</h4>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Profile Completion Rate</span>
              <span style={{ color: completionPercent === 100 ? 'var(--success)' : 'var(--primary)', fontWeight: 700 }}>{completionPercent}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ width: `${completionPercent}%`, height: '100%', background: completionPercent === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.5s ease' }}></div>
            </div>
            
            <button 
              onClick={() => setShowCompleteProfileModal(true)}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.borderColor = 'var(--primary)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'rgba(255,255,255,0.03)'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              {completionPercent === 100 ? 'View Advanced Profile' : 'Complete Your Profile (Bank & Address)'}
            </button>
          </div>
        </div>

        {/* Configurations Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <Moon color="var(--secondary)" size={24} />
            <h3 style={{ margin: 0 }}>Theme Options</h3>
          </div>

          <div className="switch-container" style={{ marginTop: '1rem' }}>
            <div className="switch-label-desc">
              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Dark Theme Layout</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Toggle dark/light background states.</span>
            </div>
            <div 
              className={`switch-toggle ${darkMode ? 'active' : ''}`}
              onClick={toggleTheme}
            ></div>
          </div>
        </div>
      </div>

      {/* Logout Row */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'var(--danger)', borderLeft: '5px solid var(--danger)', marginTop: '2rem' }}>
        <div>
          <h4 style={{ color: 'var(--danger)', marginBottom: '0.2rem' }}>Sign Out</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>End your active field employee session.</p>
        </div>
        <button 
          className="btn-primary" 
          style={{ backgroundColor: 'var(--danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          onClick={handleSignOut}
        >
          <LogOut size={16} /> Sign Out Session
        </button>
      </div>

      {showCompleteProfileModal && (
        <CompleteProfileModal 
          profile={profile}
          onClose={() => setShowCompleteProfileModal(false)}
          onProfileUpdated={(newProfileData) => {
            setProfile(prev => ({ ...prev, profileData: newProfileData }));
          }}
        />
      )}
    </div>
  );
};

export default Settings;
