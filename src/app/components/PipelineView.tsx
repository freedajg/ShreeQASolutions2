import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, MessageSquare, Plus, Trophy } from 'lucide-react';
import {
  AppSettings,
  Client,
  Engagement,
  EngagementStatus,
  LeadSource,
  ServiceType,
  TeamMember,
} from '../types/crm';
import {
  canEditEngagement,
  canSeeEngagement,
  canViewContractValues,
  daysBetween,
  formatDateDDMMMYYYY,
  formatINR,
  isLeadQuiet,
} from '../utils/formatters';

interface PipelineViewProps {
  currentUser: TeamMember;
  referenceDate: string;
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  initialFilterHint?: string;
  onMoveStage: (engagementId: string, newStatus: EngagementStatus) => void;
  onOpenClient: (clientId: string, engagementId?: string) => void;
  onOpenAddLead: () => void;
}

const PIPELINE_COLUMNS: { status: EngagementStatus; title: string; subtitle: string }[] = [
  { status: 'Lead', title: 'Lead', subtitle: 'Initial discovery & follow-ups active' },
  { status: 'Proposal', title: 'Proposal', subtitle: 'Quote / scope shared with prospect' },
  { status: 'On Hold', title: 'On Hold', subtitle: 'Follow-ups paused' },
];

