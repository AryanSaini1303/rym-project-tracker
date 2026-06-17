import React, { useState, useEffect, useRef } from 'react';
import { Bell, User, Settings as SettingsIcon, Image as ImageIcon, LogOut, Menu, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import CompleteProfileModal from './CompleteProfileModal';
import './Header.css';

const Header = ({ onMenuToggle, hasSidebarDot }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);

  const [profile, setProfile] = useState({
    id: null,
    name: 'Loading...',
    email: '',
    role: 'Employee',
    avatar: 'https://ui-avatars.com/api/?name=User&background=00dfa2&color=000',
    profileData: {}
  });

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('employees')
          .select('id, name, role, department')
          .eq('email', user.email)
          .single();

        if (!error && data) {
          setProfile({
            id: data.id,
            name: data.name,
            email: user.email,
            role: data.role + ' (' + data.department + ')',
            avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${data.name.replace(' ', '+')}&background=00dfa2&color=000`,
            profileData: user.user_metadata?.profile || {}
          });
          fetchNotifications(data.id);
        } else {
          setProfile({
            id: null,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            email: user.email,
            role: 'Employee',
            avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=User&background=00dfa2&color=000`,
            profileData: user.user_metadata?.profile || {}
          });
        }
      }
    }
    getProfile();

    // Close dropdown on outside click
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear input value so the same file can be selected again
    e.target.value = '';

    const uploadToastId = toast.loading('Uploading profile photo...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'RYM-Grenergy');
      formData.append('cloud_name', 'dhhcykoqa');

      const response = await fetch('https://api.cloudinary.com/v1_1/dhhcykoqa/image/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.secure_url) {
        const imageUrl = data.secure_url;
        
        setProfile(prev => ({ ...prev, avatar: imageUrl }));
        setShowProfileMenu(false);
        
        const { error: updateError } = await supabase.auth.updateUser({
          data: { avatar_url: imageUrl }
        });

        if (updateError) {
          console.error("Supabase Error:", updateError);
          toast.error('Failed to update profile database: ' + updateError.message, { id: uploadToastId, duration: 5000 });
          return;
        }
        
        toast.success('Profile photo updated successfully!', { id: uploadToastId });
      } else {
        console.error("Cloudinary Error:", data);
        toast.error('Cloudinary Error: ' + (data.error?.message || 'Unknown error'), { id: uploadToastId, duration: 8000 });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Network error during upload.', { id: uploadToastId });
    }
  };

  const fetchNotifications = async (employeeId) => {
    if (!employeeId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (!error && data) {
      setNotifications(data);
    }
  };

  const urlB64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async (userId) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) return;
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicVapidKey)
        });
      }

      if (subscription) {
        // Check if exists
        const { data: existing } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .eq('subscription->>endpoint', subscription.endpoint)
          .limit(1);
          
        if (!existing || existing.length === 0) {
           await supabase.from('push_subscriptions').insert([{
             user_id: userId,
             subscription: subscription
           }]);
        }
      }
    } catch (e) {
      console.error('Push registration failed:', e);
    }
  };

  const requestManualPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        if (profile.id) subscribeToPush(profile.id);
        toast.success('Notifications enabled successfully!');
      } else {
        toast.error('Notification permission ' + permission);
      }
    } else {
      toast.error('Notifications not supported by this browser');
    }
  };

  useEffect(() => {
    if (!profile.id) return;
    
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        subscribeToPush(profile.id);
      } else if (Notification.permission !== 'denied') {
        // We still request it automatically for desktop, but mobile will ignore it
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
          if (permission === 'granted') subscribeToPush(profile.id);
        });
      }
    }
    
    const sub = supabase
      .channel('public:emp_header_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
         fetchNotifications(profile.id);
         
         if (payload.eventType === 'INSERT' && payload.new && payload.new.user_id === profile.id) {
           if ('Notification' in window && Notification.permission === 'granted') {
             try {
               if (navigator.serviceWorker) {
                 navigator.serviceWorker.ready.then(registration => {
                   registration.showNotification(payload.new.title || 'New Alert', {
                     body: payload.new.message || '',
                     icon: '/pwa-192x192.png'
                   });
                 }).catch(() => {
                   new Notification(payload.new.title || 'New Alert', { body: payload.new.message || '' });
                 });
               } else {
                 new Notification(payload.new.title || 'New Alert', { body: payload.new.message || '' });
               }
             } catch (e) {
               new Notification(payload.new.title || 'New Alert', { body: payload.new.message || '' });
             }
           }
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [profile.id]);

  const handleNotificationClick = async (notif) => {
    setShowNotifications(false);
    
    // Mark as read
    if (!notif.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id);
        
      setNotifications(notifications.map(n => 
        n.id === notif.id ? { ...n, is_read: true } : n
      ));
    }
    
    // Redirect
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const markAllAsRead = async () => {
    if (!profile.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
      
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const requiredFields = ['gender', 'marital_status', 'dob', 'doj', 'aadhaar_card', 'blood_group', 'insurance', 'phone', 'emergency_contact', 'account_holder_name', 'bank_name', 'account_number', 'ifsc_code', 'branch', 'current_address', 'permanent_address'];
  const filledFields = requiredFields.filter(f => profile.profileData[f] && profile.profileData[f].trim() !== '').length;
  const completionPercent = Math.round((filledFields / requiredFields.length) * 100);

  return (
    <div className="header">
      {/* Hamburger - only visible on mobile */}
      <button className="header-hamburger" onClick={onMenuToggle} aria-label="Toggle menu" style={{ position: 'relative' }}>
        <Menu size={22} />
        {hasSidebarDot && <span className="notification-dot" style={{ top: 2, right: 2 }}></span>}
      </button>

      <div className="header-brand">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
          Welcome back, <span style={{ color: 'var(--primary)' }}>{profile.name}</span>!
        </h2>
      </div>
      
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        
        {notificationPermission === 'default' && (
          <button 
            onClick={requestManualPermission}
            className="btn-primary enable-push-btn"
            title="Enable Push Notifications"
          >
            <BellRing size={16} /> <span>Enable Alerts</span>
          </button>
        )}

        <div className="notification-wrapper" ref={dropdownRef}>
          <button className="icon-btn" onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={22} />
            {unreadCount > 0 && <span className="notification-dot"></span>}
          </button>
          
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button className="mark-all-read" onClick={markAllAsRead}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="no-notifications">No new notifications</div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="notification-title">{notif.title}</div>
                      <div className="notification-message">{notif.message}</div>
                      <div className="notification-time">
                        {new Date(notif.created_at).toLocaleDateString()} at {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="admin-profile" onClick={() => setShowProfileMenu(!showProfileMenu)} ref={profileDropdownRef} style={{ cursor: 'pointer', position: 'relative' }}>
          <img src={profile.avatar} alt="Avatar" className="avatar" />
          <div className="admin-info">
            <span className="admin-name">{profile.name}</span>
            <span className="admin-role">{profile.role}</span>
          </div>

          {showProfileMenu && (
            <div className="notification-dropdown" style={{ top: 'calc(100% + 10px)', right: 0, width: '220px' }}>
              <div className="notification-header" style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <img src={profile.avatar} alt="Avatar" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{profile.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{profile.role}</div>
                </div>
              </div>

              {/* Profile Completion Bar */}
              <div style={{ padding: '15px 15px 5px 15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Profile Completion</span>
                  <span style={{ color: completionPercent === 100 ? 'var(--success)' : 'var(--primary)', fontWeight: 600 }}>{completionPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ width: `${completionPercent}%`, height: '100%', background: completionPercent === 100 ? 'var(--success)' : 'var(--primary)', transition: 'width 0.5s ease' }}></div>
                </div>
                
                <button 
                  onClick={() => { setShowProfileMenu(false); setShowCompleteProfile(true); }}
                  style={{ width: '100%', padding: '8px', background: completionPercent === 100 ? 'rgba(16, 185, 129, 0.1)' : 'var(--primary)', color: completionPercent === 100 ? '#10b981' : '#fff', border: completionPercent === 100 ? '1px solid rgba(16, 185, 129, 0.2)' : 'none', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, transition: 'background 0.2s' }}
                >
                  {completionPercent === 100 ? 'View Profile' : 'Complete Profile'}
                </button>
              </div>

              <div style={{ padding: '10px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--surface-color)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <ImageIcon size={16} /> Update Photo
                </button>
                <button 
                  onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                  style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--surface-color)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <SettingsIcon size={16} /> Edit Profile Info
                </button>
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '5px 0' }}></div>
                <button 
                  onClick={async () => { setShowProfileMenu(false); await supabase.auth.signOut(); navigate('/login'); }}
                  style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleAvatarUpload} 
          />
        </div>
      </div>

      {showCompleteProfile && (
        <CompleteProfileModal 
          profile={profile}
          onClose={() => setShowCompleteProfile(false)}
          onProfileUpdated={(newProfileData) => {
            setProfile(prev => ({ ...prev, profileData: newProfileData }));
          }}
        />
      )}
    </div>
  );
};

export default Header;
