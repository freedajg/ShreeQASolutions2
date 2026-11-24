// Shared helpers for Drishti's Edge Functions (Deno). Server secrets come only from Deno.env
// (CLAUDE.md rule 1); nothing here is ever sent to the browser.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The browser origin allowed to call these functions. Defaults to the local dev server.
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'http://localhost:3000';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  Vary: 'Origin',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** The server client: bypasses row rules. Use only after the caller's rights are checked. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/** A client that acts as the caller, so every read and write obeys the database row rules. */
export function userClient(req: Request): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}

export interface Caller {
  id: string;
  email: string;
  role: 'owner' | 'consultant' | 'marketing' | null;
  aal: string;
  fullName: string;
}

/** The signed-in caller, with their role as the database sees it (MFA rule included). */
export async function getCaller(req: Request): Promise<Caller | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  const { data: profile } = await admin
    .from('profiles')
    .select('role, active, full_name')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile || !profile.active) return null;
  const aal = String(payload.aal ?? 'aal1');
  // Same rule as app.current_app_role(): an Owner without MFA has no role.
  const role = profile.role === 'owner' && aal !== 'aal2' ? null : profile.role;
  return { id: data.user.id, email: data.user.email ?? '', role, aal, fullName: profile.full_name };
}

/** A scheduled call from pg_cron: its x-job-secret must equal the server-only server_jobs row. */
export async function isJobCall(req: Request, job: string): Promise<boolean> {
  const given = req.headers.get('x-job-secret') ?? '';
  if (given.length < 32) return false;
  const { data } = await adminClient()
    .from('server_jobs')
    .select('secret')
    .eq('name', job)
    .maybeSingle();
  return Boolean(data?.secret) && safeEqual(data!.secret, given);
}

/** Compares two secrets in constant time (no early exit that leaks how much matched). */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Encryption for stored Microsoft refresh tokens (AES-GCM, key from TOKEN_ENC_KEY, base64 32 bytes)
// ---------------------------------------------------------------------------
async function tokenKey(): Promise<CryptoKey> {
  const raw = Deno.env.get('TOKEN_ENC_KEY');
  if (!raw) throw new Error('TOKEN_ENC_KEY is not set');
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await tokenKey(),
    new TextEncoder().encode(text),
  );
  const out = new Uint8Array(iv.length + data.byteLength);
  out.set(iv);
  out.set(new Uint8Array(data), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decrypt(blob: string): Promise<string> {
  const bytes = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const data = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    await tokenKey(),
    bytes.slice(12),
  );
  return new TextDecoder().decode(data);
}

/** HMAC-signed state for the Outlook connect redirect, so a callback can't be forged. */
export async function sign(value: string): Promise<string> {
  const secret = Deno.env.get('TOKEN_ENC_KEY');
  if (!secret) throw new Error('TOKEN_ENC_KEY is not set');
  // A key of its own for signing, derived from the secret with a fixed label, so the
  // encryption key itself is never used as the HMAC key.
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`drishti-oauth-state:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, '');
}
