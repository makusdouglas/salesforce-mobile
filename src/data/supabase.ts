import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (url === undefined || url.length === 0) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL. Copy .env.example to .env and fill it in.',
  );
}
if (anonKey === undefined || anonKey.length === 0) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill it in.',
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
