// Add Lead (Add and Edit, session 2; plan 4b, 4d). One form writes a client (new or existing),
// one engagement and, for a user with values access who typed an amount, its contract value:
// three requests through saveLead (answer Q2). Nothing is filled in for the person (CLAUDE.md
// rule 7): empty stays empty. Only two choices are preselected, both visible and changeable:
// stage "Lead" (Q5) and the signed-in Owner as owner.
// If the client is saved but the lead isn't, the form keeps the saved client (its fields are
// locked) and Try again sends only what is missing.
import React, { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useSignedInUser } from '../../lib/auth/context';
import { useAddLead, useClientsList, useLookups, useOwnerChoices } from '../../lib/data/hooks';
import {
  LEAD_STATUS_GROUPS,
  toLookupChoices,
  toStatusChoices,
  type Choice,
} from '../../lib/data/mappers';
import type { SavedLeadParts, NewLead } from '../../lib/data/writes';
import {
  validateClient,
  validateEngagement,
  validateFinancials,
  type ClientFormValues,
  type EngagementFormValues,
  type FieldErrors,
} from '../../lib/forms/validate';
import { useDialog } from '../../lib/useDialog';
import { DateField } from './DateField';
import { Field } from './Field';
import { INPUT_CLASS, inputBorder } from './fieldStyles';
import { LookupSelect } from './LookupSelect';
import { MoneyInput } from './MoneyInput';
import { OwnerSelect } from './OwnerSelect';

type ClientMode = 'new' | 'existing';

interface LeadValues {
  // New client
  name: string;
  contactPerson: string;
  designation: string;
  email: string;
  phone: string;
  city: string;
  // Existing client
  existingClientId: string;
  // Engagement
  certificationType: string;
  standardFramework: string;
  status: string;
  ownerId: string;
  leadSource: string;
  lastContactedOn: string;
  nextFollowUpOn: string;
  remarks: string;
  // Money (values access only)
  contractValue: string;
}

type LeadField = keyof LeadValues;

const emptyClientForm = (v: LeadValues): ClientFormValues => ({
  clientCode: '',
  name: v.name,
  industry: '',
  address: '',
  city: v.city,
  stateCountry: '',
  contactPerson: v.contactPerson,
  designation: v.designation,
  email: v.email,
  phone: v.phone,
  website: '',
  priority: '',
  doNotContact: false,
});

const engagementForm = (v: LeadValues): EngagementFormValues => ({
  certificationType: v.certificationType,
  standardFramework: v.standardFramework,
  scope: '',
  status: v.status,
  initialEngagementDate: '',
  completionDate: '',
  certificateNumber: '',
  validFrom: '',
  validTo: '',
  certificationBody: '',
  surveillanceDueDate: '',
  lastAuditDate: '',
  nextAuditDate: '',
  ownerId: v.ownerId,
  leadSource: v.leadSource,
  remarks: v.remarks,
  lastContactedOn: v.lastContactedOn,
  nextFollowUpOn: v.nextFollowUpOn,
});

const values = (choices: readonly Choice[] | undefined) => (choices ?? []).map((c) => c.value);

/** What the alert says when a save stops part-way. */
function partialMessage(step: 'client' | 'engagement' | 'financials', reason: string): string {
  if (step === 'engagement') return `The client was saved, but the lead wasn't. ${reason}`;
  if (step === 'financials') return `The lead was saved, but the contract value wasn't. ${reason}`;
  return reason;
}

