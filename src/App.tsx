import React from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
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

  return (
    <div className="min-h-screen bg-[#080c16] text-[#e9eefb] flex flex-col font-sans selection:bg-[#818cf8]/30 selection:text-white">
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

export default function App() {
  return (
    <CrmProvider>
      <MainAppContent />
    </CrmProvider>
  );
}
