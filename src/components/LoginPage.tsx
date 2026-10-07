// Sign-in page, shown to everyone who isn't signed in (Phase 1, step 12). Invite-only: there is
// no sign-up and no password reset here. Magic link comes in step 17.
import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../lib/auth/context';
import { DrishtiFace } from './DrishtiFace';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-text font-sans flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <DrishtiFace state="idle" size="md" />
          <h1 className="mt-3 text-xl font-bold tracking-tight text-text">Drishti</h1>
          <p className="text-xs text-muted">Process Standards Consulting</p>
        </div>
        <div className="bg-surface border border-line/14 rounded-2xl shadow-2xl p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="min-h-screen bg-bg text-muted font-sans flex items-center justify-center text-sm">
      Loading…
    </div>
  );
}

/** .env.local is missing or wrong. Shows the problem (never the key itself). */
export function ConfigProblem({ problem }: { problem: string }) {
  return (
    <Shell>
      <h2 className="text-sm font-bold text-text">Supabase isn't configured for local use</h2>
      <p role="alert" className="mt-2 text-xs text-danger">
        {problem}
      </p>
      <p className="mt-3 text-xs text-text-secondary">
        Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart the dev server.
      </p>
    </Shell>
  );
}

export function LoginPage() {
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notice = message ?? (state.status === 'signed-out' ? state.notice : undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await signIn(email, password);
    // On success this page is replaced by the app; only a failure needs showing.
    if (result !== null) {
      setMessage(result);
      setPassword('');
      setBusy(false);
    }
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-xl bg-bg border border-line/14 text-sm text-text placeholder-muted focus:outline-none focus:border-primary';

  return (
    <Shell>
      <h2 className="text-sm font-bold text-text">Sign in</h2>
      <p className="mt-1 text-xs text-muted">Use the email and password from your invitation.</p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label
            htmlFor="login-email"
            className="block text-muted uppercase font-semibold text-[10px] mb-1"
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="login-password"
            className="block text-muted uppercase font-semibold text-[10px] mb-1"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        <p role="alert" className="min-h-[1rem] text-xs text-danger">
          {notice ?? ''}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-teal hover:from-primary-soft hover:to-info text-on-primary font-bold text-sm shadow-md transition-all disabled:opacity-60 disabled:cursor-wait"
        >
          <LogIn size={16} />
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Shell>
  );
}