export function AddLeadDialog({ onClose }: { onClose: () => void }) {
  const { id: userId, canSeeValues } = useSignedInUser();
  const lookups = useLookups();
  const clients = useClientsList();
  const ownerChoices = useOwnerChoices();
  const addLead = useAddLead();

  const [mode, setMode] = useState<ClientMode>('new');
  const [clientFilter, setClientFilter] = useState('');
  const [form, setForm] = useState<LeadValues>({
    name: '',
    contactPerson: '',
    designation: '',
    email: '',
    phone: '',
    city: '',
    existingClientId: '',
    certificationType: '',
    standardFramework: '',
    status: 'Lead',
    ownerId: userId,
    leadSource: '',
    lastContactedOn: '',
    nextFollowUpOn: '',
    remarks: '',
    contractValue: '',
  });
  const [errors, setErrors] = useState<FieldErrors<LeadField>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedLeadParts>({});
  // Set synchronously on submit, so a quick second click can't start a second save before
  // React has re-rendered with the mutation pending.
  const submitting = useRef(false);

  const saving = addLead.isPending;
  const clientLocked = saving || !!saved.clientId;
  const engagementLocked = saving || !!saved.engagementId;
  // No closing (Esc, Cancel, X) while a save is running.
  const dialog = useDialog(true, () => {
    if (!submitting.current) onClose();
  });

  const certificationChoices = useMemo(
    () => (lookups.data ? toLookupChoices(lookups.data.certificationTypes) : undefined),
    [lookups.data],
  );
  const statusChoices = useMemo(
    () => (lookups.data ? toStatusChoices(lookups.data.statuses, LEAD_STATUS_GROUPS) : undefined),
    [lookups.data],
  );
  const leadSourceChoices = useMemo(
    () => (lookups.data ? toLookupChoices(lookups.data.leadSources) : undefined),
    [lookups.data],
  );
  const term = clientFilter.trim().toLowerCase();
  const clientChoices = useMemo<Choice[] | undefined>(
    () =>
      clients.data
        ?.filter(
          (c) =>
            !term ||
            c.name.toLowerCase().includes(term) ||
            (c.client_code ?? '').toLowerCase().includes(term),
        )
        .map((c) => ({ value: c.id, label: c.city ? `${c.name} (${c.city})` : c.name })),
    [clients.data, term],
  );

  const set = (field: LeadField) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const text = (field: LeadField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(field)(e.target.value);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting.current) return;
    setServerMessage(null);

    const fieldErrors: FieldErrors<LeadField> = {};
    let leadClient: NewLead['client'] | null = null;
    if (saved.clientId) {
      leadClient = { existingId: saved.clientId };
    } else if (mode === 'existing') {
      if (form.existingClientId) leadClient = { existingId: form.existingClientId };
      else fieldErrors.existingClientId = 'Choose a client.';
    } else {
      const checked = validateClient(emptyClientForm(form), []);
      if (checked.ok) leadClient = checked.input;
      else Object.assign(fieldErrors, checked.errors);
    }

    const engagement = validateEngagement(engagementForm(form), '', {
      certificationTypes: values(certificationChoices),
      statuses: values(statusChoices),
      leadSources: values(leadSourceChoices),
      owners: values(ownerChoices),
    });
    if (!engagement.ok) Object.assign(fieldErrors, engagement.errors);

    let financials: NewLead['financials'] = null;
    if (canSeeValues && form.contractValue.trim() !== '') {
      const money = validateFinancials(
        { contractValue: form.contractValue, paymentStatus: '' },
        [],
      );
      if (money.ok) financials = money.input;
      else Object.assign(fieldErrors, money.errors);
    }

    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || !leadClient || !engagement.ok) return;

    // saveLead sets the engagement's client (the new client's id, or the chosen one).
    const engagementInput: NewLead['engagement'] = { ...engagement.input };
    submitting.current = true;
    addLead.mutate(
      { lead: { client: leadClient, engagement: engagementInput, financials }, saved },
      {
        onSuccess: () => {
          submitting.current = false;
          onClose();
        },
        onError: (error) => {
          submitting.current = false;
          setSaved(error.saved);
          setServerMessage(partialMessage(error.step, error.error.message));
        },
      },
    );
  };

  const close = () => {
    if (!submitting.current) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-backdrop/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        {...dialog.panelProps}
        className="bg-surface border border-line/22 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col outline-none"
      >
        <div className="p-5 border-b border-line/14 bg-raised/60 flex items-start justify-between">
          <div>
            <h3 id={dialog.titleId} className="text-lg font-bold text-text">
              New lead
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Fields marked * are required. Leave anything you don't know empty.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            aria-label="Close"
            className="p-1.5 rounded-lg text-muted hover:text-text-strong bg-raised disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="p-5 overflow-y-auto space-y-5 flex-1 text-xs"
        >
          {/* Client */}
          <fieldset className="space-y-3" disabled={clientLocked}>
            <legend className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
              Client
            </legend>
            {saved.clientId ? (
              <p className="text-text-secondary">
                The client is saved. Try again adds only the lead.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  {(['new', 'existing'] as const).map((option) => (
                    <label key={option} className="flex items-center gap-1.5 text-text">
                      <input
                        type="radio"
                        name="client-mode"
                        value={option}
                        checked={mode === option}
                        onChange={() => setMode(option)}
                        className="accent-primary"
                      />
                      {option === 'new' ? 'New client' : 'Existing client'}
                    </label>
                  ))}
                </div>

                {mode === 'existing' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field id="lead-client-filter" label="Find a client">
                      {(describedBy) => (
                        <input
                          id="lead-client-filter"
                          type="search"
                          autoComplete="off"
                          placeholder="Name or Client ID"
                          value={clientFilter}
                          onChange={(e) => setClientFilter(e.target.value)}
                          {...describedBy}
                          className={`${INPUT_CLASS} ${inputBorder(undefined)}`}
                        />
                      )}
                    </Field>
                    <LookupSelect
                      id="lead-existing-client"
                      label="Client"
                      required
                      value={form.existingClientId}
                      onChange={set('existingClientId')}
                      choices={clientChoices}
                      emptyLabel="Choose a client"
                      error={errors.existingClientId}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <TextInput
                      id="lead-name"
                      label="Company name"
                      required
                      value={form.name}
                      onChange={text('name')}
                      error={errors.name}
                    />
                    <TextInput
                      id="lead-contact"
                      label="Contact person"
                      value={form.contactPerson}
                      onChange={text('contactPerson')}
                      error={errors.contactPerson}
                    />
                    <TextInput
                      id="lead-designation"
                      label="Designation"
                      value={form.designation}
                      onChange={text('designation')}
                      error={errors.designation}
                    />
                    <TextInput
                      id="lead-email"
                      label="Email"
                      type="email"
                      help="Needed later to send follow-ups."
                      value={form.email}
                      onChange={text('email')}
                      error={errors.email}
                    />
                    <TextInput
                      id="lead-phone"
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      onChange={text('phone')}
                      error={errors.phone}
                    />
                    <TextInput
                      id="lead-city"
                      label="City"
                      value={form.city}
                      onChange={text('city')}
                      error={errors.city}
                    />
                  </div>
                )}
              </>
            )}
          </fieldset>

          {/* Lead (the engagement) */}
          <fieldset className="space-y-3" disabled={engagementLocked}>
            <legend className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
              Lead
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <LookupSelect
                id="lead-certification"
                label="Certification"
                required
                value={form.certificationType}
                onChange={set('certificationType')}
                choices={certificationChoices}
                emptyLabel="Choose a certification"
                error={errors.certificationType}
              />
              <TextInput
                id="lead-standard"
                label="Standard / framework"
                placeholder="e.g. ISO/IEC 27001:2022"
                value={form.standardFramework}
                onChange={text('standardFramework')}
                error={errors.standardFramework}
              />
              <LookupSelect
                id="lead-stage"
                label="Stage"
                required
                value={form.status}
                onChange={set('status')}
                choices={statusChoices}
                emptyLabel="Choose a stage"
                error={errors.status}
              />
              <OwnerSelect
                id="lead-owner"
                value={form.ownerId}
                onChange={set('ownerId')}
                error={errors.ownerId}
              />
              <LookupSelect
                id="lead-source"
                label="Lead source"
                value={form.leadSource}
                onChange={set('leadSource')}
                choices={leadSourceChoices}
                emptyLabel="Not set"
                error={errors.leadSource}
              />
              <DateField
                id="lead-last-contacted"
                label="Last contacted"
                value={form.lastContactedOn}
                onChange={set('lastContactedOn')}
                error={errors.lastContactedOn}
              />
              <DateField
                id="lead-next-follow-up"
                label="Next follow-up"
                value={form.nextFollowUpOn}
                onChange={set('nextFollowUpOn')}
                error={errors.nextFollowUpOn}
              />
            </div>
            <Field id="lead-remarks" label="Remarks" error={errors.remarks}>
              {(describedBy) => (
                <textarea
                  id="lead-remarks"
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => set('remarks')(e.target.value)}
                  {...describedBy}
                  className={`${INPUT_CLASS} ${inputBorder(errors.remarks)}`}
                />
              )}
            </Field>
          </fieldset>

          {/* Contract value: only for a user with values access (DESIGN.md line 165). Outside
              the lead's fieldset, so it can still be corrected if only this step failed. */}
          {canSeeValues && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MoneyInput
                id="lead-value"
                label="Contract value"
                value={form.contractValue}
                onChange={set('contractValue')}
                error={errors.contractValue}
                disabled={saving}
              />
            </div>
          )}

          {serverMessage && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 p-3 rounded-xl border border-danger/40 bg-danger/10 text-danger"
            >
              <span>{serverMessage}</span>
              {(saved.clientId || saved.engagementId) && (
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={saving}
                  className="shrink-0 px-3 py-1 rounded-lg border border-danger/40 font-semibold hover:bg-danger/10 disabled:opacity-60"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line/10">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs text-text-secondary hover:text-text-strong disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              aria-busy={saving || undefined}
              className="min-w-[7.5rem] px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-teal text-on-primary font-bold text-xs shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Add lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface TextInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
  help?: string;
  error?: string;
}

function TextInput({
  id,
  label,
  value,
  onChange,
  required,
  type = 'text',
  placeholder,
  help,
  error,
}: TextInputProps) {
  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      {(describedBy) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-required={required || undefined}
          autoComplete="off"
          {...describedBy}
          className={`${INPUT_CLASS} ${inputBorder(error)}`}
        />
      )}
    </Field>
  );
}
