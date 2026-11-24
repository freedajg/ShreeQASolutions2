// The signed-in app: the approved AI Studio layout (sidebar, top bar, screens) on top of
// Supabase. All data comes from loadCrmData(); every change goes through data/actions.ts and
// then reloads, so what the screens show is always what the database holds for this user.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase/client';
import { useAuth, useSignedInUser } from '../lib/auth/context';
import { useTheme } from '../lib/useTheme';
import { loadCrmData, type CrmData } from './data/load';
import * as act from './data/actions';
import type { AppView, Client, Engagement, EngagementStatus, Role, TeamMember } from './types/crm';
import {
  addDays,
  computeRenewalInfo,
  formatDateDDMMMYYYY,
  getStatusGroup,
  isLeadQuiet,
  todayIST,
} from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TodayView } from './components/TodayView';
import { DashboardView } from './components/DashboardView';
import { RenewalRadarView } from './components/RenewalRadarView';
import { PipelineView } from './components/PipelineView';
import { DeliveryView } from './components/DeliveryView';
import { ClientsView } from './components/ClientsView';
import { ExcelImportView } from './components/ExcelImportView';
import { SettingsView } from './components/SettingsView';
import { OmnichannelView } from './components/OmnichannelView';
import { InvoicingView } from './components/InvoicingView';
import { WebLeadIntakeView } from './components/WebLeadIntakeView';
import { DrishtiAssistantDrawer } from './components/DrishtiAssistantDrawer';
import { NewLeadModal } from './components/NewLeadModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ProfileOutlookModal } from './components/ProfileOutlookModal';
import { BulkEmailModal } from './components/BulkEmailModal';

/** Screens each role may open (the database is the real wall; this keeps the menu honest). */
function canOpen(view: AppView, user: TeamMember): boolean {
  if (user.role === 'Owner/Admin') return true;
  if (user.role === 'Marketing')
    return ['dashboard', 'pipeline', 'clients', 'webcapture'].includes(view);
  if (view === 'import' || view === 'settings') return false;
  if (view === 'invoicing') return user.canViewContractValues;
  return true;
}

