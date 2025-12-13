import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // It's okay for local development without keys; runtime code should handle missing config.
  console.warn('Supabase URL or ANON KEY missing. Supabase features will be disabled.');
}

export const supabaseConfigOk = Boolean(url && anonKey);
export const supabaseConfig = { url: url || null, anonKey: anonKey || null };

export const supabase = createClient(url || '', anonKey || '');
