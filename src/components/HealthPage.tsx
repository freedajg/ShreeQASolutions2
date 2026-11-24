// /health (PLAN Phase 7): a quick check anyone can open, without signing in. It shows whether the
// app is configured and the Supabase Auth service answers. It reads no business data.
import { useEffect, useState } from 'react';
import { supabaseConfig } from '../lib/supabase/client';

type Check = { label: string; ok: boolean | null; detail: string };

export function HealthPage() {
  const [checks, setChecks] = useState<Check[]>([
    {
      label: 'Configuration',
      ok: supabaseConfig.ok,
      detail: supabaseConfig.ok ? 'Supabase URL and public key are set' : supabaseConfig.problem,
    },
    { label: 'Supabase Auth', ok: null, detail: 'Checking…' },
  ]);

  useEffect(() => {
    if (!supabaseConfig.ok) return;
    const { url, anonKey } = supabaseConfig.config;
    const started = performance.now();
    fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } })
      .then((r) => ({ ok: r.ok, detail: r.ok ? 'Answering' : `HTTP ${r.status}` }))
      .catch(() => ({ ok: false, detail: 'Not reachable' }))
      .then((res) =>
        setChecks((prev) => [
          prev[0],
          {
            label: 'Supabase Auth',
            ok: res.ok,
            detail: `${res.detail} (${Math.round(performance.now() - started)} ms)`,
          },
        ]),
      );
  }, []);

  const allOk = checks.every((c) => c.ok === true);
  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 space-y-3">
        <h1 className="font-display text-base font-semibold">Drishti health</h1>
        <ul className="space-y-2 text-sm" aria-live="polite">
          {checks.map((c) => (
            <li key={c.label} className="flex justify-between gap-3">
              <span>{c.label}</span>
              <span
                className={c.ok === null ? 'text-muted' : c.ok ? 'text-success' : 'text-danger'}
              >
                {c.detail}
              </span>
            </li>
          ))}
        </ul>
        <p role="status" className={allOk ? 'text-success text-xs' : 'text-muted text-xs'}>
          {allOk ? 'All checks pass.' : 'Waiting for all checks…'}
        </p>
      </div>
    </main>
  );
}
