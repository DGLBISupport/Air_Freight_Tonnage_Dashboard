import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isValidUrl = (url: string) => {
  if (!url || url.includes('YOUR_SUPABASE')) return false;
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
};

// Create the client only if configuration is valid.
// Otherwise, export a proxy or null to prevent compile-time crashes.
export const supabase = isValidUrl(supabaseUrl) && supabaseAnonKey && !supabaseAnonKey.includes('YOUR_SUPABASE')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