export const PipelineView: React.FC<PipelineViewProps> = ({
  currentUser,
  referenceDate,
  clientsById,
  engagements,
  membersById,
  settings,
  initialFilterHint,
  onMoveStage,
  onOpenClient,
  onOpenAddLead,
}) => {
  const [ownerFilter, setOwnerFilter] = useState<string>(
    initialFilterHint && initialFilterHint.startsWith('u-') ? initialFilterHint : 'all',
  );
  const [sourceFilter, setSourceFilter] = useState<string>(
    initialFilterHint && initialFilterHint.startsWith('source:')
      ? initialFilterHint.replace('source:', '')
      : 'all',
  );
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [quietOnly, setQuietOnly] = useState<boolean>(initialFilterHint === 'quiet');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const showFinancials = canViewContractValues(currentUser);
  const isMarketing = currentUser.role === 'Marketing';

  const pipelineCards = useMemo(() => {
    return engagements.filter((e) => {
      if (!canSeeEngagement(currentUser, e)) return false;
      if (e.status !== 'Lead' && e.status !== 'Proposal' && e.status !== 'On Hold') return false;
      const client = clientsById[e.clientId];
      if (!client) return false;
      if (ownerFilter === 'unassigned' && e.ownerId !== '') return false;
      if (ownerFilter !== 'all' && ownerFilter !== 'unassigned' && e.ownerId !== ownerFilter)
        return false;
      if (sourceFilter !== 'all' && client.leadSource !== sourceFilter) return false;
      if (serviceFilter !== 'all' && e.service !== serviceFilter) return false;
      if (quietOnly && !isLeadQuiet(e, referenceDate, settings.followUpIntervalDays)) return false;
      return true;
    });
  }, [
    engagements,
    currentUser,
    clientsById,
    ownerFilter,
    sourceFilter,
    serviceFilter,
    quietOnly,
    referenceDate,
    settings.followUpIntervalDays,
  ]);

  const handleDropOnColumn = (targetStatus: EngagementStatus) => {
    if (draggedId) {
      const target = engagements.find((e) => e.id === draggedId);
      if (target && canEditEngagement(currentUser, target) && target.status !== targetStatus) {
        onMoveStage(draggedId, targetStatus);
      }
    }
    setDraggedId(null);
    setDragOverStatus(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">Sales Pipeline</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Drag cards across stages or mark Won to move into Delivery. Delivery engagements never
            receive sales follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filter by owner"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
          >
            <option value="all">All Owners</option>
            <option value="unassigned">Unassigned Only</option>
            {Object.values(membersById)
              .filter((m) => m.role !== 'Marketing')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filter by lead source"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
          >
            <option value="all">All Lead Sources</option>
            {settings.leadSources.map((src: LeadSource) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            aria-label="Filter by certification"
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
          >
            <option value="all">All Services</option>
            {settings.services.map((s: ServiceType) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setQuietOnly((q) => !q)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              quietOnly
                ? 'border-warning-line bg-warning-wash text-warning'
                : 'border-border bg-surface text-text-secondary'
            }`}
          >
            Gone Quiet Only
          </button>

          <button
            type="button"
            onClick={onOpenAddLead}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong hover:bg-primary-strong px-3.5 py-1.5 text-xs font-medium text-on-primary transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Won Dropzone (FR-5: Moving a card to In Progress marks it as won and it leaves the board) */}
      {!isMarketing && draggedId && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverStatus('In Progress');
          }}
          onDragLeave={() => setDragOverStatus(null)}
          onDrop={() => handleDropOnColumn('In Progress')}
          className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
            dragOverStatus === 'In Progress'
              ? 'border-success-line bg-success-wash text-success'
              : 'border-border-strong bg-bg text-text-secondary'
          }`}
        >
          <div className="inline-flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-success" />
            <span>Drop here to Mark Won (moves to Delivery · In Progress)</span>
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {PIPELINE_COLUMNS.map((col) => {
          const cards = pipelineCards.filter((e) => e.status === col.status);
          const colValue = cards.reduce((sum, e) => sum + (e.contractValueINR || 0), 0);

          if (isMarketing && col.status === 'On Hold') {
            return (
              <div key={col.status} className="rounded-xl border border-border bg-bg/70 p-4">
                <div className="font-display text-sm font-semibold text-text">{col.title}</div>
                <p className="mt-2 text-xs text-muted">
                  Marketing role is scoped to active Leads & Proposals only (FR-9).
                </p>
              </div>
            );
          }

          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(col.status);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={() => handleDropOnColumn(col.status)}
              className={`rounded-xl border p-4 min-h-[380px] transition-colors ${
                dragOverStatus === col.status
                  ? 'border-primary-line bg-primary-wash'
                  : 'border-border bg-raised/60'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-start justify-between gap-2 pb-3 mb-3 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-text">{col.title}</h3>
                    <span className="font-mono text-xs text-muted tabular-nums">
                      ({cards.length})
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">{col.subtitle}</p>
                </div>
                {showFinancials && (
                  <div className="font-mono text-xs font-medium text-text-secondary tabular-nums">
                    {formatINR(colValue)}
                  </div>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-8 px-4 text-center text-xs text-muted">
                    No engagements in {col.title}.
                  </div>
                ) : (
                  cards.map((eng) => {
                    const client = clientsById[eng.clientId];
                    if (!client) return null;
                    const owner = eng.ownerId ? membersById[eng.ownerId] : null;
                    const quiet = isLeadQuiet(eng, referenceDate, settings.followUpIntervalDays);
                    const daysSince = eng.lastContactedDate
                      ? daysBetween(eng.lastContactedDate, referenceDate)
                      : null;
                    const editable = canEditEngagement(currentUser, eng);
                    const hasReplied = eng.emails.some((em) => Boolean(em.repliedAt));

                    return (
                      <div
                        key={eng.id}
                        draggable={editable}
                        onDragStart={() => setDraggedId(eng.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverStatus(null);
                        }}
                        className={`rounded-xl border bg-surface p-4 transition-colors ${
                          !owner ? 'border-danger-line' : 'border-border hover:border-border-strong'
                        } ${editable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        {/* Title */}
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenClient(client.id, eng.id)}
                            className="font-display text-sm font-semibold text-text hover:text-primary text-left"
                          >
                            {client.name}
                          </button>
                          {showFinancials ? (
                            <span className="font-mono text-xs font-semibold text-text tabular-nums shrink-0">
                              {formatINR(eng.contractValueINR)}
                            </span>
                          ) : (
                            <Lock
                              className="h-3.5 w-3.5 text-muted shrink-0"
                              aria-label="Contract value hidden"
                            />
                          )}
                        </div>

                        {/* Service & Source metadata (unboxed text) */}
                        <div className="mt-1 text-xs text-muted">
                          {eng.service} · {client.leadSource}
                        </div>

                        {/* Owner & Quiet / Missing Owner alerts */}
                        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted">Owner</span>
                            {owner ? (
                              <span className="font-medium text-text">{owner.name}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-danger">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>Needs Owner</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted">Last contact</span>
                            <span className="font-mono tabular-nums text-text-secondary">
                              {daysSince !== null ? `${daysSince}d ago` : 'Never'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted">Next follow-up</span>
                            <span className="font-mono tabular-nums text-text-secondary">
                              {eng.status === 'On Hold'
                                ? 'Paused'
                                : formatDateDDMMMYYYY(eng.nextFollowUpDate)}
                            </span>
                          </div>
                        </div>

                        {/* Status Indicators (Explicit text + icon, never hue-only) */}
                        {(quiet || hasReplied || !client.email) && (
                          <div className="mt-3 pt-2.5 border-t border-border flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium">
                            {quiet && eng.status !== 'On Hold' && !hasReplied && (
                              <span className="inline-flex items-center gap-1 text-warning">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Gone quiet</span>
                              </span>
                            )}
                            {hasReplied && (
                              <span className="inline-flex items-center gap-1 text-success">
                                <MessageSquare className="h-3 w-3" />
                                <span>Replied · sequence stopped</span>
                              </span>
                            )}
                            {!client.email && (
                              <span className="inline-flex items-center gap-1 text-danger">
                                <AlertTriangle className="h-3 w-3" />
                                <span>Missing email</span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Quick Stage Actions (keyboard & mobile friendly) */}
                        {editable && (
                          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2">
                            <select
                              value={eng.status}
                              onChange={(e) =>
                                onMoveStage(eng.id, e.target.value as EngagementStatus)
                              }
                              aria-label={`Change stage for ${client.name}`}
                              className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-text-secondary"
                            >
                              <option value="Lead">Stage: Lead</option>
                              <option value="Proposal">Stage: Proposal</option>
                              <option value="On Hold">Stage: On Hold</option>
                              {!isMarketing && (
                                <option value="In Progress">Mark Won (In Progress)</option>
                              )}
                              <option value="Closed">Close / Lost</option>
                            </select>

                            {!isMarketing && (
                              <button
                                type="button"
                                onClick={() => onMoveStage(eng.id, 'In Progress')}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-success hover:underline whitespace-nowrap"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Mark Won</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
