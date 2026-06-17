export const triggerPushNotification = async (notifications) => {
  // Try to use environment variable for production, fallback to local admin panel dev server
  const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5173';
  
  try {
    const promises = notifications.map(notif => 
      fetch(`${apiUrl}/api/send-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: notif.user_id,
          title: notif.title,
          message: notif.message,
          link: notif.link
        })
      }).catch(() => {}) // Ignore fetch errors silently
    );
    
    await Promise.all(promises);
  } catch (e) {
    console.error('Failed to trigger push notification:', e);
  }
};
