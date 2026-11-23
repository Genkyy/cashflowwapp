import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project-id')
);

// Fallback dummy client if credentials not yet supplied in .env
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Returns current authenticated user or null
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  } catch (err) {
    console.warn('Supabase auth getUser error:', err);
    return null;
  }
}

/**
 * Subscribe to Supabase Realtime changes on a specific table
 * @param {string} tableName
 * @param {Function} onChange
 * @returns {Function} unsubscribe function
 */
export function subscribeToTable(tableName, onChange) {
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel(`public:${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => {
          if (typeof onChange === 'function') {
            onChange(payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error(`Gagal subscribe realtime ke tabel ${tableName}:`, err);
    return () => {};
  }
}

export default supabase;
