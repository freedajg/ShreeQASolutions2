import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AppSettings, Client, LeadSource, ServiceType, TeamMember } from '../types/crm';
import { canViewContractValues } from '../utils/formatters';
import type { NewLeadInput } from '../data/actions';

interface NewLeadModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: TeamMember;
  clients: Client[];
  membersById: Record<string, TeamMember>;
  settings: AppSettings;
  onCreate: (input: NewLeadInput) => Promise<boolean>;
}

// Adds a lead. Nothing is invented (CLAUDE.md rule 7): empty fields stay empty. Who can be the
// Relationship Owner follows the database rules: an Owner assigns anyone; a Consultant themselves
// or nobody; Marketing nobody (an Owner assigns one later, and the Pipeline highlights it).
export const NewLeadModal: React.FC<NewLeadModalProps> = (props) =>
  props.open ? <NewLeadForm {...props} /> : null;

const NewLeadForm: React.FC<NewLeadModalProps> = ({
  onClose,
  currentUser,
  clients,
  membersById,
  settings,
  onCreate,
}) => {
  const [mode, setMode] = useState<'newClient' | 'existingClient'>('newClient');
  const [existingClientId, setExistingClientId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadSource, setLeadSource] = useState<LeadSource | ''>('');
  const [service, setService] = useState<ServiceType | ''>('');
  const [standardFramework, setStandardFramework] = useState('');
  const [ownerId, setOwnerId] = useState(currentUser.role === 'Consultant' ? currentUser.id : '');
  const [contractValue, setContractValue] = useState('');
  const [initialNote, setInitialNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const showFinancials = canViewContractValues(currentUser);
  const owners =
    currentUser.role === 'Owner/Admin'
      ? Object.values(membersById).filter((m) => m.role !== 'Marketing' && m.active)
      : currentUser.role === 'Consultant'
        ? [currentUser]
        : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (mode === 'existingClient' && !existingClientId) {
      setProblem('Choose the client.');
      return;
    }
    const value = contractValue.trim() === '' ? undefined : Number(contractValue);
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      setProblem('Contract value must be a number in rupees.');
      return;
    }
    setSaving(true);
    const ok = await onCreate({
      existingClientId: mode === 'existingClient' ? existingClientId : undefined,
      client:
        mode === 'newClient' ? { name: companyName, contactPerson, email, city, phone } : undefined,
      service,
      standardFramework,
      leadSource,
      ownerId,
      contractValue: showFinancials ? value : undefined,
      note: initialNote,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-raised"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="font-display text-lg font-semibold text-text">Add Lead / Engagement</h2>
        <p className="mt-1 text-xs text-muted">
          Create a new company or attach a new certification engagement to an existing SQAS client.
        </p>

        <div className="mt-4 inline-flex rounded-lg bg-raised p-1">
          <button
            type="button"
            onClick={() => setMode('newClient')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'newClient' ? 'bg-surface text-text shadow-xs' : 'text-text-secondary'
            }`}
          >
            New Client Company
          </button>
          <button
            type="button"
            onClick={() => setMode('existingClient')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'existingClient' ? 'bg-surface text-text shadow-xs' : 'text-text-secondary'
            }`}
          >
            Existing Client (§6.1)
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5 text-xs">
          {mode === 'existingClient' ? (
            <div>
              <label className="block font-medium text-text-secondary mb-1">
                Select Existing Client
              </label>
              <select
                value={existingClientId}
                onChange={(e) => setExistingClientId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              >
                <option value="">Choose a client…</option>
                {clients
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code ? `${c.code} — ` : ''}
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-medium text-text-secondary mb-1">
                  Client Name (Required)
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Garuda Cloud Systems Pvt. Ltd."
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Contact Name"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">Work Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.in"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Lead Source (Col AB)
                </label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
                >
                  <option value="">Not known</option>
                  {settings.leadSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-text-secondary mb-1">
                Service / Certification (Col L)
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value as ServiceType)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              >
                <option value="">Choose…</option>
                {settings.services.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-text-secondary mb-1">
                Relationship Owner (Col AA)
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              >
                <option value="">No owner yet</option>
                {owners.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={showFinancials ? '' : 'sm:col-span-2'}>
              <label className="block font-medium text-text-secondary mb-1">
                Standard / Framework (Col M)
              </label>
              <input
                type="text"
                value={standardFramework}
                onChange={(e) => setStandardFramework(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
              />
            </div>

            {showFinancials && (
              <div>
                <label className="block font-medium text-text-secondary mb-1">
                  Est. Contract Value (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={contractValue}
                  onChange={(e) => setContractValue(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-text"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block font-medium text-text-secondary mb-1">
              Initial Meeting Note / Context
            </label>
            <textarea
              rows={2}
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="e.g. Zoom with CTO, wants ML3 by March, send proposal"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text"
            />
          </div>

          {problem && (
            <p role="alert" className="text-danger">
              {problem}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-strong px-4 py-2 font-medium text-on-primary disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
