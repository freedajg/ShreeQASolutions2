import { useAuth } from './lib/auth/context';
import { AuthLoading, ConfigProblem, LoginPage, MfaScreen } from './components/LoginPage';
import { DrishtiApp } from './app/DrishtiApp';

// Sign-in gate: nothing of the app renders until the user's profile grants access, and an Owner
// has passed MFA (the database enforces the same rule: Owner access needs aal2).
export default function App() {
  const { state } = useAuth();

  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'not-configured') return <ConfigProblem problem={state.problem} />;
  if (state.status === 'signed-out') return <LoginPage />;
  if (state.status === 'mfa') return <MfaScreen mode={state.mode} />;

  // Keyed by user, so a different sign-in starts with fresh screen state.
  return <DrishtiApp key={state.user.id} />;
}
