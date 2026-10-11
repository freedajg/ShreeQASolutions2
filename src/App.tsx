import React from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { useAuth } from './lib/auth/context';
import { isFeatureEnabled, isScreenEnabled, resolveScreen } from './lib/screens';
import { AuthLoading, ConfigProblem, LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { DrishtiView } from './components/DrishtiView';
import { DashboardView } from './components/DashboardView';
import { RenewalRadarView } from './components/RenewalRadarView';
import { PipelineView } from './components/PipelineView';
import { ClientsView } from './components/ClientsView';
import { ImportView } from './components/ImportView';
import { SettingsView } from './components/SettingsView';
import { EmailDraftModal } from './components/EmailDraftModal';

function MainAppContent() {
  const { activeTab, selectedDraftTarget, closeDraftModal } = useCrm();
  // Every role lands on Pipeline. A hidden screen (src/lib/screens.ts) is never mounted, so its
  // effects never run, even if something asks for it.
  const screen = resolveScreen(activeTab);
  const shows = (key: typeof screen) => screen === key && isScreenEnabled(key);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-primary/30 selection:text-text-strong">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Tab Content */}
      <main className="flex-1 w-full">
        {shows('drishti') && <DrishtiView />}
        {shows('dashboard') && <DashboardView />}
        {shows('radar') && <RenewalRadarView />}
        {shows('pipeline') && <PipelineView />}
        {shows('clients') && <ClientsView />}
        {shows('import') && <ImportView />}
        {shows('settings') && <SettingsView />}
      </main>

      {/* Draft Email Modal (hidden until Phase 5: owner's mailbox only) */}
      {isFeatureEnabled('emailDraft') && selectedDraftTarget && (
        <EmailDraftModal target={selectedDraftTarget} onClose={closeDraftModal} />
      )}
    </div>
  );
}

// Sign-in gate: nothing of the app renders until the user's profile grants access.
export default function App() {
  const { state } = useAuth();

  if (state.status === 'loading') return <AuthLoading />;
  if (state.status === 'not-configured') return <ConfigProblem problem={state.problem} />;
  if (state.status === 'signed-out') return <LoginPage />;

  // Keyed by user, so a different sign-in starts with fresh screen state.
  return (
    <CrmProvider key={state.user.id}>
      <MainAppContent />
    </CrmProvider>
  );
}
