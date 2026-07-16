import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, CheckCircle2, User, Settings as SettingsIcon, Image as ImageIcon, LogOut, Menu, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

const Header = ({ onMenuToggle, hasSidebarDot }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  
  const [adminUser, setAdminUser] = useState({
    name: 'Admin',
    email: '',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=00dfa2&color=000'
  });
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(
    'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    async function getSessionUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setAdminUser({
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          email: user.email,
          avatar: user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email.split('@')[0]}&background=00dfa2&color=000`
        });
      }
    }
    getSessionUser();
    fetchNotifications();

    // Close dropdowns on outside click
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
        
        setAdminUser(prev => ({ ...prev, avatar: imageUrl }));
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

  const fetchNotifications = async () => {
    // Admins see notifications where user_id is NULL (system-wide admin alerts)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .is('user_id', null)
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
        subscribeToPush(null);
        toast.success('Notifications enabled successfully!');
      } else {
        toast.error('Notification permission ' + permission);
      }
    } else {
      toast.error('Notifications not supported by this browser');
    }
  };

  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        subscribeToPush(null);
      } else if (Notification.permission !== 'denied') {
        // We still request it automatically for desktop, but mobile will ignore it
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
          if (permission === 'granted') subscribeToPush(null);
        });
      }
    }

    const sub = supabase
      .channel('public:admin_header_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (payload) => {
         fetchNotifications();
         
         if (payload.eventType === 'INSERT' && payload.new && payload.new.user_id === null) {
           if ('Notification' in window && Notification.permission === 'granted') {
             toast(`${payload.new.title || 'New Alert'}\n${payload.new.message || ''}`, {
               icon: '🔔',
               duration: 4000,
             });
           }
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, []);

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
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .is('user_id', null)
      .eq('is_read', false);
      
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      navigate(`/employees?search=${encodeURIComponent(searchTerm)}`);
      setSearchTerm('');
    }
  };

  return (
    <div className="header">
      {/* Hamburger - only visible on mobile */}
      <button className="header-hamburger" onClick={onMenuToggle} aria-label="Toggle menu" style={{ position: 'relative' }}>
        <Menu size={22} />
        {hasSidebarDot && <span className="notification-dot" style={{ top: 2, right: 2 }}></span>}
      </button>

      <div className="header-search">
        <Search size={18} color="var(--text-secondary)" />
        <input 
          type="text" 
          placeholder="Search employees, tasks, or leaves..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
      
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        
        {notificationPermission !== 'granted' && (
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
          <img src={adminUser.avatar} alt="Admin" className="avatar" />
          <div className="admin-info">
            <span className="admin-name">{adminUser.name}</span>
            <span className="admin-role">{adminUser.email ? 'Management' : 'Connecting...'}</span>
          </div>

          {showProfileMenu && (
            <div className="notification-dropdown" style={{ top: 'calc(100% + 10px)', right: 0, width: '220px' }}>
              <div className="notification-header" style={{ padding: '15px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <img src={adminUser.avatar} alt="Admin" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{adminUser.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{adminUser.email}</div>
                </div>
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
    </div>
  );
};

export default Header;

