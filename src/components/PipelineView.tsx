import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Kanban, Table as TableIcon, Search, AlertCircle, Clock, X } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { useSignedInUser } from '../lib/auth/context';
import { Lead, Stage, ServiceKind } from '../types';
import { PIPELINE_COLUMNS, type Engagement } from '../types/crm';
import {
  groupByPipelineStatus,
  isPipelineStatus,
  ownerText,
  type OwnerDisplay,
  type ValueDisplay,
} from '../lib/data/mappers';
import {
  useChangeEngagementStatus,
  useEngagementValues,
  useOwnerName,
  usePendingStatusChanges,
  usePipelineEngagements,
} from '../lib/data/hooks';
import { dataErrorMessage } from '../lib/data/errors';
import { LIST_MESSAGES, listState } from '../lib/data/listState';
import { useDialog } from '../lib/useDialog';
import { formatINR } from '../utils/currency';
import { formatStandardDate, getDaysAgo } from '../utils/dateUtils';
import { isFeatureEnabled } from '../lib/screens';

// Hidden until wired (src/lib/screens.ts). The email-draft buttons were removed in 2-b: the MVP
// draft dialog takes the old types, and drafts are rebuilt in Phase 5 (CLAUDE.md rule 4).
const showAddLead = isFeatureEnabled('addLead');
const showNeedsAttention = isFeatureEnabled('needsAttention');

// MVP rule, kept until the follow-up interval setting exists (step 16).
const QUIET_AFTER_DAYS = 7;

const dateOrDash = (date: string | null) => (date ? formatStandardDate(date) : '—');

/** Days since the last contact; null when no contact is recorded. */
const daysQuiet = (engagement: Engagement) =>
  engagement.lastContactedOn ? getDaysAgo(engagement.lastContactedOn) : null;

const isQuiet = (engagement: Engagement) => (daysQuiet(engagement) ?? 0) >= QUIET_AFTER_DAYS;

type OwnerName = (ownerId: string | null) => OwnerDisplay;

/**
 * A value in a table cell or the dialog (step 2-f): the amount, "—" when not recorded, nothing
 * while loading. Callers render no cell at all for a user without values access.
 */
const valueText = (shown: ValueDisplay) =>
  shown.state === 'amount' ? formatINR(shown.amount) : shown.state === 'empty' ? '—' : '';

const NO_ENGAGEMENTS: Engagement[] = [];

interface SortableEngagementCardProps {
  engagement: Engagement;
  /** Only an amount is shown on a card; empty, loading and hidden show no line. */
  value: ValueDisplay;
  ownerName: OwnerName;
  onOpenDetails: (engagement: Engagement) => void;
  /** A move is being saved: no second drag until it's done. */
  isSaving: boolean;
}

