import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, title, message, link } = req.body;

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (!supabaseUrl || !supabaseKey || !vapidPublic || !vapidPrivate) {
      return res.status(500).json({ error: 'Missing environment variables for push' });
    }

    const vapidEmail = process.env.VITE_VAPID_EMAIL || 'mailto:contact@rym-grenergy.com';

    webpush.setVapidDetails(
      vapidEmail,
      vapidPublic,
      vapidPrivate
    );

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch subscriptions
    let query = supabase.from('push_subscriptions').select('*');
    if (userId === null) {
      // Send to all admins (userId is null)
      query = query.is('user_id', null);
    } else {
      // Send to specific user
      query = query.eq('user_id', userId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscriptions found for target user' });
    }

    const payload = JSON.stringify({
      title: title || 'New Notification',
      body: message || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      url: link || '/',
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription has expired or is no longer valid, remove it
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('Error sending push:', err);
        }
      }
    });

    await Promise.all(sendPromises);

    return res.status(200).json({ success: true, sentCount: subscriptions.length });
  } catch (error) {
    console.error('Push error:', error);
    return res.status(500).json({ error: error.message });
  }
}
