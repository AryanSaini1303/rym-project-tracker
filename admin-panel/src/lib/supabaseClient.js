import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dummy-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'dummy-key';

// Auth client (uses anon key — for Google sign-in and session management)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin data client (uses anon key)
// Note: We cannot use the service role key in the browser. 
// RLS must be disabled on the database tables for the admin panel to read all data.
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// We cannot initialize a service role client here because the Supabase JS library
// will instantly throw a "Forbidden use of secret API key in browser" error upon page load.
// If you need service-role access, you must use standard `fetch()` directly to the REST API.
