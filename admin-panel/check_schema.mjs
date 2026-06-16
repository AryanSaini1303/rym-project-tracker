import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: t } = await supabase.from('tasks').select('*').limit(1);
  const { data: p } = await supabase.from('projects').select('*').limit(1);
  console.log("Tasks columns:", Object.keys(t[0] || {}));
  console.log("Projects columns:", Object.keys(p[0] || {}));
}
run();
