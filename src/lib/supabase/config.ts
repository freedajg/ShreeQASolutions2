// Checks the Supabase URL and key from .env.local before the client is created (Phase 1, step 12).
// Allowed: the local stack, and the hosted dev project (dummy data only, https only;
// DECISIONS 24-Nov-2026). Any other host is refused, so a production project can't be pointed
// at by mistake from a developer's machine.
// Only the anon key (a JWT with role "anon") is accepted: a service-role or secret key in the
// browser would bypass every row-level security rule.

export type SupabaseConfig = { url: string; anonKey: string };
export type ConfigCheck = { ok: true; config: SupabaseConfig } | { ok: false; problem: string };

// Fixed name for the saved login session in localStorage (the browser tests look for it).
export const AUTH_STORAGE_KEY = 'drishti-auth';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
// The hosted dev project `drishti-crm` (dummy data only).
const DEV_PROJECT_HOSTS = new Set(['noyxpuzhyviqzhglakdo.supabase.co']);

/** The payload of a JWT, or undefined if `token` isn't one. Never verifies the signature. */
function jwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload: unknown = JSON.parse(atob(padded));
    return payload !== null && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Problems never include the key itself, so they're safe to show on screen. */
export function checkSupabaseConfig(
  url: string | undefined,
  anonKey: string | undefined,
): ConfigCheck {
  const cleanUrl = url?.trim() ?? '';
  const cleanKey = anonKey?.trim() ?? '';
  if (cleanUrl === '') return { ok: false, problem: 'VITE_SUPABASE_URL is not set.' };
  if (cleanKey === '') return { ok: false, problem: 'VITE_SUPABASE_ANON_KEY is not set.' };

  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    return { ok: false, problem: 'VITE_SUPABASE_URL is not a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, problem: 'VITE_SUPABASE_URL must start with http:// or https://.' };
  }
  const isDevProject = DEV_PROJECT_HOSTS.has(parsed.hostname) && parsed.protocol === 'https:';
  if (!LOCAL_HOSTS.has(parsed.hostname) && !isDevProject) {
    return {
      ok: false,
      problem:
        'VITE_SUPABASE_URL must point at the local stack (127.0.0.1 or localhost) or the Drishti dev project.',
    };
  }

  if (cleanKey.startsWith('sb_secret_')) {
    return { ok: false, problem: 'VITE_SUPABASE_ANON_KEY holds a secret key. Use the anon key.' };
  }
  const role = jwtPayload(cleanKey)?.role;
  if (role === 'service_role') {
    return {
      ok: false,
      problem: 'VITE_SUPABASE_ANON_KEY holds the service-role key. Use the anon key.',
    };
  }
  if (role !== 'anon') {
    return { ok: false, problem: 'VITE_SUPABASE_ANON_KEY is not an anon key.' };
  }

  return { ok: true, config: { url: parsed.origin, anonKey: cleanKey } };
}