export function DrishtiApp() {
  const me = useSignedInUser();
  const { signOut } = useAuth();
  const { preference, theme, setPreference } = useTheme();
  const queryClient = useQueryClient();
  const db = supabase!;

  const query = useQuery({
    queryKey: ['crm', me.id],
    queryFn: () => loadCrmData(db, me),
    staleTime: 30_000,
  });
  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['crm', me.id] }),
    [queryClient, me.id],
  );

  // The "test clock" (FR-10): Owners can look ahead and run the reminder engine for that day.
  const [clockOffset, setClockOffset] = useState(0);
  const referenceDate = addDays(todayIST(), clockOffset);

  const [activeView, setActiveView] = useState<AppView>(
    me.role === 'marketing' ? 'dashboard' : 'today',
  );
  const [viewFilterHint, setViewFilterHint] = useState<string | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [bulkClientIds, setBulkClientIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((prev) => (prev === message ? null : prev)), 4500);
  }, []);

  // Back from Microsoft's consent page (outlook-connect redirects to /?outlook=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outlook = params.get('outlook');
    if (!outlook) return;
    const messages: Record<string, string> = {
      connected: 'Your Outlook mailbox is connected.',
      'wrong-mailbox':
        'That Microsoft account is not your Drishti email. Sign in to Microsoft with your own mailbox.',
      expired: 'The Outlook connection took too long. Try again.',
      failed: 'Outlook could not be connected. Try again.',
    };
    queueMicrotask(() => showToast(messages[outlook] ?? messages.failed));
    window.history.replaceState({}, '', window.location.pathname);
  }, [showToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Runs a change, reloads, and shows the result (or the database's refusal) as a toast. */
  const run = useCallback(
    async (work: () => Promise<unknown>, success?: string) => {
      try {
        await work();
        await reload();
        if (success) showToast(success);
        return true;
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'That change could not be saved.');
        await reload();
        return false;
      }
    },
    [reload, showToast],
  );

  const data: CrmData | undefined = query.data;
  const team = useMemo(() => data?.team ?? [], [data]);
  const membersById = useMemo(() => Object.fromEntries(team.map((m) => [m.id, m])), [team]);
  const clients = useMemo(() => data?.clients ?? [], [data]);
  const engagements = useMemo(() => data?.engagements ?? [], [data]);
  const drafts = useMemo(() => data?.drafts ?? [], [data]);
  const clientsById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const engagementsById = useMemo(
    () => Object.fromEntries(engagements.map((e) => [e.id, e])),
    [engagements],
  );

  const currentUser: TeamMember = membersById[me.id] ?? {
    id: me.id,
    name: me.fullName,
    initials: me.fullName.slice(0, 2).toUpperCase(),
    title: me.role,
    role: ({ owner: 'Owner/Admin', consultant: 'Consultant', marketing: 'Marketing' } as const)[
      me.role
    ],
    email: '',
    bookingLink: '',
    outlookConnected: false,
    mfaEnabled: me.role === 'owner',
    active: true,
    canViewContractValues: me.canSeeValues,
  };

  const settings = data?.settings;

  const waitingDraftsCount = useMemo(
    () =>
      drafts.filter(
        (d) => d.status === 'waiting' || d.status === 'rescheduled' || d.status === 'failed',
      ).length,
    [drafts],
  );
  const overdueRenewalsCount = useMemo(
    () =>
      settings
        ? engagements.filter(
            (e) =>
              !e.archived &&
              getStatusGroup(e.status) === 'Active client' &&
              computeRenewalInfo(e, referenceDate, settings).bucket === 'Overdue',
          ).length
        : 0,
    [engagements, referenceDate, settings],
  );
  const quietLeadsCount = useMemo(
    () =>
      settings
        ? engagements.filter(
            (e) => !e.archived && isLeadQuiet(e, referenceDate, settings.followUpIntervalDays),
          ).length
        : 0,
    [engagements, referenceDate, settings],
  );

  if (query.isPending) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm"
        role="status"
      >
        Loading Drishti…
      </div>
    );
  }
  if (query.isError || !data || !settings) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-bg text-text text-sm">
        <p>Drishti couldn’t load your data. Check your connection.</p>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="rounded-lg bg-primary-strong px-4 py-2 text-on-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  const handleNavigate = (view: AppView, filterHint?: string) => {
    if (!canOpen(view, currentUser)) return;
    setViewFilterHint(filterHint);
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const handleOpenClient = (clientId: string, engagementId?: string) => {
    setSelectedClientId(clientId);
    setSelectedEngagementId(engagementId || null);
    setActiveView('clients');
  };

  const handleAdvanceClock = (days: number) => {
    const next = clockOffset + days;
    const asOf = addDays(todayIST(), next);
    setClockOffset(next);
    if (currentUser.role !== 'Owner/Admin') return;
    void run(async () => {
      const r = await act.runReminderEngine(db, asOf);
      showToast(
        `Reminder run for ${formatDateDDMMMYYYY(asOf)}: ${r.renewal} renewal and ${r.followUp} follow-up draft(s) created.`,
      );
    });
  };

  const handleSendDraft = (draftId: string, editedSubject?: string, editedBody?: string) => {
    void run(async () => {
      const res = await act.sendDrafts(db, [draftId], {
        [draftId]: { subject: editedSubject, body: editedBody },
      });
      const r = res.results[0];
      if (r?.status !== 'sent') throw new Error(r?.reason ?? 'The email was not sent.');
      showToast(
        res.testMode
          ? `Recorded as sent from ${r.from} (test mode: nothing was delivered).`
          : `Sent from ${r.from}.`,
      );
    });
  };

  const handleCreateRenewalDraft = (engagementId: string) => {
    const eng = engagementsById[engagementId];
    const client = eng && clientsById[eng.clientId];
    if (!eng || !client) return;
    const existing = drafts.find(
      (d) => d.engagementId === eng.id && (d.status === 'waiting' || d.status === 'rescheduled'),
    );
    if (existing) {
      setActiveView('today');
      showToast(`A draft for ${client.name} is already waiting in Today.`);
      return;
    }
    const owner = membersById[eng.ownerId];
    const renewal = computeRenewalInfo(eng, referenceDate, settings);
    const first =
      client.contactPerson.replace(/^(dr|mr|mrs|ms|prof|col)\.?\s+/i, '').split(' ')[0] || 'there';
    const when = formatDateDDMMMYYYY(renewal.dueDate || undefined);
    const event = renewal.eventKind.toLowerCase();
    const ask = owner?.bookingLink
      ? `If easier, pick a slot here: ${owner.bookingLink}`
      : 'Would Thursday 11:30 IST or Friday 15:00 IST suit you for 20 minutes?';
    void run(async () => {
      await act.createDraft(db, {
        engagementId,
        kind: 'renewal',
        reason: `${renewal.eventKind} ${renewal.bucket === 'Overdue' ? 'overdue since' : 'due'} ${when}`,
        subject: `${client.name} — ${eng.standardFramework || eng.service} ${event} planning`,
        body: `Hi ${first},\n\nYour ${eng.standardFramework || eng.service} ${event} ${renewal.bucket === 'Overdue' ? 'was due on' : 'falls on'} ${when}. I'd like to plan the audit window early so it doesn't affect your certification.\n\n${ask}\n\nRegards,\n${owner?.name ?? currentUser.name}`,
      });
      setActiveView('today');
    }, `Renewal email drafted for ${client.name}. Review it in Today.`);
  };

  const handleCreateLead = (input: act.NewLeadInput) =>
    run(() => act.createLead(db, input), 'Lead added to the Sales Pipeline.');

  const handleApplyProposal = (
    engagementId: string,
    changes: Parameters<typeof act.applyProposal>[2],
  ) => run(() => act.applyProposal(db, engagementId, changes), 'Applied and logged “via Drishti”.');

  const handleToggleChecklistItem = (engagementId: string, itemId: string) => {
    const item = engagementsById[engagementId]?.checklist?.find((c) => c.id === itemId);
    if (item) void run(() => act.updateDeliveryItem(db, itemId, item.done ? 'open' : 'done'));
  };

  const view = canOpen(activeView, currentUser) ? activeView : 'dashboard';

  return (
    <div className="min-h-screen flex bg-bg text-text">
      <Sidebar
        activeView={view}
        onSelectView={(v) => handleNavigate(v)}
        currentUser={currentUser}
        waitingDraftsCount={waitingDraftsCount}
        overdueRenewalsCount={overdueRenewalsCount}
        quietLeadsCount={quietLeadsCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeView={view}
          referenceDate={referenceDate}
          currentUser={currentUser}
          themePref={preference}
          resolvedTheme={theme}
          // The theme stays in this browser only (client answer, DECISIONS 22-Nov-2026).
          onChangeTheme={setPreference}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenProfile={() => setProfileModalOpen(true)}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onSignOut={() => void signOut()}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {view === 'today' && (
            <TodayView
              currentUser={currentUser}
              referenceDate={referenceDate}
              onAdvanceClock={handleAdvanceClock}
              drafts={drafts}
              clientsById={clientsById}
              engagementsById={engagementsById}
              membersById={membersById}
              settings={settings}
              onSendDraft={handleSendDraft}
              onSkipDraft={(id) => void run(() => act.skipDraft(db, id), 'Draft skipped.')}
              onRescheduleDraft={(id, date) =>
                void run(
                  () => act.rescheduleDraft(db, id, date),
                  `Draft rescheduled to ${formatDateDDMMMYYYY(date)}.`,
                )
              }
              onConnectOutlook={(memberId) =>
                memberId === me.id
                  ? void run(() => act.connectOutlook(db))
                  : showToast(
                      `${membersById[memberId]?.name ?? 'The owner'} must connect their own Outlook from their profile.`,
                    )
              }
              onOpenClient={handleOpenClient}
            />
          )}

          {view === 'dashboard' && (
            <DashboardView
              currentUser={currentUser}
              referenceDate={referenceDate}
              clients={clients}
              engagements={engagements}
              drafts={drafts}
              membersById={membersById}
              settings={settings}
              onNavigate={handleNavigate}
            />
          )}

          {view === 'radar' && (
            <RenewalRadarView
              currentUser={currentUser}
              referenceDate={referenceDate}
              clientsById={clientsById}
              engagements={engagements}
              membersById={membersById}
              settings={settings}
              initialBucketFilter={viewFilterHint}
              onOpenClient={handleOpenClient}
              onCreateRenewalDraft={handleCreateRenewalDraft}
              onAddNoteModal={(engId) => {
                const eng = engagementsById[engId];
                if (eng) handleOpenClient(eng.clientId, eng.id);
              }}
            />
          )}

          {view === 'pipeline' && (
            <PipelineView
              currentUser={currentUser}
              referenceDate={referenceDate}
              clientsById={clientsById}
              engagements={engagements}
              membersById={membersById}
              settings={settings}
              initialFilterHint={viewFilterHint}
              onMoveStage={(id, status: EngagementStatus) =>
                void run(
                  () => act.changeStatus(db, id, status),
                  status === 'In Progress'
                    ? 'Marked won and moved to Delivery.'
                    : `Moved to ${status}.`,
                )
              }
              onOpenClient={handleOpenClient}
              onOpenAddLead={() => setNewLeadModalOpen(true)}
            />
          )}

          {view === 'outreach' && (
            <OmnichannelView
              clients={clients}
              clientsById={clientsById}
              engagements={engagements}
              membersById={membersById}
              whatsappThreads={data.whatsapp}
              voiceCalls={data.voiceCalls}
              onSendWhatsApp={(clientId, engagementId, template, text) =>
                void run(
                  () =>
                    act.queueWhatsApp(
                      db,
                      clientId,
                      engagementId,
                      clientsById[clientId]?.phone ?? '',
                      template,
                      text,
                    ),
                  'WhatsApp message saved as queued. It goes out once a WhatsApp Business account is connected.',
                )
              }
              onLogCall={(call) => void run(() => act.logCall(db, call), 'Call logged.')}
            />
          )}

          {view === 'webcapture' && (
            <WebLeadIntakeView
              settings={settings}
              onSubmitWebLead={(payload) =>
                void run(
                  () => act.submitWebLead(db, payload),
                  `Lead added for ${payload.company}. It needs an owner.`,
                ).then((ok) => ok && setActiveView('pipeline'))
              }
            />
          )}

          {view === 'delivery' && (
            <DeliveryView
              currentUser={currentUser}
              clientsById={clientsById}
              engagements={engagements}
              membersById={membersById}
              onUpdateStatus={(id, status) =>
                void run(() => act.changeStatus(db, id, status), `Moved to ${status}.`)
              }
              onToggleChecklistItem={handleToggleChecklistItem}
              onUpdateGapStatus={(_engId, gapId, state) =>
                void run(() => act.updateDeliveryItem(db, gapId, state))
              }
              onUpdateDocStatus={(_engId, docId, status) =>
                void run(() => act.updateDeliveryItem(db, docId, status))
              }
              onAddItem={(engId, kind, label, detail) =>
                void run(
                  () => act.addDeliveryItem(db, engId, kind, label, detail),
                  'Added to the workroom.',
                )
              }
              onOpenClient={handleOpenClient}
              onAddNoteModal={(engId) => {
                const eng = engagementsById[engId];
                if (eng) handleOpenClient(eng.clientId, eng.id);
              }}
            />
          )}

          {view === 'clients' && (
            <ClientsView
              currentUser={currentUser}
              clients={clients}
              clientsById={clientsById}
              engagements={engagements}
              membersById={membersById}
              settings={settings}
              tags={data.tags}
              drafts={drafts}
              referenceDate={referenceDate}
              selectedClientId={selectedClientId}
              selectedEngagementId={selectedEngagementId}
              onSelectClient={(cId, eId) => {
                setSelectedClientId(cId);
                setSelectedEngagementId(eId || null);
              }}
              onUpdateClient={(clientId, patch: Partial<Client>) =>
                void run(() => act.updateClient(db, clientId, patch), 'Client saved.')
              }
              onUpdateEngagement={(engId, patch: Partial<Engagement>) =>
                void run(() => act.updateEngagement(db, engId, patch), 'Engagement saved.')
              }
              onToggleDoNotContact={(clientId) => {
                const c = clientsById[clientId];
                if (c)
                  void run(
                    () => act.updateClient(db, clientId, { doNotContact: !c.doNotContact }),
                    c.doNotContact
                      ? 'Do-not-contact cleared.'
                      : `Do-not-contact on for ${c.name}; follow-ups stop.`,
                  );
              }}
              onArchiveEngagement={(engId, archive) =>
                void run(
                  () => act.updateEngagement(db, engId, { archived: archive }),
                  archive ? 'Engagement archived.' : 'Engagement restored.',
                )
              }
              onAddNote={(engId, summary, nextStep, heldById) =>
                void run(
                  () => act.addNote(db, engId, summary, nextStep, heldById),
                  'Meeting note saved.',
                )
              }
              onSetClientTag={(clientId, tagId, on) =>
                void run(() => act.setClientTag(db, clientId, tagId, on))
              }
              onCreateTag={(name, tone) =>
                run(() => act.createTag(db, name, tone), `Tag “${name}” created.`)
              }
              onTagClients={(ids, tagId) =>
                void run(() => act.tagClients(db, ids, tagId), `Tagged ${ids.length} client(s).`)
              }
              onEmailClients={(ids) => setBulkClientIds(ids)}
              onOpenAddModal={() => setNewLeadModalOpen(true)}
              onExportToast={showToast}
            />
          )}

          {view === 'invoicing' && (
            <InvoicingView
              clientsById={clientsById}
              engagements={engagements}
              invoices={data.invoices}
              onCreateInvoice={(engId, amount, provider, invoiceNo) =>
                void run(
                  () => act.createInvoice(db, engId, amount, provider, invoiceNo),
                  `Invoice ${invoiceNo} saved as a draft.`,
                )
              }
              onSetInvoiceStatus={(id, status) =>
                void run(() => act.setInvoiceStatus(db, id, status), `Invoice marked ${status}.`)
              }
            />
          )}

          {view === 'import' && (
            <ExcelImportView
              currentUser={currentUser}
              importHistory={data.imports}
              team={team}
              existingClients={clients}
              settings={settings}
              onCommitImport={(fileName, rows, counts, flags) =>
                run(
                  () => act.commitImport(db, fileName, rows, counts, flags),
                  `Imported ${counts.accepted + counts.flagged} row(s).`,
                )
              }
            />
          )}

          {view === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              teamMembers={team}
              settings={settings}
              activityLog={data.activityLog}
              onUpdateM365={(patch) =>
                void run(() => act.updateSettings(db, patch), 'Microsoft 365 settings saved.')
              }
              onToggleOutlookConnection={(memberId) => {
                if (memberId !== me.id) {
                  showToast('Each person connects their own Outlook from their profile.');
                  return;
                }
                void run(
                  () =>
                    currentUser.outlookConnected
                      ? act.disconnectOutlook(db)
                      : act.connectOutlook(db),
                  currentUser.outlookConnected ? 'Outlook disconnected.' : undefined,
                );
              }}
              onChangeMemberRole={(memberId, role: Role) =>
                void run(
                  () => act.updateProfile(db, memberId, { role }),
                  `Role changed to ${role}.`,
                )
              }
              onToggleConsultantValueAccess={(memberId) =>
                void run(
                  () =>
                    act.updateProfile(db, memberId, {
                      canSeeValues: !membersById[memberId]?.canViewContractValues,
                    }),
                  'Contract-value access updated.',
                )
              }
              onToggleMemberActive={(memberId) => {
                const m = membersById[memberId];
                if (m)
                  void run(
                    () => act.setMemberActive(db, memberId, !m.active),
                    m.active ? `${m.name} deactivated (history kept).` : `${m.name} reactivated.`,
                  );
              }}
              onInviteMember={(name, email, role) =>
                void run(() => act.inviteMember(db, name, email, role), `Invite sent to ${email}.`)
              }
              onUpdateSettings={(patch) =>
                void run(() => act.updateSettings(db, patch), 'Settings saved.')
              }
              onUpdateCycle={(code, s, r) =>
                void run(() => act.updateCycle(db, code, s, r), `Cycle for ${code} saved.`)
              }
            />
          )}
        </main>
      </div>

      <DrishtiAssistantDrawer
        open={assistantOpen}
        onToggle={() => setAssistantOpen((o) => !o)}
        onClose={() => setAssistantOpen(false)}
        currentUser={currentUser}
        onAsk={(q) => act.askDrishti(db, q)}
        onApplyProposal={handleApplyProposal}
      />

      {commandOpen && (
        <CommandPaletteModal
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          currentUser={currentUser}
          clients={clients}
          engagements={engagements}
          onNavigate={(v) => handleNavigate(v)}
          onOpenClient={handleOpenClient}
        />
      )}

      <NewLeadModal
        open={newLeadModalOpen}
        onClose={() => setNewLeadModalOpen(false)}
        currentUser={currentUser}
        clients={clients}
        membersById={membersById}
        settings={settings}
        onCreate={handleCreateLead}
      />

      <ProfileOutlookModal
        key={currentUser.id}
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        settings={settings}
        onUpdateBookingLink={(bookingLink) =>
          void run(() => act.updateProfile(db, me.id, { bookingLink }), 'Booking link saved.')
        }
        onToggleOutlookConnection={() =>
          void run(
            () =>
              currentUser.outlookConnected ? act.disconnectOutlook(db) : act.connectOutlook(db),
            currentUser.outlookConnected ? 'Outlook disconnected.' : undefined,
          )
        }
      />

      {bulkClientIds && (
        <BulkEmailModal
          clientIds={bulkClientIds}
          currentUser={currentUser}
          clientsById={clientsById}
          engagements={engagements}
          membersById={membersById}
          settings={settings}
          onClose={() => setBulkClientIds(null)}
          onCreateBatch={(subject, body, summary, total) =>
            act.createBatch(db, subject, body, summary, total)
          }
          onCreateDraft={(d) => act.createDraft(db, d)}
          onSend={(ids) => act.sendDrafts(db, ids)}
          onDone={(message) => {
            setBulkClientIds(null);
            void reload();
            showToast(message);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[90vw] rounded-lg border border-border-strong bg-ink text-on-primary px-4 py-2.5 text-xs font-medium shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
