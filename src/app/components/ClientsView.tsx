import React, { useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  Download,
  Eye,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  StickyNote,
  Tag as TagIcon,
  X,
} from 'lucide-react';
import {
  AppSettings,
  Client,
  ClosedReason,
  Engagement,
  EngagementStatus,
  FollowUpDraft,
  Tag,
  TagTone,
  TeamMember,
} from '../types/crm';
import {
  canEditEngagement,
  canSeeEngagement,
  canViewContractValues,
  formatDateDDMMMYYYY,
  formatINR,
  formatTimestampIST,
  getStatusGroup,
  isLeadQuiet,
} from '../utils/formatters';

const TONE_CLASSES: Record<TagTone, string> = {
  neutral: 'border-border bg-raised text-text-secondary',
  primary: 'border-primary-line bg-primary-wash text-primary',
  success: 'border-success-line bg-success-wash text-success',
  warning: 'border-warning-line bg-warning-wash text-warning',
  danger: 'border-danger-line bg-danger-wash text-danger',
  info: 'border-primary-line bg-primary-wash text-info',
};

export const TagChip: React.FC<{ tag: Tag; onRemove?: () => void }> = ({ tag, onRemove }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TONE_CLASSES[tag.tone]}`}
  >
    {tag.name}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove tag ${tag.name}`}
        className="hover:opacity-70"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    )}
  </span>
);

const selectClass =
  'rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary';