function EngagementCardItem({
  engagement,
  value,
  ownerName,
  onOpenDetails,
  isSaving,
}: SortableEngagementCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: engagement.id,
    data: { engagement },
    disabled: isSaving,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const owner = ownerName(engagement.ownerId);
  const quietDays = daysQuiet(engagement);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpenDetails(engagement)}
      className={`bg-raised border rounded-xl p-3.5 shadow-md cursor-grab active:cursor-grabbing select-none transition-all duration-150 space-y-2.5 ${
        isDragging
          ? 'opacity-40 border-primary'
          : 'border-line/18 hover:border-line/35 hover:shadow-lg'
      }`}
    >
      {/* Top row: Company name (15px semibold wrapping to 2 lines) & certification */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[15px] font-semibold text-text leading-tight line-clamp-2 min-w-0 flex-1">
          {engagement.client.name}
        </h4>
        {engagement.certificationType && (
          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-surface text-primary border border-primary/20 shrink-0">
            {engagement.certificationType}
          </span>
        )}
      </div>

      {/* Value, only when one is recorded and the user may see values (step 2-f) */}
      {value.state === 'amount' && (
        <div className="text-sm font-bold font-mono text-info tabular-nums">
          {formatINR(value.amount)}
        </div>
      )}

      {/* Bottom row: Owner avatar, contact name, status pill ONLY when in trouble */}
      <div className="pt-2 border-t border-line/10 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Owner names from team_members (step 2-e): nothing while loading, "—" for no or
              an unknown owner, never "?" */}
          <div
            title={owner.state === 'loading' ? undefined : owner.label}
            className={`w-5 h-5 rounded-full bg-surface border border-line/25 flex items-center justify-center text-[10px] font-bold shrink-0 ${
              owner.state === 'known' ? 'text-text' : 'text-muted'
            }`}
          >
            {owner.state === 'known' ? owner.label[0] : owner.state === 'loading' ? '' : '—'}
          </div>
          <span className="text-text-secondary text-[11px] truncate">
            {engagement.client.contactPerson ?? '—'}
          </span>
        </div>

        {showNeedsAttention && quietDays !== null && isQuiet(engagement) && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-warning/15 text-warning border border-warning/30 shrink-0 flex items-center gap-1">
            <Clock size={10} />
            <span>{quietDays}d quiet</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function PipelineView() {
  const { addLead } = useCrm();
  // The `pipeline` view (step 2-c); loading, error, empty and no-match states (step 2-g).
  const { data: loaded, error: loadError, refetch } = usePipelineEngagements();
  const ownerName = useOwnerName();
  // Values only from engagement_financials, and only for users with values access (step 2-f).
  const { canSeeValues, valueOf, totalOf } = useEngagementValues();

  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  // Why the database refused the last move; shown above the board until closed or the next drag.
  const [moveNotice, setMoveNotice] = useState<string | null>(null);

  const changeStatus = useChangeEngagementStatus((error) => setMoveNotice(dataErrorMessage(error)));
  // A move shows in its new column while it's saved and the board is read again; a refused
  // move stops being pending, so its card goes back by itself. Nothing is written to the cache.
  const pendingChanges = usePendingStatusChanges();

  const engagements = useMemo(() => {
    const movedTo = new Map(pendingChanges.map((c) => [c.engagementId, c.newStatus]));
    return (loaded ?? NO_ENGAGEMENTS).map((e) => {
      const status = movedTo.get(e.id);
      return status ? { ...e, status } : e;
    });
  }, [loaded, pendingChanges]);
  const savingIds = new Set(pendingChanges.map((c) => c.engagementId));

  // Sensors for dnd-kit
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Filter by company, contact or owner (only a known owner's name matches)
  const term = searchTerm.toLowerCase();
  const knownOwner = (ownerId: string | null) => {
    const shown = ownerName(ownerId);
    return shown.state === 'known' ? shown.label : '';
  };
  const filtered = engagements.filter(
    (e) =>
      e.client.name.toLowerCase().includes(term) ||
      (e.client.contactPerson ?? '').toLowerCase().includes(term) ||
      knownOwner(e.ownerId).toLowerCase().includes(term),
  );
  const columns = groupByPipelineStatus(filtered);
  // Board and table show only for 'rows'; every other state shows one line instead (step 2-g).
  const state = listState(
    { hasData: loaded !== undefined, error: loadError },
    filtered.length,
    engagements.length,
  );

  // Needs-attention: quiet for 7 days or more (no contact recorded = not counted)
  const quiet = engagements
    .filter(isQuiet)
    .sort((a, b) => (daysQuiet(b) ?? 0) - (daysQuiet(a) ?? 0));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const engagementId = active.id as string;
    const overId = over.id as string;

    // Dropped over a column container or another card in that column
    const target = isPipelineStatus(overId)
      ? overId
      : engagements.find((e) => e.id === overId)?.status;

    const dragged = engagements.find((e) => e.id === engagementId);
    if (target && isPipelineStatus(target) && dragged && dragged.status !== target) {
      setMoveNotice(null);
      changeStatus.mutate({ engagementId, newStatus: target });
    }
  };

  const selected = selectedId ? (engagements.find((e) => e.id === selectedId) ?? null) : null;
  const activeDragging = activeDragId ? engagements.find((e) => e.id === activeDragId) : null;
  const draggingValue = activeDragging ? valueOf(activeDragging.id) : null;
  // Focus, Esc and Tab for the details dialog (step 2-g).
  const detailsDialog = useDialog(selected !== null, () => setSelectedId(null));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Pipeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Sales Pipeline
            </h1>
            {loaded && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-tint/20 text-primary border border-primary-tint/30">
                {engagements.length} Open Deals
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Stage progression and follow-up rhythm for process certification prospects.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Toggle View */}
          <div className="flex items-center bg-surface p-1 rounded-xl border border-line/16">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'board'
                  ? 'bg-raised text-text font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              <Kanban size={14} />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-raised text-text font-semibold'
                  : 'text-muted hover:text-text'
              }`}
            >
              <TableIcon size={14} />
              <span>Table</span>
            </button>
          </div>

          {showAddLead && (
            <button
              onClick={() => setIsAddLeadOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-primary to-teal hover:from-primary-soft hover:to-info text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <Plus size={15} />
              <span>Add Lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Needs-Attention Chips (Single row reading Company · 11d scrolling sideways) */}
      {showNeedsAttention && quiet.length > 0 && (
        <div className="bg-surface border border-line/16 rounded-2xl p-3 flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-bold text-warning shrink-0 pl-1">
            <AlertCircle size={15} />
            <span>Needs Attention:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {quiet.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-medium bg-raised hover:bg-warning/10 text-text border border-warning/30 hover:border-warning transition-colors flex items-center gap-1.5"
              >
                <span className="font-semibold">{e.client.name}</span>
                <span className="text-warning font-mono">· {daysQuiet(e)}d quiet</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter pipeline by company, contact, or owner..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface border border-line/16 text-sm text-text placeholder-muted focus:outline-none focus:border-primary"
        />
      </div>

      {/* Not read yet, the first read failed, nothing to show, or nothing matches (step 2-g).
          Try again puts the query back to loading, so the loading line shows again. */}
      {state === 'loading' && (
        <p role="status" className="text-xs text-muted">
          {LIST_MESSAGES.pipelineLoading}
        </p>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-3 text-xs">
          <p role="alert" className="text-danger">
            {dataErrorMessage(loadError)}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-3 py-1.5 rounded-lg bg-surface border border-line/16 text-text-secondary hover:text-text"
          >
            {LIST_MESSAGES.tryAgain}
          </button>
        </div>
      )}
      {state === 'empty' && <p className="text-xs text-muted">{LIST_MESSAGES.pipelineEmpty}</p>}
      {state === 'no-match' && (
        <div className="flex items-center gap-3 text-xs">
          <p className="text-muted">{LIST_MESSAGES.pipelineNoMatch}</p>
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="px-3 py-1.5 rounded-lg bg-surface border border-line/16 text-text-secondary hover:text-text"
          >
            {LIST_MESSAGES.clearSearch}
          </button>
        </div>
      )}

      {/* Why the database refused the last move */}
      {moveNotice && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger"
        >
          <span>{moveNotice}</span>
          <button
            type="button"
            onClick={() => setMoveNotice(null)}
            aria-label="Close message"
            className="shrink-0 text-danger hover:text-text-strong"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* VIEW 1: KANBAN BOARD */}
      {state === 'rows' && viewMode === 'board' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-6">
            <div className="flex items-start gap-4 min-w-max pb-2">
              {PIPELINE_COLUMNS.map((status) => {
                const columnItems = columns[status];
                // null (nothing shown) without values access, while loading, or with none recorded
                const columnTotal = totalOf(columnItems);

                return (
                  <div
                    key={status}
                    id={`column-${status}`}
                    className="w-[300px] flex-shrink-0 bg-surface border border-line/16 rounded-2xl flex flex-col max-h-[75vh]"
                  >
                    {/* Column Header */}
                    <div className="p-3.5 border-b border-line/12 bg-raised/50 rounded-t-2xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-text">{status}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-raised text-text-secondary">
                            {columnItems.length}
                          </span>
                        </div>
                        {columnTotal !== null && (
                          <span className="text-[11px] font-mono text-muted tabular-nums">
                            {formatINR(columnTotal)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Column Body Cards List */}
                    <SortableContext
                      id={status}
                      items={columnItems.map((e) => e.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-[140px]">
                        {columnItems.length === 0 ? (
                          <div className="h-24 flex items-center justify-center border-2 border-dashed border-line/8 rounded-xl text-xs text-muted">
                            Drag deals here
                          </div>
                        ) : (
                          columnItems.map((engagement) => (
                            <EngagementCardItem
                              key={engagement.id}
                              engagement={engagement}
                              value={valueOf(engagement.id)}
                              ownerName={ownerName}
                              onOpenDetails={(e) => setSelectedId(e.id)}
                              isSaving={savingIds.has(engagement.id)}
                            />
                          ))
                        )}
                      </div>
                    </SortableContext>
                  </div>
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {activeDragging ? (
              <div className="w-[280px] bg-raised border-2 border-primary rounded-xl p-3.5 shadow-2xl space-y-2">
                <h4 className="text-[15px] font-semibold text-text line-clamp-2">
                  {activeDragging.client.name}
                </h4>
                {draggingValue?.state === 'amount' && (
                  <div className="text-sm font-bold font-mono text-info">
                    {formatINR(draggingValue.amount)}
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* VIEW 2: TABLE VIEW FOR EXCEL USERS */}
      {state === 'rows' && viewMode === 'table' && (
        <div className="bg-surface border border-line/16 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-raised text-text-secondary uppercase text-[10px] tracking-wider border-b border-line/12">
                <tr>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Standard</th>
                  <th className="px-4 py-3">Stage</th>
                  {/* No Value column at all without values access (step 2-f) */}
                  {canSeeValues && <th className="px-4 py-3">Value</th>}
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Last Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/8 text-text">
                {filtered.map((engagement) => {
                  const quietDays = daysQuiet(engagement);
                  return (
                    <tr
                      key={engagement.id}
                      onClick={() => setSelectedId(engagement.id)}
                      className="hover:bg-raised/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-sm">{engagement.client.name}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div>{engagement.client.contactPerson ?? '—'}</div>
                        {engagement.client.email && (
                          <div className="text-[10px] text-muted">{engagement.client.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {engagement.certificationType && (
                          <span className="px-2 py-0.5 rounded bg-raised text-primary font-mono">
                            {engagement.certificationType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-raised text-text-secondary">
                          {engagement.status}
                        </span>
                      </td>
                      {canSeeValues && (
                        <td className="px-4 py-3 font-mono font-bold text-info tabular-nums">
                          {valueText(valueOf(engagement.id))}
                        </td>
                      )}
                      <td className="px-4 py-3 text-text-secondary">
                        {ownerText(ownerName(engagement.ownerId))}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {quietDays === null
                          ? '—'
                          : `${dateOrDash(engagement.lastContactedOn)} (${quietDays}d ago)`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ENGAGEMENT DETAILS DIALOG */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-backdrop/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedId(null)}
        >
          <div
            {...detailsDialog.panelProps}
            className="bg-surface border border-line/22 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="p-5 border-b border-line/14 bg-raised/60 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id={detailsDialog.titleId} className="text-lg font-bold text-text">
                    {selected.client.name}
                  </h3>
                  {selected.certificationType && (
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-raised text-primary border border-primary/20">
                      {selected.certificationType}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Source: {selected.leadSource ?? '—'} · Owner:{' '}
                  {ownerText(ownerName(selected.ownerId))}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-muted hover:text-text-strong bg-raised"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Dialog Content */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Core Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-bg p-3.5 rounded-xl border border-line/10">
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">
                    Contact Person
                  </span>
                  <span className="text-text font-medium text-xs">
                    {selected.client.contactPerson ?? '—'}
                  </span>
                </div>
                {/* No Deal Value block at all without values access (step 2-f) */}
                {canSeeValues && (
                  <div>
                    <span className="text-muted block text-[10px] uppercase font-semibold">
                      Deal Value
                    </span>
                    <span className="text-info font-bold font-mono text-xs">
                      {valueText(valueOf(selected.id))}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">
                    Current Stage
                  </span>
                  {/* Plain text until 2-c2 (after the demo) adds a status list that calls
                      change_engagement_status(), including In Progress and Closed. */}
                  <span className="text-text font-semibold text-xs">{selected.status}</span>
                </div>
                <div>
                  <span className="text-muted block text-[10px] uppercase font-semibold">
                    Last Contact
                  </span>
                  <span className="text-text font-mono text-xs">
                    {dateOrDash(selected.lastContactedOn)}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div className="bg-raised/50 p-3.5 rounded-xl border border-line/12 space-y-1">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wider block">
                  Remarks
                </span>
                <p className="text-text leading-relaxed">{selected.remarks ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL (hidden: still the MVP form on the old browser store) */}
      {showAddLead && isAddLeadOpen && (
        <AddLeadModal
          onClose={() => setIsAddLeadOpen(false)}
          onAdd={(leadData) => {
            addLead(leadData);
            setIsAddLeadOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddLeadModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (lead: Omit<Lead, 'id'>) => void;
}) {
  // Hidden (feature addLead off); rebuilt on team_members later. Default owner: the signed-in
  // person, from their profile (step 2-e).
  const { fullName } = useSignedInUser();
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email] = useState('');
  const [phone] = useState('');
  const [source] = useState('External Marketing');
  const [stage] = useState<Stage>('New');
  const [value, setValue] = useState(500000);
  const [owner, setOwner] = useState(fullName);
  const [serviceInterest, setServiceInterest] = useState<ServiceKind>('ISO');
  const [meetingContext, setMeetingContext] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !contactName.trim()) return;

    onAdd({
      company: company.trim(),
      contactName: contactName.trim(),
      email: email.trim() || 'contact@' + company.toLowerCase().replace(/\s+/g, '') + '.in',
      phone: phone.trim() || '+91 98000 00000',
      source,
      stage,
      value: Number(value) || 500000,
      owner,
      serviceInterest,
      lastContactDate: new Date().toISOString().split('T')[0],
      nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      meetingContext:
        meetingContext.trim() ||
        `${owner} connected with ${contactName} regarding ${serviceInterest} certification.`,
      activity: [
        {
          at: new Date().toISOString(),
          note: `Lead created by ${owner}`,
          author: owner,
        },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-backdrop/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-line/22 rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line/12">
          <h3 className="font-bold text-base text-text">Add New Prospect / Lead</h3>
          <button onClick={onClose} className="text-muted hover:text-text-strong">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Company Name *
              </label>
              <input
                required
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Param Solutions Pvt Ltd"
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Contact Person *
              </label>
              <input
                required
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Rameshwar Gupta"
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Standard
              </label>
              <select
                value={serviceInterest}
                onChange={(e) => setServiceInterest(e.target.value as ServiceKind)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
              >
                <option value="ISO">ISO</option>
                <option value="CMMI">CMMI</option>
                <option value="IPA">IPA</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Deal Value (₹)
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text font-mono focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Owner
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
              >
                <option value="Ramesh">Ramesh</option>
                <option value="Pramila">Pramila</option>
                <option value="Mahesh">Mahesh</option>
                <option value="Sunita">Sunita</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
              Internal Meeting Context (3rd Person Note)
            </label>
            <textarea
              rows={2}
              value={meetingContext}
              onChange={(e) => setMeetingContext(e.target.value)}
              placeholder="e.g. Mahesh spoke with Ananya; they discussed ISMS audit scope for Bangalore DC."
              className="w-full p-2.5 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-text-secondary hover:text-text-strong"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-teal text-on-primary font-bold text-xs shadow-md"
            >
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
