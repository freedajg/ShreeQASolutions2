import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Mail,
  Send,
  SkipForward,
  X,
} from 'lucide-react';
import { AppSettings, Client, Engagement, FollowUpDraft, TeamMember } from '../types/crm';
import {
  addDays,
  canSendEmailForOwner,
  computeRenewalInfo,
  countWords,
  formatDateDDMMMYYYY,
  getStatusGroup,
  isLeadQuiet,
} from '../utils/formatters';

interface TodayViewProps {
  currentUser: TeamMember;
  referenceDate: string;
  onAdvanceClock: (days: number) => void;
  drafts: FollowUpDraft[];
  clientsById: Record<string, Client>;
  engagementsById: Record<string, Engagement>;
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  onSendDraft: (draftId: string, editedSubject?: string, editedBody?: string) => void;
  onSkipDraft: (draftId: string) => void;
  onRescheduleDraft: (draftId: string, newDate: string) => void;
  onConnectOutlook: (memberId: string) => void;
  /** Rewrites the draft in the owner's voice (Drishti); returns the new text or null. */
  onPolishDraft: (draftId: string) => Promise<{ subject: string; body: string } | null>;
  onOpenClient: (clientId: string, engagementId?: string) => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  currentUser,
  referenceDate,
  onAdvanceClock,
  drafts,
  clientsById,
  engagementsById,
  membersById,
  settings,
  onSendDraft,
  onSkipDraft,
  onRescheduleDraft,
  onConnectOutlook,
  onOpenClient,
  onPolishDraft,
}) => {
  const [polishing, setPolishing] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [showDigestPreview, setShowDigestPreview] = useState(false);

  const visibleDrafts = useMemo(() => {
    return drafts.filter((d) => {
      if (d.status !== 'waiting' && d.status !== 'failed' && d.status !== 'rescheduled')
        return false;
      if (currentUser.role === 'Consultant' && d.ownerId !== currentUser.id) return false;
      if (ownerFilter !== 'all' && d.ownerId !== ownerFilter) return false;
      return true;
    });
  }, [drafts, currentUser, ownerFilter]);

  // The chosen draft, or the first one when the choice is gone (sent, skipped, filtered out).
  const currentDraftId = visibleDrafts.some((d) => d.id === selectedDraftId)
    ? selectedDraftId
    : (visibleDrafts[0]?.id ?? null);

  const groupedByOwner = useMemo(() => {
    const groups: Record<string, FollowUpDraft[]> = {};
    visibleDrafts.forEach((d) => {
      if (!groups[d.ownerId]) groups[d.ownerId] = [];
      groups[d.ownerId].push(d);
    });
    return groups;
  }, [visibleDrafts]);

  const overdueRenewalsCount = useMemo(() => {
    return Object.values(engagementsById).filter((e) => {
      if (e.archived || getStatusGroup(e.status) !== 'Active client') return false;
      return computeRenewalInfo(e, referenceDate, settings).bucket === 'Overdue';
    }).length;
  }, [engagementsById, referenceDate, settings]);

  const quietLeadsCount = useMemo(() => {
    return Object.values(engagementsById).filter(
      (e) => !e.archived && isLeadQuiet(e, referenceDate, settings.followUpIntervalDays),
    ).length;
  }, [engagementsById, referenceDate, settings.followUpIntervalDays]);

  const sentTodayCount = useMemo(() => drafts.filter((d) => d.status === 'sent').length, [drafts]);

  const selectedDraft = visibleDrafts.find((d) => d.id === currentDraftId) || null;
  const selectedClient = selectedDraft ? clientsById[selectedDraft.clientId] : null;
  const selectedEng = selectedDraft ? engagementsById[selectedDraft.engagementId] : null;
  const selectedOwner = selectedDraft ? membersById[selectedDraft.ownerId] : null;

  const startEditing = () => {
    if (!selectedDraft) return;
    setEditSubject(selectedDraft.subject);
    setEditBody(selectedDraft.body);
    setIsEditing(true);
  };

  const ownerIdsWithDrafts = Object.keys(groupedByOwner);

  return (
    <div className="space-y-6">
      {/* Calm Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">Morning Approval Queue</h2>
          <p className="mt-0.5 text-sm text-muted">
            Review and send drafts from each Relationship Owner’s Outlook mailbox in the same client
            thread.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDigestPreview(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg transition-colors whitespace-nowrap"
          >
            <Mail className="h-3.5 w-3.5 text-muted" />
            <span>06:00 IST Digest</span>
          </button>

          <div className="inline-flex items-center rounded-lg border border-border bg-surface p-0.5">
            <span className="px-2.5 text-[11px] text-muted whitespace-nowrap">Clock:</span>
            <button
              type="button"
              onClick={() => onAdvanceClock(1)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-raised transition-colors"
            >
              +1d
            </button>
            <button
              type="button"
              onClick={() => onAdvanceClock(7)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-raised transition-colors"
            >
              +7d
            </button>
          </div>
        </div>
      </div>

      {/* Unified Horizontal Summary Bar (Mercury/Stripe style — single hairline container) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border rounded-xl border border-border bg-surface">
        <div className="p-4">
          <div className="text-xs text-muted">Drafts Waiting</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-text tabular-nums">
            {visibleDrafts.length}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">Sent This Session</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-success tabular-nums">
            {sentTodayCount}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">Overdue Renewals</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-danger tabular-nums">
            {overdueRenewalsCount}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-muted">Leads Gone Quiet</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-warning tabular-nums">
            {quietLeadsCount}
          </div>
        </div>
      </div>

      {/* Owner Filter */}
      {currentUser.role === 'Owner/Admin' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-raised p-1 border border-border">
            <button
              type="button"
              onClick={() => setOwnerFilter('all')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                ownerFilter === 'all'
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              All Owners ({visibleDrafts.length})
            </button>
            {Object.values(membersById)
              .filter((m) => m.role !== 'Marketing' && m.active)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOwnerFilter(m.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    ownerFilter === m.id
                      ? 'bg-surface text-text shadow-xs'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {m.name.split(' ')[0]}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Master-Detail Split Workspace */}
      {visibleDrafts.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h3 className="mt-3 font-display text-base font-semibold text-text">
            Queue Clear for {formatDateDDMMMYYYY(referenceDate)}
          </h3>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            All waiting follow-up and renewal drafts have been reviewed. Use the Clock controls
            above to simulate the next 06:00 IST engine run.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Rail: Grouped Queue List */}
          <div className="lg:col-span-5 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="divide-y divide-border">
              {ownerIdsWithDrafts.map((ownerId) => {
                const owner = membersById[ownerId];
                const items = groupedByOwner[ownerId];
                if (!owner) return null;

                return (
                  <div key={ownerId}>
                    <div className="flex items-center justify-between bg-bg/80 px-4 py-2 text-[11px] font-medium text-muted">
                      <span>
                        {owner.name} · {items.length}
                      </span>
                      {!owner.outlookConnected ? (
                        <button
                          type="button"
                          onClick={() => onConnectOutlook(owner.id)}
                          className="text-warning hover:underline font-medium"
                        >
                          Connect Outlook
                        </button>
                      ) : (
                        <span className="text-success">Outlook Ready</span>
                      )}
                    </div>

                    <div className="divide-y divide-border">
                      {items.map((d) => {
                        const c = clientsById[d.clientId];
                        const e = engagementsById[d.engagementId];
                        const isSelected = currentDraftId === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDraftId(d.id);
                              setIsEditing(false);
                              setRescheduleOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3.5 transition-colors ${
                              isSelected ? 'bg-primary-wash' : 'hover:bg-bg'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span
                                className={`font-medium ${
                                  d.kind === 'renewal' ? 'text-danger' : 'text-primary'
                                }`}
                              >
                                {d.kind === 'renewal' ? 'Renewal' : 'Follow-up'} · {e?.service}
                              </span>
                              <span className="text-muted">
                                {d.threadMode === 'reply' ? 'Same thread' : 'New thread'}
                              </span>
                            </div>
                            <div className="mt-1 font-medium text-sm text-text truncate">
                              {c?.name}
                            </div>
                            <div className="mt-0.5 text-xs text-muted truncate">
                              {d.triggerReason}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Pane: Focused Draft Inspector & Composer */}
          {selectedDraft && selectedClient && selectedEng && selectedOwner && (
            <div className="lg:col-span-7 rounded-xl border border-border bg-surface p-6 space-y-5">
              {/* Top Meta */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-border">
                <div>
                  <button
                    type="button"
                    onClick={() => onOpenClient(selectedClient.id, selectedEng.id)}
                    className="font-display text-lg font-semibold text-text hover:text-primary text-left"
                  >
                    {selectedClient.name}
                  </button>
                  <div className="mt-1 text-xs text-muted space-y-0.5">
                    <div>
                      To: <span className="text-text">{selectedClient.contactPerson}</span> (
                      {selectedClient.email || 'Missing email'})
                    </div>
                    <div>
                      From: <span className="font-mono text-text">{selectedOwner.email}</span> ·{' '}
                      {selectedDraft.threadMode === 'reply'
                        ? 'Replies in existing Outlook thread'
                        : 'Starts new thread'}
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono tabular-nums text-muted sm:text-right">
                  {countWords(isEditing ? editBody : selectedDraft.body)} / 110 words
                </div>
              </div>

              {/* Guardrail Banners */}
              {!selectedOwner.outlookConnected && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-warning-line bg-warning-wash p-3.5 text-xs text-warning">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">
                        {selectedOwner.name}’s Outlook is not connected.
                      </span>{' '}
                      Drishti will not send this from another person’s mailbox.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onConnectOutlook(selectedOwner.id)}
                    className="shrink-0 rounded-md bg-warning text-on-primary px-2.5 py-1 font-medium"
                  >
                    Connect Now
                  </button>
                </div>
              )}

              {!selectedClient.email && (
                <div className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-wash p-3.5 text-xs text-danger">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Client email (Col I) is missing. Open the client record to add an email before
                    sending.
                  </span>
                </div>
              )}

              {/* Subject & Body */}
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1">Subject</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1">
                      Body ({selectedOwner.name.split(' ')[0]}’s voice)
                    </label>
                    <textarea
                      rows={8}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm leading-relaxed text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-text">{selectedDraft.subject}</div>
                  <div className="whitespace-pre-line rounded-xl border border-border bg-bg/70 p-4 text-sm leading-relaxed text-text-secondary">
                    {selectedDraft.body}
                  </div>
                </div>
              )}

              {/* Reschedule inline control */}
              {rescheduleOpen && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg p-3">
                  <Clock className="h-4 w-4 text-muted" />
                  <span className="text-xs font-medium text-text-secondary">Reschedule to:</span>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (rescheduleDate) {
                        onRescheduleDraft(selectedDraft.id, rescheduleDate);
                        setRescheduleOpen(false);
                      }
                    }}
                    className="rounded-md bg-ink text-on-primary px-3 py-1 text-xs font-medium"
                  >
                    Save
                  </button>
                </div>
              )}

              {/* Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    // In test mode nothing is delivered, so a mailbox isn't needed to try it.
                    const canSend =
                      (settings.emailTestMode || selectedOwner.outlookConnected) &&
                      Boolean(selectedClient.email) &&
                      !selectedClient.doNotContact &&
                      canSendEmailForOwner(currentUser, selectedOwner.id);

                    return isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={!canSend}
                          onClick={() => {
                            onSendDraft(selectedDraft.id, editSubject, editBody);
                            setIsEditing(false);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong hover:bg-primary-strong disabled:opacity-45 disabled:cursor-not-allowed px-4 py-2 text-xs font-medium text-on-primary transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Save & Send via {selectedOwner.name.split(' ')[0]}</span>
                        </button>
                        <button
                          type="button"
                          disabled={polishing}
                          onClick={async () => {
                            setPolishing(true);
                            const text = await onPolishDraft(selectedDraft.id);
                            setPolishing(false);
                            if (text) {
                              setEditSubject(text.subject);
                              setEditBody(text.body);
                            }
                          }}
                          className="rounded-lg border border-primary-line px-3 py-2 text-xs font-medium text-primary disabled:opacity-50"
                        >
                          {polishing ? 'Rewriting…' : 'Improve with Drishti'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={!canSend}
                          onClick={() => onSendDraft(selectedDraft.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong hover:bg-primary-strong disabled:opacity-45 disabled:cursor-not-allowed px-4 py-2 text-xs font-medium text-on-primary transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Send from {selectedOwner.name}’s Outlook</span>
                        </button>
                        <button
                          type="button"
                          onClick={startEditing}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleOpen((r) => !r);
                      setRescheduleDate(addDays(referenceDate, 3));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>Reschedule</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkipDraft(selectedDraft.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    <span>Skip</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 06:00 IST Digest Preview Modal */}
      {showDigestPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowDigestPreview(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-raised"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="text-xs font-medium text-muted">Daily Morning Summary · 06:00 IST</div>
            <h3 className="mt-1 font-display text-lg font-semibold text-text">
              SQAS Briefing — {formatDateDDMMMYYYY(referenceDate)}
            </h3>
            <div className="mt-4 rounded-xl border border-border bg-bg p-4 text-sm text-text-secondary space-y-3">
              <p>Good morning {currentUser.name.split(' ')[0]},</p>
              <ul className="space-y-1.5 text-xs font-mono">
                <li>• Drafts waiting approval: {visibleDrafts.length}</li>
                <li>• Active renewals overdue: {overdueRenewalsCount}</li>
                <li>• Open leads gone quiet: {quietLeadsCount}</li>
              </ul>
              <p className="text-xs text-muted">
                Nothing is sent automatically. Open Today Queue to approve or skip.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
