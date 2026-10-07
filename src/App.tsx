import React, { useEffect } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { useAuth, useSignedInUser } from './lib/auth/context';
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
  const { activeTab, setActiveTab, selectedDraftTarget, closeDraftModal } = useCrm();
  const user = useSignedInUser();

  // Landing tab: Marketing starts on Pipeline (its only data); everyone else on Drishti.
  useEffect(() => {
    if (user.role === 'marketing') setActiveTab('pipeline');
  }, [user.id, user.role, setActiveTab]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-primary/30 selection:text-text-strong">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Tab Content */}
      <main className="flex-1 w-full">
        {activeTab === 'drishti' && <DrishtiView />}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'radar' && <RenewalRadarView />}
        {activeTab === 'pipeline' && <PipelineView />}
        {activeTab === 'clients' && <ClientsView />}
        {activeTab === 'import' && <ImportView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Draft Email Modal */}
      {selectedDraftTarget && (
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
