// Sign-in, magic link and Owner MFA screens (Phase 1, steps 12, 17 and 18), in the approved
// AI Studio look. Invite-only: there is no sign-up here, and a magic link is only sent to an
// existing account (the message is the same either way).
import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth/context';
import type { MfaEnrollment } from '../lib/auth/context';
import { DrishtiEye } from './DrishtiEye';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text flex items-center justify-center px-4 py-10">
      {/* Soft moving colour behind the card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="drishti-float absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div
          className="drishti-float absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-teal/15 blur-3xl"
          style={{ animationDelay: '-7s' }}
        />
        <div
          className="drishti-float absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-violet/10 blur-3xl"
          style={{ animationDelay: '-3s' }}
        />
      </div>

      <div className="drishti-rise relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <DrishtiEye />
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-text">Drishti</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Clear sight on every client</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Shree QA Solutions CRM
          </p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-border bg-surface/85 shadow-2xl backdrop-blur-xl">
          <div className="h-1 bg-linear-to-r from-primary via-violet to-teal" />
          <div className="p-7">{children}</div>
        </div>
        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5" />
          Invite-only · Owners use two-step sign-in
        </p>
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div
      className="min-h-screen bg-bg text-muted flex items-center justify-center text-sm"
      role="status"
    >
      Loading…
    </div>
  );
}

/** .env.local is missing or wrong. Shows the problem (never the key itself). */
export function ConfigProblem({ problem }: { problem: string }) {
  return (
    <Shell>
      <h2 className="text-sm font-semibold text-text">Supabase isn't configured</h2>
      <p role="alert" className="mt-2 text-xs text-danger">
        {problem}
      </p>
      <p className="mt-3 text-xs text-text-secondary">
        Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local, then restart the dev server.
      </p>
    </Shell>
  );
}

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-bg border border-border text-sm text-text placeholder:text-muted transition-shadow focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15';
const iconInputClass = `${inputClass} pl-10`;
const buttonClass =
  'w-full min-h-[46px] flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-linear-to-r from-primary-strong to-violet text-on-primary font-semibold text-sm shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0';
const fieldIcon = 'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted';

export function LoginPage() {
  const { state, signIn, sendMagicLink } = useAuth();
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const notice = message ?? (state.status === 'signed-out' ? state.notice : undefined);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setInfo(null);
    if (mode === 'link') {
      setInfo(await sendMagicLink(email));
      setBusy(false);
      return;
    }
    const result = await signIn(email, password);
    // On success this page is replaced by the app; only a failure needs showing.
    if (result !== null) {
      setMessage(result);
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h2 className="font-display text-lg font-semibold text-text">Sign in</h2>
      <p className="mt-1 text-xs text-muted">
        {mode === 'password'
          ? 'Use the email and password from your invitation.'
          : 'We’ll email you a one-time sign-in link.'}
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label
            htmlFor="login-email"
            className="block text-text-secondary font-medium text-xs mb-1"
          >
            Email
          </label>
          <div className="relative">
            <Mail className={fieldIcon} />
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={iconInputClass}
            />
          </div>
        </div>
        {mode === 'password' && (
          <div>
            <label
              htmlFor="login-password"
              className="block text-text-secondary font-medium text-xs mb-1"
            >
              Password
            </label>
            <div className="relative">
              <Lock className={fieldIcon} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${iconInputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-text"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <p role="alert" className="min-h-[1rem] text-xs text-danger">
          {notice ?? ''}
        </p>
        {info && (
          <p role="status" className="text-xs text-success">
            {info}
          </p>
        )}

        <button type="submit" disabled={busy} className={buttonClass}>
          {mode === 'password' ? <LogIn size={16} /> : <Mail size={16} />}
          {busy
            ? mode === 'password'
              ? 'Signing in…'
              : 'Sending…'
            : mode === 'password'
              ? 'Sign in'
              : 'Email me a sign-in link'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'password' ? 'link' : 'password');
          setMessage(null);
          setInfo(null);
        }}
        className="mt-4 w-full text-center text-xs font-medium text-primary hover:underline"
      >
        {mode === 'password'
          ? 'Sign in with an email link instead'
          : 'Sign in with a password instead'}
      </button>
    </Shell>
  );
}

/** Owners must set up and use an authenticator app before any data loads (PRD §8). */
export function MfaScreen({ mode }: { mode: 'enroll' | 'verify' }) {
  const { startMfaEnrollment, verifyMfa, signOut } = useAuth();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'enroll') return;
    let live = true;
    void startMfaEnrollment().then((r) => {
      if (!live) return;
      if (typeof r === 'string') setMessage(r);
      else setEnrollment(r);
    });
    return () => {
      live = false;
    };
  }, [mode, startMfaEnrollment]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await verifyMfa(code, enrollment?.factorId);
    if (result !== null) {
      setMessage(result);
      setCode('');
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <ShieldCheck className="h-4 w-4 text-primary" />
        {mode === 'enroll' ? 'Set up two-step sign-in' : 'Two-step sign-in'}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {mode === 'enroll'
          ? 'Owners need an authenticator app (Microsoft Authenticator, Google Authenticator…). Scan the code, then enter the 6 digits it shows.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      {mode === 'enroll' && enrollment && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <img
            src={enrollment.qrCode}
            alt="QR code for your authenticator app"
            className="h-44 w-44 rounded-lg bg-surface p-2"
          />
          <details className="text-[11px] text-muted">
            <summary className="cursor-pointer">Can’t scan? Enter this key instead</summary>
            <code className="mt-1 block break-all font-mono text-text-secondary">
              {enrollment.secret}
            </code>
          </details>
        </div>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="mfa-code" className="block text-text-secondary font-medium text-xs mb-1">
            6-digit code
          </label>
          <input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} font-mono tracking-widest text-center`}
          />
        </div>
        <p role="alert" className="min-h-[1rem] text-xs text-danger">
          {message ?? ''}
        </p>
        <button
          type="submit"
          disabled={busy || (mode === 'enroll' && !enrollment)}
          className={buttonClass}
        >
          <KeyRound size={16} />
          {busy ? 'Checking…' : 'Verify'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-4 w-full text-center text-xs font-medium text-muted hover:underline"
      >
        Sign out
      </button>
    </Shell>
  );
}
