// The one Supabase client for the browser. Null when .env.local is missing or wrong; the app
// then shows the problem from `supabaseConfig` instead of a login page.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { AUTH_STORAGE_KEY, checkSupabaseConfig } from './config';

/** The browser client, typed from the generated database types (`bun run db:types`). */
export type DrishtiClient = SupabaseClient<Database>;

export const supabaseConfig = checkSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// The session is kept in localStorage (supabase-js default) for the local demo; revisit before
// real data, together with MFA (DECISIONS 07-Oct-2026).
export const supabase: DrishtiClient | null = supabaseConfig.ok
  ? createClient<Database>(supabaseConfig.config.url, supabaseConfig.config.anonKey, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // magic-link and invite links sign in from the URL (step 17)
      },
    })
  : null;