interface ClientsViewProps {
  currentUser: TeamMember;
  clients: Client[];
  clientsById: Record<string, Client>;
  engagements: Engagement[];
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  selectedClientId: string | null;
  selectedEngagementId: string | null;
  onSelectClient: (clientId: string | null, engagementId?: string | null) => void;
  onUpdateClient: (clientId: string, patch: Partial<Client>, logAction: string) => void;
  onUpdateEngagement: (engId: string, patch: Partial<Engagement>, logAction: string) => void;
  onToggleDoNotContact: (clientId: string) => void;
  onArchiveEngagement: (engId: string, archive: boolean) => void;
  onAddNote: (engId: string, summary: string, nextStep: string, heldById: string) => void;
  onOpenAddModal: () => void;
  onExportToast: (msg: string) => void;
  tags: Tag[];
  drafts: FollowUpDraft[];
  referenceDate: string;
  onSetClientTag: (clientId: string, tagId: string, on: boolean) => void;
  onCreateTag: (name: string, tone: TagTone) => Promise<boolean>;
  onTagClients: (clientIds: string[], tagId: string) => void;
  /** Opens the email composer for these clients (one or many). Sending needs a click on Send. */
  onEmailClients: (clientIds: string[]) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  currentUser,
  clients,
  clientsById,
  engagements,
  membersById,
  settings,
  selectedClientId,
  selectedEngagementId,
  onSelectClient,
  onUpdateClient,
  onUpdateEngagement,
  onToggleDoNotContact,
  onArchiveEngagement,
  onAddNote,
  onOpenAddModal,
  onExportToast,
  tags,
  drafts,
  referenceDate,
  onSetClientTag,
  onCreateTag,
  onTagClients,
  onEmailClients,
}) => {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [showClosedArchived, setShowClosedArchived] = useState(false);
  // Filters (FR-2 search + the tag and field filters asked for on 24-Nov-2026)
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagMatch, setTagMatch] = useState<'any' | 'all'>('any');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [contactFilter, setContactFilter] = useState<
    '' | 'has-email' | 'missing-email' | 'dnc' | 'quiet' | 'no-owner'
  >('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTagId, setBulkTagId] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagTone, setNewTagTone] = useState<TagTone>('primary');

  // Client 360 drawer local state
  const [detailTab, setDetailTab] = useState<'overview' | 'fields30' | 'emails' | 'notes'>(
    'overview',
  );
  const [showClicksForEmailId, setShowClicksForEmailId] = useState<string | null>(null);
  const [newNoteSummary, setNewNoteSummary] = useState('');
  const [newNoteNextStep, setNewNoteNextStep] = useState('');
  const [newNoteHeldBy, setNewNoteHeldBy] = useState(currentUser.id);
  // Editing belongs to one client + engagement; opening another one ends it.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const currentKey = `${selectedClientId}|${selectedEngagementId}`;
  const editingFields = editingKey === currentKey;
  const setEditingFields = (on: boolean) => setEditingKey(on ? currentKey : null);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSurveillanceDate, setEditSurveillanceDate] = useState('');
  const [editNextAuditDate, setEditNextAuditDate] = useState('');
  const [editCertValidTo, setEditCertValidTo] = useState('');
  const [editContractValue, setEditContractValue] = useState('');

  const isAdmin = currentUser.role === 'Owner/Admin';
  const isMarketing = currentUser.role === 'Marketing';
  const showFinancials = canViewContractValues(currentUser);

  const visibleEngagements = useMemo(() => {
    return engagements.filter((e) => {
      if (!canSeeEngagement(currentUser, e)) return false;
      if (!showClosedArchived && (e.status === 'Closed' || e.archived)) return false;
      if (groupFilter !== 'all' && getStatusGroup(e.status) !== groupFilter) return false;
      return true;
    });
  }, [engagements, currentUser, showClosedArchived, groupFilter]);

  const cities = useMemo(
    () =>
      [...new Set(clients.map((c) => c.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [clients],
  );
  const filtersActive =
    tagFilter.length > 0 ||
    Boolean(
      serviceFilter ||
      statusFilter ||
      ownerFilter ||
      cityFilter ||
      sourceFilter ||
      priorityFilter ||
      contactFilter,
    );

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!showClosedArchived && c.archived) return false;
      let clientEngs = visibleEngagements.filter((e) => e.clientId === c.id);
      // Engagement-level filters narrow which engagements count for this client.
      if (serviceFilter) clientEngs = clientEngs.filter((e) => e.service === serviceFilter);
      if (statusFilter) clientEngs = clientEngs.filter((e) => e.status === statusFilter);
      if (ownerFilter)
        clientEngs = clientEngs.filter((e) =>
          ownerFilter === 'none' ? !e.ownerId : e.ownerId === ownerFilter,
        );
      if (sourceFilter)
        clientEngs = clientEngs.filter((e) => (e.leadSource || c.leadSource) === sourceFilter);
      if (contactFilter === 'quiet')
        clientEngs = clientEngs.filter((e) =>
          isLeadQuiet(e, referenceDate, settings.followUpIntervalDays),
        );
      if (contactFilter === 'no-owner') clientEngs = clientEngs.filter((e) => !e.ownerId);
      const engFiltered = Boolean(
        serviceFilter ||
        statusFilter ||
        ownerFilter ||
        sourceFilter ||
        contactFilter === 'quiet' ||
        contactFilter === 'no-owner',
      );
      if (clientEngs.length === 0 && (isMarketing || groupFilter !== 'all' || engFiltered))
        return false;

      if (cityFilter && c.city !== cityFilter) return false;
      if (priorityFilter && c.rating !== priorityFilter) return false;
      if (contactFilter === 'has-email' && (!c.email || c.doNotContact)) return false;
      if (contactFilter === 'missing-email' && c.email) return false;
      if (contactFilter === 'dnc' && !c.doNotContact) return false;
      if (tagFilter.length > 0) {
        const ids = new Set(c.tags.map((t) => t.id));
        const ok =
          tagMatch === 'all'
            ? tagFilter.every((t) => ids.has(t))
            : tagFilter.some((t) => ids.has(t));
        if (!ok) return false;
      }
      if (!q) return true;

      const matchClient =
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.tags.some((t) => t.name.toLowerCase().includes(q));
      const matchEng = clientEngs.some(
        (e) =>
          e.service.toLowerCase().includes(q) ||
          e.standardFramework.toLowerCase().includes(q) ||
          (membersById[e.ownerId]?.name.toLowerCase().includes(q) ?? false),
      );
      return matchClient || matchEng;
    });
  }, [
    clients,
    visibleEngagements,
    search,
    isMarketing,
    groupFilter,
    membersById,
    showClosedArchived,
    serviceFilter,
    statusFilter,
    ownerFilter,
    sourceFilter,
    cityFilter,
    priorityFilter,
    contactFilter,
    tagFilter,
    tagMatch,
    referenceDate,
    settings.followUpIntervalDays,
  ]);

  const selectedVisible = filteredClients.filter((c) => selected.has(c.id));
  const allSelected =
    filteredClients.length > 0 && selectedVisible.length === filteredClients.length;
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filteredClients.map((c) => c.id)));
  const clearFilters = () => {
    setTagFilter([]);
    setServiceFilter('');
    setStatusFilter('');
    setOwnerFilter('');
    setCityFilter('');
    setSourceFilter('');
    setPriorityFilter('');
    setContactFilter('');
  };
  const waitingFor = (clientId: string) =>
    drafts.filter(
      (d) => d.clientId === clientId && (d.status === 'waiting' || d.status === 'rescheduled'),
    ).length;

  const activeClient = selectedClientId ? clientsById[selectedClientId] : null;
  const activeClientEngagements = useMemo(() => {
    if (!activeClient) return [];
    return engagements.filter(
      (e) => e.clientId === activeClient.id && canSeeEngagement(currentUser, e),
    );
  }, [activeClient, engagements, currentUser]);

  const focusedEngagement = useMemo(() => {
    if (activeClientEngagements.length === 0) return null;
    if (selectedEngagementId) {
      const found = activeClientEngagements.find((e) => e.id === selectedEngagementId);
      if (found) return found;
    }
    return activeClientEngagements[0];
  }, [activeClientEngagements, selectedEngagementId]);

  // Her 30-column layout as .xlsx: every live engagement this person may see (all groups,
  // including Closed), so it doubles as the weekly backup (DECISIONS 22-Nov-2026).
  const handleExportCSV = async () => {
    const { exportRows, exportWorkbook, downloadWorkbook } = await import('../data/exportExcel');
    const rows = exportRows(clientsById, engagements, membersById, showFinancials);
    const stamp = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    downloadWorkbook(exportWorkbook(rows), `SQAS_Client_Database_${stamp}.xlsx`);
    onExportToast(`Exported ${rows.length - 1} engagement(s) in the 30-column layout.`);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusedEngagement || !newNoteSummary.trim()) return;
    onAddNote(focusedEngagement.id, newNoteSummary.trim(), newNoteNextStep.trim(), newNoteHeldBy);
    setNewNoteSummary('');
    setNewNoteNextStep('');
  };

  const openInlineEdit = () => {
    if (!activeClient || !focusedEngagement) return;
    setEditEmail(activeClient.email);
    setEditPhone(activeClient.phone);
    setEditSurveillanceDate(focusedEngagement.surveillanceRenewalDueDate || '');
    setEditNextAuditDate(focusedEngagement.nextAuditReviewDate || '');
    setEditCertValidTo(focusedEngagement.certificateValidTo || '');
    setEditContractValue(
      focusedEngagement.contractValueINR !== undefined
        ? String(focusedEngagement.contractValueINR)
        : '',
    );
    setEditingFields(true);
  };

  const saveInlineEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !focusedEngagement) return;

    if (editEmail.trim() !== activeClient.email || editPhone.trim() !== activeClient.phone) {
      onUpdateClient(
        activeClient.id,
        { email: editEmail.trim(), phone: editPhone.trim() },
        `Updated contact details (Email/Phone)`,
      );
    }

    const parsedValue = editContractValue.trim() ? Number(editContractValue.trim()) : undefined;
    onUpdateEngagement(
      focusedEngagement.id,
      {
        surveillanceRenewalDueDate: editSurveillanceDate || undefined,
        nextAuditReviewDate: editNextAuditDate || undefined,
        certificateValidTo: editCertValidTo || undefined,
        ...(showFinancials ? { contractValueINR: parsedValue } : {}),
      },
      'Updated renewal dates / contract details',
    );
    setEditingFields(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-text">
            {isMarketing ? 'Leads Directory' : 'Clients & Engagements'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            One row per engagement, grouped under a single Client ID (Col A–AD). Nothing is
            hard-deleted; archived records can be restored.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isMarketing && (
            <button
              type="button"
              onClick={() => void handleExportCSV()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export to Excel</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong px-3.5 py-2 text-xs font-medium text-on-primary transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isMarketing ? 'Add Lead' : 'New Client / Engagement'}</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client, ID, contact, email, city, tag, certification, owner..."
              aria-label="Search clients"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isMarketing && (
              <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-raised p-1">
                {['all', 'Active client', 'Sales pipeline', 'Delivery', 'Paused'].map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setGroupFilter(grp)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      groupFilter === grp
                        ? 'bg-surface text-text shadow-xs'
                        : 'text-text-secondary hover:text-text'
                    }`}
                  >
                    {grp === 'all' ? 'All Groups' : grp}
                  </button>
                ))}
              </div>
            )}

            <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer ml-1">
              <input
                type="checkbox"
                checked={showClosedArchived}
                onChange={(e) => setShowClosedArchived(e.target.checked)}
                className="rounded border-border-strong"
              />
              <span>Show Closed / Archived</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by certification"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All certifications</option>
            {settings.services.map((sv) => (
              <option key={sv} value={sv}>
                {sv}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {(
              [
                'Lead',
                'Proposal',
                'On Hold',
                'In Progress',
                'Implemented',
                'Audit Completed',
                'Certified',
                'Renewal Due',
                'Completed',
                'Closed',
              ] as EngagementStatus[]
            ).map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by owner"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All owners</option>
            <option value="none">No owner</option>
            {Object.values(membersById)
              .filter((m) => m.role !== 'Marketing')
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
          <select
            aria-label="Filter by city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by lead source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All sources</option>
            {settings.leadSources.map((src) => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All priorities</option>
            {settings.ratings.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by contact status"
            value={contactFilter}
            onChange={(e) => setContactFilter(e.target.value as typeof contactFilter)}
            className={selectClass}
          >
            <option value="">Any contact status</option>
            <option value="has-email">Emailable (has email, not DNC)</option>
            <option value="missing-email">Missing email</option>
            <option value="dnc">Do not contact</option>
            <option value="quiet">Gone quiet</option>
            <option value="no-owner">No owner</option>
          </select>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
              <TagIcon className="h-3 w-3" /> Tags:
            </span>
            {tags.map((t) => {
              const on = tagFilter.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setTagFilter((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                  }
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    on ? TONE_CLASSES[t.tone] : 'border-border text-text-secondary hover:bg-raised'
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
            {tagFilter.length > 1 && (
              <select
                aria-label="Tag match"
                value={tagMatch}
                onChange={(e) => setTagMatch(e.target.value as 'any' | 'all')}
                className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-text"
              >
                <option value="any">match any</option>
                <option value="all">match all</option>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Bulk actions for the selection */}
      {selectedVisible.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary-line bg-primary-wash px-4 py-2.5 text-xs">
          <span className="font-semibold text-text">{selectedVisible.length} selected</span>
          {!isMarketing && (
            <button
              type="button"
              onClick={() => onEmailClients(selectedVisible.map((c) => c.id))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-strong px-3 py-1.5 font-medium text-on-primary"
            >
              <Mail className="h-3.5 w-3.5" />
              Email {selectedVisible.length === 1 ? 'client' : `${selectedVisible.length} clients`}
            </button>
          )}
          {!isMarketing && tags.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <select
                aria-label="Tag to add"
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
              >
                <option value="">Add tag…</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!bulkTagId}
                onClick={() => {
                  onTagClients(
                    selectedVisible.map((c) => c.id),
                    bulkTagId,
                  );
                  setBulkTagId('');
                }}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 font-medium text-text-secondary disabled:opacity-50"
              >
                Apply
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto font-medium text-text-secondary hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Master Client & Engagements Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium text-muted">
              <th className="py-3 pl-4 pr-1 w-8">
                <input
                  type="checkbox"
                  aria-label={
                    allSelected ? 'Clear selection' : `Select all ${filteredClients.length} clients`
                  }
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedVisible.length > 0 && !allSelected;
                  }}
                  onChange={toggleAll}
                  className="rounded border-border-strong"
                />
              </th>
              <th className="py-3 px-4">Client ID & Company</th>
              <th className="py-3 px-4">Primary Contact</th>
              <th className="py-3 px-4">Engagements (Status)</th>
              <th className="py-3 px-4">City · Source</th>
              {showFinancials && <th className="py-3 px-4 text-right">Total Value</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {filteredClients.length === 0 ? (
              <tr>
                <td
                  colSpan={showFinancials ? 6 : 5}
                  className="py-10 text-center text-xs text-muted"
                >
                  No clients match your search and filters.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const clientEngs = visibleEngagements.filter((e) => e.clientId === client.id);
                const totalVal = clientEngs.reduce((sum, e) => sum + (e.contractValueINR || 0), 0);
                const waiting = waitingFor(client.id);

                return (
                  <tr
                    key={client.id}
                    onClick={() => onSelectClient(client.id, clientEngs[0]?.id || null)}
                    className={`cursor-pointer transition-colors ${selected.has(client.id) ? 'bg-primary-wash' : 'hover:bg-bg/90'}`}
                  >
                    <td className="py-3.5 pl-4 pr-1 align-top" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${client.name}`}
                        checked={selected.has(client.id)}
                        onChange={() => toggleOne(client.id)}
                        className="rounded border-border-strong"
                      />
                    </td>
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted">
                          {client.code || '—'}
                        </span>
                        <span className="font-medium text-text">{client.name}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {client.industry || '—'} · Priority: {client.rating || '—'}
                        {client.doNotContact && (
                          <span className="text-danger font-medium"> · Do Not Contact</span>
                        )}
                        {waiting > 0 && (
                          <span className="text-primary font-medium">
                            {' '}
                            · {waiting} draft(s) waiting
                          </span>
                        )}
                      </div>
                      {client.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {client.tags.map((t) => (
                            <TagChip key={t.id} tag={t} />
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top text-xs">
                      <div className="font-medium text-text">{client.contactPerson || '—'}</div>
                      <div
                        className={`mt-0.5 ${client.email ? 'text-muted' : 'text-danger font-medium'}`}
                      >
                        {client.email || 'Missing email'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="space-y-1">
                        {clientEngs.map((eng) => {
                          const ownerName = eng.ownerId
                            ? membersById[eng.ownerId]?.name.split(' ')[0]
                            : 'Unassigned';
                          return (
                            <div key={eng.id} className="text-xs text-text-secondary">
                              <span className="font-medium text-text">
                                {eng.service || 'Service not set'}
                              </span>
                              <span className="text-muted"> · </span>
                              <span
                                className={
                                  eng.status === 'Renewal Due'
                                    ? 'text-danger font-medium'
                                    : eng.status === 'Certified'
                                      ? 'text-success font-medium'
                                      : 'text-text-secondary'
                                }
                              >
                                {eng.status || 'Needs review'}
                              </span>
                              <span className="text-muted"> · </span>
                              <span
                                className={eng.ownerId ? 'text-muted' : 'text-warning font-medium'}
                              >
                                {ownerName}
                              </span>
                              {eng.archived && <span className="text-warning"> (Archived)</span>}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 align-top text-xs text-text-secondary">
                      <div>{client.city || '—'}</div>
                      <div className="text-[11px] text-muted">{client.leadSource || '—'}</div>
                    </td>

                    {showFinancials && (
                      <td className="py-3.5 px-4 align-top text-right font-mono text-xs font-medium text-text tabular-nums">
                        {formatINR(totalVal)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Client 360° Slide-Over Detail Panel (§6.1, §6.2, FR-2, FR-8, FR-12) */}
      {activeClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-backdrop/50 backdrop-blur-[1px]">
          <div className="relative w-full max-w-3xl h-full bg-surface border-l border-border shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="font-mono">{activeClient.code || 'No Client ID'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeClient.industry}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeClient.city}</span>
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold text-text truncate">
                  {activeClient.name}
                </h3>
                <div className="mt-0.5 text-xs text-text-secondary">
                  {activeClient.contactPerson} ({activeClient.designation}) ·{' '}
                  {activeClient.email || (
                    <span className="text-danger font-medium">Missing Email</span>
                  )}{' '}
                  · {activeClient.phone || 'No phone'}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {activeClient.tags.map((t) => (
                    <TagChip
                      key={t.id}
                      tag={t}
                      onRemove={
                        isMarketing ? undefined : () => onSetClientTag(activeClient.id, t.id, false)
                      }
                    />
                  ))}
                  {!isMarketing && (
                    <select
                      aria-label="Add a tag"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onSetClientTag(activeClient.id, e.target.value, true);
                      }}
                      className="rounded-full border border-dashed border-border bg-surface px-2 py-0.5 text-[10px] text-text-secondary"
                    >
                      <option value="">+ Tag</option>
                      {tags
                        .filter((t) => !activeClient.tags.some((x) => x.id === t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  )}
                  {!isMarketing && (
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = newTagName.trim();
                        if (!name) return;
                        void onCreateTag(name, newTagTone).then((ok) => ok && setNewTagName(''));
                      }}
                    >
                      <input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        maxLength={40}
                        placeholder="New tag"
                        aria-label="New tag name"
                        className="w-24 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] text-text"
                      />
                      <select
                        aria-label="New tag colour"
                        value={newTagTone}
                        onChange={(e) => setNewTagTone(e.target.value as TagTone)}
                        className="rounded-full border border-border bg-surface px-1 py-0.5 text-[10px] text-text"
                      >
                        {(
                          [
                            'primary',
                            'success',
                            'warning',
                            'danger',
                            'info',
                            'neutral',
                          ] as TagTone[]
                        ).map((tone) => (
                          <option key={tone} value={tone}>
                            {tone}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        Create
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!isMarketing && (
                  <button
                    type="button"
                    disabled={!activeClient.email || activeClient.doNotContact}
                    title={
                      activeClient.doNotContact
                        ? 'Do not contact is on'
                        : !activeClient.email
                          ? 'Add an email address first'
                          : 'Write an email to this client'
                    }
                    onClick={() => onEmailClients([activeClient.id])}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-strong px-2.5 py-1.5 text-xs font-medium text-on-primary disabled:opacity-45"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onToggleDoNotContact(activeClient.id)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      activeClient.doNotContact
                        ? 'border-danger-line bg-danger-wash text-danger'
                        : 'border-border text-text-secondary hover:bg-bg'
                    }`}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>
                      {activeClient.doNotContact ? 'Do Not Contact Active' : 'Do Not Contact'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectClient(null, null)}
                  className="rounded-lg p-1.5 text-muted hover:bg-raised"
                  aria-label="Close client details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Engagement Selector Bar (§6.1: Multiple engagements under one client) */}
            {activeClientEngagements.length > 0 && (
              <div className="border-b border-border bg-bg px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-medium text-muted whitespace-nowrap">
                  Engagements ({activeClientEngagements.length}):
                </span>
                {activeClientEngagements.map((eng) => {
                  const active = focusedEngagement?.id === eng.id;
                  return (
                    <button
                      key={eng.id}
                      type="button"
                      onClick={() => onSelectClient(activeClient.id, eng.id)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-primary-strong text-on-primary'
                          : 'bg-surface border border-border text-text-secondary hover:bg-raised'
                      }`}
                    >
                      {eng.service} · {eng.status}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sub-navigation Tabs */}
            <div className="border-b border-border px-6 flex items-center gap-6">
              {[
                { id: 'overview', label: 'Overview & Status' },
                { id: 'fields30', label: '30-Column Excel Fields' },
                { id: 'notes', label: `Meeting Notes (${focusedEngagement?.notes.length || 0})` },
                { id: 'emails', label: `Email Thread (${focusedEngagement?.emails.length || 0})` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id as typeof detailTab)}
                  className={`py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    detailTab === t.id
                      ? 'border-primary-line text-primary'
                      : 'border-transparent text-muted hover:text-text'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!focusedEngagement ? (
                <p className="text-sm text-muted">
                  No accessible engagements for your role under this client.
                </p>
              ) : (
                <>
                  {detailTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Key Engagement Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">
                            Certification / Service Status (Col O)
                          </label>
                          <select
                            disabled={!canEditEngagement(currentUser, focusedEngagement)}
                            value={focusedEngagement.status}
                            onChange={(e) =>
                              onUpdateEngagement(
                                focusedEngagement.id,
                                { status: e.target.value as EngagementStatus },
                                `Changed status to ${e.target.value}`,
                              )
                            }
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text disabled:opacity-60"
                          >
                            {[
                              'Lead',
                              'Proposal',
                              'In Progress',
                              'Implemented',
                              'Audit Completed',
                              'Certified',
                              'Renewal Due',
                              'Completed',
                              'On Hold',
                              'Closed',
                            ].map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">
                            Relationship Owner (Col AA)
                          </label>
                          <select
                            disabled={!isAdmin}
                            value={focusedEngagement.ownerId}
                            onChange={(e) =>
                              onUpdateEngagement(
                                focusedEngagement.id,
                                { ownerId: e.target.value },
                                `Assigned owner to ${
                                  e.target.value ? membersById[e.target.value]?.name : 'Unassigned'
                                }`,
                              )
                            }
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text disabled:opacity-60"
                          >
                            <option value="">Unassigned</option>
                            {Object.values(membersById)
                              .filter((m) => m.role !== 'Marketing' && m.active)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      {focusedEngagement.status === 'Closed' && (
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">
                            Closed Reason (§6.4)
                          </label>
                          <select
                            disabled={!canEditEngagement(currentUser, focusedEngagement)}
                            value={focusedEngagement.closedReason || 'Other'}
                            onChange={(e) =>
                              onUpdateEngagement(
                                focusedEngagement.id,
                                { closedReason: e.target.value as ClosedReason },
                                `Updated closed reason to ${e.target.value}`,
                              )
                            }
                            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text"
                          >
                            {[
                              'Lost to competitor',
                              'No budget',
                              'Not interested',
                              'Relationship ended',
                              'Other',
                            ].map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Summary Details */}
                      <div className="rounded-xl border border-border divide-y divide-border text-xs">
                        <div className="flex items-center justify-between py-2.5 px-4 bg-bg/70">
                          <span className="font-semibold text-text-secondary">
                            Contact & Renewal Dates
                          </span>
                          {canEditEngagement(currentUser, focusedEngagement) && (
                            <button
                              type="button"
                              onClick={() =>
                                editingFields ? setEditingFields(false) : openInlineEdit()
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>{editingFields ? 'Cancel' : 'Edit Contact & Dates'}</span>
                            </button>
                          )}
                        </div>

                        {editingFields ? (
                          <form onSubmit={saveInlineEdit} className="p-4 space-y-3 bg-bg/40">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-medium text-muted mb-1">
                                  Client Email (Col I)
                                </label>
                                <input
                                  type="email"
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  placeholder="name@company.com"
                                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-muted mb-1">
                                  Phone (Col J)
                                </label>
                                <input
                                  type="text"
                                  value={editPhone}
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-muted mb-1">
                                  Surveillance / Renewal Due (Col V)
                                </label>
                                <input
                                  type="date"
                                  value={editSurveillanceDate}
                                  onChange={(e) => setEditSurveillanceDate(e.target.value)}
                                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-muted mb-1">
                                  Next Audit / Review Date (Col X)
                                </label>
                                <input
                                  type="date"
                                  value={editNextAuditDate}
                                  onChange={(e) => setEditNextAuditDate(e.target.value)}
                                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-muted mb-1">
                                  Certificate Valid To (Col T)
                                </label>
                                <input
                                  type="date"
                                  value={editCertValidTo}
                                  onChange={(e) => setEditCertValidTo(e.target.value)}
                                  className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text"
                                />
                              </div>
                              {showFinancials && (
                                <div>
                                  <label className="block text-[11px] font-medium text-muted mb-1">
                                    Contract Value INR (Col Y)
                                  </label>
                                  <input
                                    type="number"
                                    value={editContractValue}
                                    onChange={(e) => setEditContractValue(e.target.value)}
                                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingFields(false)}
                                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="rounded-lg bg-primary-strong hover:bg-primary-strong px-3.5 py-1.5 text-xs font-medium text-on-primary"
                              >
                                Save Changes
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex justify-between py-2.5 px-4">
                              <span className="text-muted">Standard / Framework</span>
                              <span className="font-medium text-text">
                                {focusedEngagement.standardFramework || '—'}
                              </span>
                            </div>
                            <div className="flex justify-between py-2.5 px-4">
                              <span className="text-muted">Scope</span>
                              <span className="font-medium text-text text-right max-w-md">
                                {focusedEngagement.scope || '—'}
                              </span>
                            </div>
                            <div className="flex justify-between py-2.5 px-4">
                              <span className="text-muted">Surveillance / Renewal Due (Col V)</span>
                              <span className="font-mono text-text">
                                {formatDateDDMMMYYYY(focusedEngagement.surveillanceRenewalDueDate)}
                              </span>
                            </div>
                            <div className="flex justify-between py-2.5 px-4">
                              <span className="text-muted">Next Audit / Review Date (Col X)</span>
                              <span className="font-mono text-text">
                                {formatDateDDMMMYYYY(focusedEngagement.nextAuditReviewDate)}
                              </span>
                            </div>
                            <div className="flex justify-between py-2.5 px-4">
                              <span className="text-muted">Certificate Valid To (Col T)</span>
                              <span className="font-mono text-text">
                                {formatDateDDMMMYYYY(focusedEngagement.certificateValidTo)}
                              </span>
                            </div>
                            {showFinancials && (
                              <>
                                <div className="flex justify-between py-2.5 px-4">
                                  <span className="text-muted">Contract Value (Col Y)</span>
                                  <span className="font-mono font-medium text-text">
                                    {formatINR(focusedEngagement.contractValueINR)}
                                  </span>
                                </div>
                                <div className="flex justify-between py-2.5 px-4">
                                  <span className="text-muted">Payment Status (Col Z)</span>
                                  <span className="font-medium text-text">
                                    {focusedEngagement.paymentStatus || '—'}
                                  </span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>

                      {/* Archive / Restore Control (FR-2: Nothing hard-deleted) */}
                      {isAdmin && (
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted">
                            Records are never hard-deleted; archive hides from default views.
                          </span>
                          {focusedEngagement.archived ? (
                            <button
                              type="button"
                              onClick={() => onArchiveEngagement(focusedEngagement.id, false)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Restore Engagement</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onArchiveEngagement(focusedEngagement.id, true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-danger-line px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-wash"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              <span>Archive Engagement</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === 'fields30' && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted">
                        Complete 30-column SQAS Excel schema mapping (Col A to Col AD). Dates follow{' '}
                        <span className="font-mono">dd-mmm-yyyy</span>.
                      </p>
                      <div className="rounded-xl border border-border overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <tbody className="divide-y divide-border">
                            {[
                              ['A', 'Client ID', activeClient.id],
                              ['B', 'Client Name', activeClient.name],
                              ['C', 'Industry / Sector', activeClient.industry],
                              ['D', 'Address', activeClient.address],
                              ['E', 'City', activeClient.city],
                              ['F', 'State / Country', activeClient.stateCountry],
                              ['G', 'Contact Person', activeClient.contactPerson],
                              ['H', 'Designation', activeClient.designation],
                              ['I', 'Email', activeClient.email || '(Missing — flagged)'],
                              ['J', 'Phone', activeClient.phone],
                              ['K', 'Website', activeClient.website],
                              ['L', 'Service / Certification', focusedEngagement.service],
                              ['M', 'Standard / Framework', focusedEngagement.standardFramework],
                              ['N', 'Scope of Certification / Service', focusedEngagement.scope],
                              ['O', 'Certification / Service Status', focusedEngagement.status],
                              [
                                'P',
                                'Initial Engagement Date',
                                formatDateDDMMMYYYY(focusedEngagement.initialEngagementDate),
                              ],
                              [
                                'Q',
                                'Certification / Completion Date',
                                formatDateDDMMMYYYY(focusedEngagement.certificationCompletionDate),
                              ],
                              [
                                'R',
                                'Certificate / Report No.',
                                focusedEngagement.certificateNo || '—',
                              ],
                              [
                                'S',
                                'Certificate Valid From',
                                formatDateDDMMMYYYY(focusedEngagement.certificateValidFrom),
                              ],
                              [
                                'T',
                                'Certificate Valid To',
                                formatDateDDMMMYYYY(focusedEngagement.certificateValidTo),
                              ],
                              [
                                'U',
                                'Certification Body / External LA',
                                focusedEngagement.certificationBodyOrLA || '—',
                              ],
                              [
                                'V',
                                'Surveillance / Renewal Due Date',
                                formatDateDDMMMYYYY(focusedEngagement.surveillanceRenewalDueDate),
                              ],
                              [
                                'W',
                                'Last Audit / Review Date',
                                formatDateDDMMMYYYY(focusedEngagement.lastAuditReviewDate),
                              ],
                              [
                                'X',
                                'Next Audit / Review Date',
                                formatDateDDMMMYYYY(focusedEngagement.nextAuditReviewDate),
                              ],
                              [
                                'Y',
                                'Contract Value',
                                showFinancials
                                  ? formatINR(focusedEngagement.contractValueINR)
                                  : 'Restricted (Hidden for role)',
                              ],
                              [
                                'Z',
                                'Payment Status',
                                showFinancials
                                  ? focusedEngagement.paymentStatus || '—'
                                  : 'Restricted (Hidden for role)',
                              ],
                              [
                                'AA',
                                'Relationship Owner',
                                focusedEngagement.ownerId
                                  ? membersById[focusedEngagement.ownerId]?.name || '—'
                                  : '(Unassigned)',
                              ],
                              ['AB', 'Lead Source', activeClient.leadSource],
                              ['AC', 'Client Rating / Priority', activeClient.rating],
                              ['AD', 'Remarks', focusedEngagement.remarks || '—'],
                            ].map(([col, label, value]) => (
                              <tr key={col} className="hover:bg-bg/60">
                                <td className="py-2 px-3 font-mono text-muted w-10">{col}</td>
                                <td className="py-2 px-3 font-medium text-text-secondary w-56">
                                  {label}
                                </td>
                                <td className="py-2 px-3 text-text font-mono">{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {detailTab === 'notes' && (
                    <div className="space-y-5">
                      {/* Add Meeting Note Form (§6.5 + FR-9: Consultants can add notes on any) */}
                      <form
                        onSubmit={handleSaveNote}
                        className="rounded-xl border border-border bg-bg p-4 space-y-3"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-text">
                          <StickyNote className="h-3.5 w-3.5 text-primary" />
                          <span>Log Meeting / Site Visit Note</span>
                        </div>
                        <textarea
                          rows={2}
                          value={newNoteSummary}
                          onChange={(e) => setNewNoteSummary(e.target.value)}
                          placeholder="e.g. Zoom with CTO, wants ML3 by March, send proposal..."
                          required
                          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newNoteNextStep}
                            onChange={(e) => setNewNoteNextStep(e.target.value)}
                            placeholder="Next step (e.g. Send proposal Friday)"
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text"
                          />
                          <select
                            value={newNoteHeldBy}
                            onChange={(e) => setNewNoteHeldBy(e.target.value)}
                            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text"
                          >
                            {Object.values(membersById)
                              .filter((m) => m.active)
                              .map((m) => (
                                <option key={m.id} value={m.id}>
                                  Held by: {m.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="rounded-lg bg-primary-strong hover:bg-primary-strong px-3.5 py-1.5 text-xs font-medium text-on-primary"
                          >
                            Save Note
                          </button>
                        </div>
                      </form>

                      {/* Note History */}
                      {focusedEngagement.notes.length === 0 ? (
                        <p className="text-xs text-muted">
                          No meeting notes logged yet for this engagement.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {focusedEngagement.notes.map((n) => (
                            <div key={n.id} className="rounded-xl border border-border p-4 text-xs">
                              <div className="flex items-center justify-between text-muted">
                                <span className="font-medium text-text">
                                  Held by {n.heldByName}
                                </span>
                                <span className="font-mono">
                                  {formatDateDDMMMYYYY(n.date)} · {n.source}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-text">{n.summary}</p>
                              {n.nextStep && (
                                <div className="mt-2 text-text-secondary">
                                  Next step: <span className="font-medium">{n.nextStep}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === 'emails' && (
                    <div className="space-y-4">
                      {/* FR-8 Approximate Open Tracking Explanation */}
                      <div className="rounded-lg border border-border bg-bg p-3 text-xs text-text-secondary">
                        <span className="font-medium text-text">
                          About "Likely opened" signals (FR-8):
                        </span>{' '}
                        Open tracking is approximate — some mail clients block tracking images while
                        others pre-load them automatically. Link clicks are stored but hidden unless
                        you ask to view them.
                      </div>

                      {focusedEngagement.emails.length === 0 ? (
                        <p className="text-xs text-muted">
                          No emails sent from Drishti for this engagement yet.
                        </p>
                      ) : (
                        focusedEngagement.emails.map((em) => (
                          <div
                            key={em.id}
                            className="rounded-xl border border-border p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-text">{em.subject}</div>
                                <div className="mt-0.5 text-xs text-muted">
                                  From <span className="font-mono">{em.sentFromEmail}</span> (
                                  {em.sentByName})
                                </div>
                              </div>
                              <div className="font-mono text-xs text-muted">
                                {formatTimestampIST(em.sentAt)}
                              </div>
                            </div>

                            <div className="whitespace-pre-line text-xs leading-relaxed text-text-secondary bg-bg rounded-lg p-3">
                              {em.body}
                            </div>

                            {/* Open & Reply Signals (FR-8) */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                              <div className="flex flex-wrap items-center gap-3">
                                {em.likelyOpenedAt && (
                                  <span className="inline-flex items-center gap-1 text-primary font-medium">
                                    <Eye className="h-3.5 w-3.5" />
                                    <span>
                                      Likely opened · {formatTimestampIST(em.likelyOpenedAt)}{' '}
                                      (approximate)
                                    </span>
                                  </span>
                                )}
                                {em.repliedAt && (
                                  <span className="inline-flex items-center gap-1 text-success font-medium">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    <span>
                                      Replied · {formatTimestampIST(em.repliedAt)} (Sequence
                                      stopped)
                                    </span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                {em.linkClicks && em.linkClicks.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowClicksForEmailId(
                                        showClicksForEmailId === em.id ? null : em.id,
                                      )
                                    }
                                    className="text-xs font-medium text-text-secondary hover:underline"
                                  >
                                    {showClicksForEmailId === em.id
                                      ? 'Hide link clicks'
                                      : 'Show link clicks'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {showClicksForEmailId === em.id && em.linkClicks && (
                              <div className="rounded-lg border border-border p-2.5 text-xs space-y-1">
                                {em.linkClicks.map((lc, i) => (
                                  <div
                                    key={i}
                                    className="flex justify-between font-mono text-[11px]"
                                  >
                                    <span className="truncate text-text-secondary">{lc.url}</span>
                                    <span className="text-muted shrink-0 ml-2">
                                      {lc.count} clicks · {formatTimestampIST(lc.clickedAt)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {em.replySnippet && (
                              <div className="rounded-lg border border-success-line bg-success-wash p-3 text-xs text-success">
                                <div className="font-semibold flex items-center gap-1.5">
                                  <Mail className="h-3.5 w-3.5" />
                                  <span>Client Reply Received</span>
                                </div>
                                <p className="mt-1 italic">"{em.replySnippet}"</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
