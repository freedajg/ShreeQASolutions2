import { describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEY, checkSupabaseConfig } from './config';

// Fake, unsigned JWTs built at run time (no key-shaped strings in the repo for Gitleaks to flag).
function fakeJwt(payload: Record<string, unknown>): string {
  const part = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(payload)}.fake-signature`;
}

const ANON = fakeJwt({ iss: 'supabase-demo', role: 'anon' });
const SERVICE = fakeJwt({ iss: 'supabase-demo', role: 'service_role' });
const LOCAL_URL = 'http://127.0.0.1:54321';

function problemOf(url: string | undefined, key: string | undefined): string | undefined {
  const result = checkSupabaseConfig(url, key);
  return result.ok ? undefined : result.problem;
}

describe('checkSupabaseConfig', () => {
  it('accepts the local stack with an anon key', () => {
    expect(checkSupabaseConfig(LOCAL_URL, ANON)).toEqual({
      ok: true,
      config: { url: LOCAL_URL, anonKey: ANON },
    });
    expect(checkSupabaseConfig('http://localhost:54321/', ` ${ANON} `)).toEqual({
      ok: true,
      config: { url: 'http://localhost:54321', anonKey: ANON },
    });
  });

  it('refuses a missing or blank URL or key', () => {
    expect(problemOf(undefined, ANON)).toMatch(/VITE_SUPABASE_URL is not set/);
    expect(problemOf('  ', ANON)).toMatch(/VITE_SUPABASE_URL is not set/);
    expect(problemOf(LOCAL_URL, undefined)).toMatch(/VITE_SUPABASE_ANON_KEY is not set/);
    expect(problemOf(LOCAL_URL, '')).toMatch(/VITE_SUPABASE_ANON_KEY is not set/);
  });

  it('refuses anything that is not the local stack', () => {
    expect(problemOf('https://abcdefgh.supabase.co', ANON)).toMatch(/local stack/);
    expect(problemOf('http://192.168.1.20:54321', ANON)).toMatch(/local stack/);
    expect(problemOf('http://127.0.0.1.example.com:54321', ANON)).toMatch(/local stack/);
    expect(problemOf('not a url', ANON)).toMatch(/not a valid URL/);
    expect(problemOf('ftp://127.0.0.1:54321', ANON)).toMatch(/http:\/\/ or https:\/\//);
  });

  it('refuses a service-role or secret key', () => {
    expect(problemOf(LOCAL_URL, SERVICE)).toMatch(/service-role key/);
    expect(problemOf(LOCAL_URL, 'sb_secret_fakefakefake')).toMatch(/secret key/);
  });

  it('refuses keys that are not anon JWTs', () => {
    expect(problemOf(LOCAL_URL, 'sb_publishable_fakefakefake')).toMatch(/not an anon key/);
    expect(problemOf(LOCAL_URL, fakeJwt({ role: 'authenticated' }))).toMatch(/not an anon key/);
    expect(problemOf(LOCAL_URL, 'a.b.c')).toMatch(/not an anon key/);
    expect(problemOf(LOCAL_URL, 'just-some-text')).toMatch(/not an anon key/);
  });

  it('never puts the key in a problem message', () => {
    for (const key of [SERVICE, 'sb_secret_fakefakefake', 'just-some-text']) {
      expect(problemOf(LOCAL_URL, key)).not.toContain(key);
    }
  });

  it('keeps the fixed session storage key the browser tests rely on', () => {
    expect(AUTH_STORAGE_KEY).toBe('drishti-auth');
  });
});
