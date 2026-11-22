import React, { useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { useCrm } from '../context/CrmContext';
import { Client as MvpClient, ServiceKind } from '../types';
import type { Client, Engagement } from '../types/crm';
import { NO_OWNER, ownerText } from '../lib/data/mappers';
import { useActiveClients, useEngagementValues, useOwnerName } from '../lib/data/hooks';
import { dataErrorMessage } from '../lib/data/errors';
import { LIST_MESSAGES, listState } from '../lib/data/listState';
import { useDialog } from '../lib/useDialog';
import { useSignedInUser } from '../lib/auth/context';
import { formatINR } from '../utils/currency';
import { isFeatureEnabled } from '../lib/screens';
import { formatStandardDate } from '../utils/dateUtils';

// Hidden until wired (src/lib/screens.ts). Removed in 2-b: the email-draft buttons (the MVP
// draft dialog takes the old types; drafts come back in Phase 5), the MVP edit form and
// activity trail (rebuilt on the database later), and Delete Client (nobody can
// hard-delete; archive comes later).
const showAddClient = isFeatureEnabled('addClient');

const dateOrDash = (date: string | null) => (date ? formatStandardDate(date) : '—');

const NO_CLIENTS: Client[] = [];

/** "CMMI DEV ML3": type and framework, whichever are present; empty when neither is. */
const certificationOf = (e: Engagement) =>
  [e.certificationType, e.standardFramework].filter(Boolean).join(' ');

/** The most recent last-audit date of any engagement, or null when none has one. */
function latestAudit(client: Client): string | null {
  const dates = client.engagements.map((e) => e.lastAuditDate).filter((d) => d !== null);
  return dates.length ? dates.sort().at(-1)! : null;
}

const unique = <T,>(values: T[]) => [...new Set(values)];

export function ClientsView() {
  const { addClient } = useCrm();
  // The `active_clients` view (step 2-d); loading, error, empty and no-match states (step 2-g).
  // Marketing reads no rows here (row-level security), so it gets a plain message.
  const { data: loaded, error: loadError, refetch } = useActiveClients();
  const clients = loaded ?? NO_CLIENTS;
  const { role } = useSignedInUser();
  const ownerName = useOwnerName();
  // Values only from engagement_financials, and only for users with values access (step 2-f).
  const { canSeeValues, valueOf, totalOf } = useEngagementValues();

  /** The Contract Value cell: the total, "—" when none is recorded, nothing while loading. */
  const totalText = (client: Client) => {
    const total = totalOf(client.engagements);
    if (total !== null) return formatINR(total);
    return client.engagements.some((e) => valueOf(e.id).state === 'loading') ? '' : '—';
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);

  // Filter options come from the rows, not from a fixed list.
  const allEngagements = clients.flatMap((c) => c.engagements);
  const certificationTypes = unique(
    allEngagements.map((e) => e.certificationType).filter((t) => t !== null),
  ).sort();
  const ownerIds = unique(allEngagements.map((e) => e.ownerId).filter((id) => id !== null));

  // One option per owner id (step 2-e: names from team_members), sorted by name; none until
  // the names have arrived. Two different unknown ids stay two options (they filter
  // different rows).
  const ownerOptions = ownerIds
    .map((id) => ({ id, shown: ownerName(id) }))
    .filter((option) => option.shown.state !== 'loading')
    .map(({ id, shown }) => ({ id, label: ownerText(shown) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en-IN'));

  // The Owner cell: each name once; "No owner" only when no engagement has an owner.
  const ownerNames = (client: Client) =>
    unique(
      client.engagements
        .filter((e) => e.ownerId !== null)
        .map((e) => ownerText(ownerName(e.ownerId)))
        .filter((label) => label !== ''),
    );
  const hasOwner = (client: Client) => client.engagements.some((e) => e.ownerId !== null);

  // Filter clients
  const term = searchTerm.toLowerCase();
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(term) ||
      (c.contactPerson ?? '').toLowerCase().includes(term) ||
      (c.city ?? '').toLowerCase().includes(term) ||
      c.engagements.some((e) => (e.certificationType ?? '').toLowerCase().includes(term));
    const matchesService =
      serviceFilter === 'ALL' || c.engagements.some((e) => e.certificationType === serviceFilter);
    const matchesOwner =
      ownerFilter === 'ALL' || c.engagements.some((e) => e.ownerId === ownerFilter);
    return matchesSearch && matchesService && matchesOwner;
  });

  // The table shows only for 'rows'; every other state shows one line instead (step 2-g).
  const state = listState(
    { hasData: loaded !== undefined, error: loadError },
    filteredClients.length,
    clients.length,
  );
  const clearSearchAndFilters = () => {
    setSearchTerm('');
    setServiceFilter('ALL');
    setOwnerFilter('ALL');
  };

  const selected = selectedId ? (clients.find((c) => c.id === selectedId) ?? null) : null;
  // Focus, Esc and Tab for the details dialog (step 2-g).
  const detailsDialog = useDialog(selected !== null, () => setSelectedId(null));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Certified Clients
            </h1>
            {loaded && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-raised text-primary border border-line/18">
                {clients.length} Active Accounts
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Master record of certified organizations, appraisal dates, and contract values.
          </p>
        </div>

        {showAddClient && (
          <button
            onClick={() => setIsAddClientOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-primary to-teal hover:from-primary-soft hover:to-info text-on-primary font-bold text-xs shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={15} />
            <span>Add Client</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-surface p-3 rounded-2xl border border-line/16">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name, contact, city, or certification..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg border border-line/14 text-sm text-text placeholder-muted focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-bg border border-line/14 text-xs text-text focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Standards</option>
            {certificationTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-bg border border-line/14 text-xs text-text focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Owners</option>
            {ownerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Not read yet, or the first read failed (step 2-g). Try again puts the query back to
          loading, so the loading line shows again. */}
      {state === 'loading' && (
        <p role="status" className="text-xs text-muted">
          {LIST_MESSAGES.clientsLoading}
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

      {/* Read, but no clients. Marketing never reads this view's rows (row-level security). */}
      {state === 'empty' && (
        <p className="text-xs text-muted">
          {role === 'marketing' ? LIST_MESSAGES.clientsEmptyMarketing : LIST_MESSAGES.clientsEmpty}
        </p>
      )}

      {/* Clients exist, but the search and filters leave none */}
      {state === 'no-match' && (
        <div className="flex items-center gap-3 text-xs">
          <p className="text-muted">{LIST_MESSAGES.clientsNoMatch}</p>
          <button
            type="button"
            onClick={clearSearchAndFilters}
            className="px-3 py-1.5 rounded-lg bg-surface border border-line/16 text-text-secondary hover:text-text"
          >
            {LIST_MESSAGES.clearSearchAndFilters}
          </button>
        </div>
      )}

      {/* Clients Table. No wrapping inside it (step 2-g): on a phone it scrolls sideways instead
          of breaking names, chips and dates over several lines. */}
      {state === 'rows' && (
        <div className="bg-surface border border-line/16 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-raised text-text-secondary uppercase text-[10px] tracking-wider border-b border-line/12">
                <tr>
                  <th className="px-4 py-3">Client Company</th>
                  <th className="px-4 py-3">Standard / Level</th>
                  <th className="px-4 py-3">Contact Person</th>
                  <th className="px-4 py-3">Last Audit</th>
                  <th className="px-4 py-3">Status / Valid To</th>
                  {/* No Contract Value column at all without values access (step 2-f) */}
                  {canSeeValues && <th className="px-4 py-3">Contract Value</th>}
                  <th className="px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/8 text-text">
                {filteredClients.map((client) => {
                  const owners = ownerNames(client);

                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedId(client.id)}
                      className="hover:bg-raised/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm text-text">{client.name}</div>
                        {client.city && (
                          <div className="text-[11px] text-muted truncate max-w-xs">
                            {client.city}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          {client.engagements.map((e) => (
                            <span
                              key={e.id}
                              className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-raised text-primary border border-primary/20"
                            >
                              {certificationOf(e)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        <div>{client.contactPerson ?? '—'}</div>
                        {client.email && (
                          <div className="text-[10px] text-muted">{client.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">
                        {dateOrDash(latestAudit(client))}
                      </td>
                      <td className="px-4 py-3">
                        {/* No renewal countdown here: the renewal date rule lives in the database
                            (step 15), so the browser never estimates one. */}
                        <div className="flex flex-col items-start gap-1">
                          {client.engagements.map((e) => (
                            <span key={e.id} className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-raised text-text-secondary">
                                {e.status}
                              </span>
                              <span className="font-mono text-[11px] text-muted">
                                {dateOrDash(e.validTo)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      {canSeeValues && (
                        <td className="px-4 py-3 font-mono font-bold text-text tabular-nums">
                          {totalText(client)}
                        </td>
                      )}
                      <td className="px-4 py-3 text-text-secondary">
                        {/* Nothing while the names load; "No owner" only when none has one */}
                        {owners.length ? owners.join(', ') : hasOwner(client) ? '' : NO_OWNER}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLIENT DETAILS DIALOG: client details and its active engagements (2-d), read-only */}
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
                <h3 id={detailsDialog.titleId} className="text-lg font-bold text-text">
                  {selected.name}
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Client ID: {selected.code ?? '—'} · Contact: {selected.contactPerson ?? '—'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg text-muted hover:text-text-strong bg-raised"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-bg p-3.5 rounded-xl border border-line/10">
                {(
                  [
                    ['Contact Person', selected.contactPerson],
                    ['Designation', selected.designation],
                    ['Email', selected.email],
                    ['Phone', selected.phone],
                    ['City', selected.city],
                    ['Industry', selected.industry],
                    ['Priority', selected.priority],
                    ['Website', selected.website],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <span className="text-muted block text-[10px] uppercase font-semibold">
                      {label}
                    </span>
                    <span className="text-text font-medium text-xs break-words">
                      {value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>

              {selected.address && (
                <div className="p-3.5 rounded-xl bg-raised/50 border border-line/12">
                  <span className="text-[10px] font-bold text-muted uppercase block mb-1">
                    Address
                  </span>
                  <p className="text-text leading-relaxed">
                    {[selected.address, selected.stateCountry].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              {/* The client's engagements from `active_clients` (2-d). Read-only; empty shows
                  "—", and Valid to is never estimated in the browser. */}
              <div className="p-3.5 rounded-xl bg-bg border border-line/10">
                <span className="text-[10px] font-bold text-muted uppercase block mb-2">
                  Certifications
                </span>
                <table className="w-full text-left text-xs">
                  <thead className="text-muted text-[10px] uppercase">
                    <tr>
                      <th className="pb-1.5 pr-3 font-semibold">Certification</th>
                      <th className="pb-1.5 pr-3 font-semibold">Status</th>
                      <th className="pb-1.5 font-semibold">Valid To</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/8">
                    {selected.engagements.map((e) => (
                      <tr key={e.id}>
                        <td className="py-1.5 pr-3 font-mono font-bold text-primary break-words">
                          {certificationOf(e) || '—'}
                        </td>
                        <td className="py-1.5 pr-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-raised text-text-secondary">
                            {e.status}
                          </span>
                        </td>
                        <td className="py-1.5 font-mono text-text-secondary">
                          {dateOrDash(e.validTo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CLIENT MODAL (hidden: still the MVP form on the old browser store) */}
      {showAddClient && isAddClientOpen && (
        <AddClientModal
          onClose={() => setIsAddClientOpen(false)}
          onAdd={(c) => {
            addClient(c);
            setIsAddClientOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddClientModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (client: Omit<MvpClient, 'id'>) => void;
}) {
  // Hidden (feature addClient off); rebuilt on team_members later. Default owner: the
  // signed-in person, from their profile (step 2-e).
  const { fullName } = useSignedInUser();
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email] = useState('');
  const [phone] = useState('');
  const [service, setService] = useState<ServiceKind>('CMMI');
  const [level, setLevel] = useState('DEV ML3');
  const [contractValue, setContractValue] = useState(1200000);
  const [lastAppraisalDate, setLastAppraisalDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [owner, setOwner] = useState(fullName);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !contactName.trim()) return;

    onAdd({
      company: company.trim(),
      contactName: contactName.trim(),
      email: email.trim() || 'contact@' + company.toLowerCase().replace(/\s+/g, '') + '.in',
      phone: phone.trim() || '+91 98000 00000',
      service,
      level: level.trim() || undefined,
      contractValue: Number(contractValue) || 1000000,
      lastAppraisalDate,
      owner,
      notes: notes.trim(),
      activity: [
        {
          at: new Date().toISOString(),
          note: `Client account created by ${owner}`,
          author: owner,
        },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-backdrop/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-line/22 rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-line/12">
          <h3 className="font-bold text-base text-text">Add Certified Client</h3>
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
                placeholder="e.g. Infosys Process Lab"
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
                placeholder="e.g. S. Venkatraman"
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
                value={service}
                onChange={(e) => setService(e.target.value as ServiceKind)}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
              >
                <option value="CMMI">CMMI (3-Year Cycle)</option>
                <option value="ISO">ISO (1-Year Cycle)</option>
                <option value="IPA">IPA (1-Year Cycle)</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Level / Detail
              </label>
              <input
                type="text"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. DEV ML5"
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Contract Value (₹)
              </label>
              <input
                type="number"
                value={contractValue}
                onChange={(e) => setContractValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-bg border border-line/16 text-text font-mono focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-muted uppercase font-semibold text-[10px] mb-1">
                Last Appraisal Date
              </label>
              <input
                type="date"
                value={lastAppraisalDate}
                onChange={(e) => setLastAppraisalDate(e.target.value)}
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
              Auditor Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Scope includes 2 development centers in Pune and Chennai."
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
              Create Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
