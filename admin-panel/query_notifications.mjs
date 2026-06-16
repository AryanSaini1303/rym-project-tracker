import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('notifications').select('*').is('user_id', null).limit(5).order('created_at', {ascending: false});
  console.log("Admin notifications:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}
run();
