export const triggerPushNotification = async (notifications) => {
  // Use relative path so it automatically works on the live Vercel domain
  const apiUrl = '';
  
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
