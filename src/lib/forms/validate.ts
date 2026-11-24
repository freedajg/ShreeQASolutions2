// Form checks for Add and Edit (session 1). Pure functions, no package. They mirror the
// database's own checks (20261004151000_clients_engagements.sql lines 41–115) so a person sees
// a field message before saving; the database stays the final check (toSaveError).
// Text is trimmed; an empty field becomes null. Nothing is filled in (CLAUDE.md rule 7).
import type { ClientInput, EngagementInput, FinancialsInput } from '../../types/crm';
import { parseStandardDate } from '../../utils/dateUtils';

/** Column length limits (char_length checks in the migration). */
export const LIMITS = {
  clientCode: 50,
  name: 200,
  industry: 200,
  address: 1000,
  city: 200,
  stateCountry: 200,
  contactPerson: 200,
  designation: 200,
  email: 320,
  phone: 50,
  website: 500,
  standardFramework: 200,
  scope: 2000,
  certificateNumber: 200,
  certificationBody: 200,
  remarks: 5000,
} as const;

/** The database's email check, copied exactly (clients_engagements.sql line 56). */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** numeric(12, 2): at most 10 digits before the point. */
export const MAX_AMOUNT = 9_999_999_999.99;

export const MESSAGES = {
  required: 'This field is required.',
  name: 'Enter the company name.',
  tooLong: (max: number) => `Keep this under ${max.toLocaleString('en-IN')} characters.`,
  email: 'Enter a valid email address, e.g. name@company.com.',
  amount: 'Enter an amount, e.g. 4,50,000 or 4,50,000.50.',
  amountTooBig: 'That amount is too large.',
  date: 'Enter the date as dd-MMM-yyyy, e.g. 12-Mar-2026.',
  choice: 'Choose from the list.',
  certification: 'Choose a certification.',
  status: 'Choose a stage.',
} as const;

/** Trims; an empty or blank value is null. */
export function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** Length as Postgres char_length counts it (characters, not UTF-16 units). */
const charLength = (value: string) => [...value].length;

/** A length error, or undefined. */
export function checkLength(value: string | null, max: number): string | undefined {
  return value !== null && charLength(value) > max ? MESSAGES.tooLong(max) : undefined;
}

export type AmountResult = { ok: true; value: number | null } | { ok: false; error: string };

/**
 * An amount as typed: digits, optional commas (any grouping), optional 1–2 decimals. Empty is
 * null (not recorded). No currency symbol: the currency comes from its own field (next step).
 */
export function parseAmount(text: string): AmountResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  const plain = trimmed.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(plain)) return { ok: false, error: MESSAGES.amount };
  const value = Number(plain);
  if (value > MAX_AMOUNT) return { ok: false, error: MESSAGES.amountTooBig };
  return { ok: true, value };
}

/** A choice error, or undefined. An empty value is fine unless required. */
export function checkChoice(
  value: string | null,
  allowed: readonly string[],
  requiredMessage?: string,
): string | undefined {
  if (value === null) return requiredMessage;
  return allowed.includes(value) ? undefined : MESSAGES.choice;
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type Validated<T, K extends string> =
  { ok: true; input: T } | { ok: false; errors: FieldErrors<K> };

// ---------------------------------------------------------------------------
// Client form
// ---------------------------------------------------------------------------

/** The client form as typed (every text field is a string; empty = not filled in). */
export type ClientFormValues = Record<Exclude<keyof ClientInput, 'doNotContact'>, string> & {
  doNotContact: boolean;
};

type ClientField = keyof ClientFormValues;

const CLIENT_TEXT_FIELDS = [
  'clientCode',
  'name',
  'industry',
  'address',
  'city',
  'stateCountry',
  'contactPerson',
  'designation',
  'email',
  'phone',
  'website',
] as const;

export function validateClient(
  values: ClientFormValues,
  priorities: readonly string[],
): Validated<ClientInput, ClientField> {
  const errors: FieldErrors<ClientField> = {};
  const text = Object.fromEntries(
    CLIENT_TEXT_FIELDS.map((field) => [field, cleanText(values[field])]),
  ) as Record<(typeof CLIENT_TEXT_FIELDS)[number], string | null>;

  for (const field of CLIENT_TEXT_FIELDS) {
    const error = checkLength(text[field], LIMITS[field]);
    if (error) errors[field] = error;
  }
  if (text.name === null) errors.name = MESSAGES.name;
  if (text.email !== null && !errors.email && !EMAIL_PATTERN.test(text.email)) {
    errors.email = MESSAGES.email;
  }
  const priority = cleanText(values.priority);
  const priorityError = checkChoice(priority, priorities);
  if (priorityError) errors.priority = priorityError;

  if (Object.keys(errors).length > 0 || text.name === null) return { ok: false, errors };
  return {
    ok: true,
    input: { ...text, name: text.name, priority, doNotContact: values.doNotContact },
  };
}

// ---------------------------------------------------------------------------
// Engagement form (and the money fields shown only with values access)
// ---------------------------------------------------------------------------

const ENGAGEMENT_TEXT_FIELDS = [
  'standardFramework',
  'scope',
  'certificateNumber',
  'certificationBody',
  'remarks',
] as const;

const ENGAGEMENT_DATE_FIELDS = [
  'initialEngagementDate',
  'completionDate',
  'validFrom',
  'validTo',
  'surveillanceDueDate',
  'lastAuditDate',
  'nextAuditDate',
  'lastContactedOn',
  'nextFollowUpOn',
] as const;

/** The engagement form as typed. Dates are typed as dd-MMM-yyyy. */
export type EngagementFormValues = Record<Exclude<keyof EngagementInput, 'clientId'>, string>;

type EngagementField = keyof EngagementFormValues;

/** The allowed codes for each dropdown (from the lookups) and the owner ids. */
export interface EngagementChoices {
  certificationTypes: readonly string[];
  statuses: readonly string[];
  leadSources: readonly string[];
  owners: readonly string[];
}

export function validateEngagement(
  values: EngagementFormValues,
  clientId: string,
  choices: EngagementChoices,
): Validated<EngagementInput, EngagementField> {
  const errors: FieldErrors<EngagementField> = {};

  const text = Object.fromEntries(
    ENGAGEMENT_TEXT_FIELDS.map((field) => [field, cleanText(values[field])]),
  ) as Record<(typeof ENGAGEMENT_TEXT_FIELDS)[number], string | null>;
  for (const field of ENGAGEMENT_TEXT_FIELDS) {
    const error = checkLength(text[field], LIMITS[field]);
    if (error) errors[field] = error;
  }

  const dates = {} as Record<(typeof ENGAGEMENT_DATE_FIELDS)[number], string | null>;
  for (const field of ENGAGEMENT_DATE_FIELDS) {
    const typed = cleanText(values[field]);
    dates[field] = typed === null ? null : parseStandardDate(typed);
    if (typed !== null && dates[field] === null) errors[field] = MESSAGES.date;
  }

  const certificationType = cleanText(values.certificationType);
  const status = cleanText(values.status);
  const leadSource = cleanText(values.leadSource);
  const ownerId = cleanText(values.ownerId);
  const choiceErrors: FieldErrors<EngagementField> = {
    certificationType: checkChoice(
      certificationType,
      choices.certificationTypes,
      MESSAGES.certification,
    ),
    status: checkChoice(status, choices.statuses, MESSAGES.status),
    leadSource: checkChoice(leadSource, choices.leadSources),
    ownerId: checkChoice(ownerId, choices.owners),
  };
  for (const [field, error] of Object.entries(choiceErrors)) {
    if (error) errors[field as EngagementField] = error;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    input: { clientId, ...text, ...dates, certificationType, status, leadSource, ownerId },
  };
}

export type FinancialsFormValues = { contractValue: string; paymentStatus: string };

export function validateFinancials(
  values: FinancialsFormValues,
  paymentStatuses: readonly string[],
): Validated<FinancialsInput, keyof FinancialsFormValues> {
  const errors: FieldErrors<keyof FinancialsFormValues> = {};
  const amount = parseAmount(values.contractValue);
  if (!amount.ok) errors.contractValue = amount.error;
  const paymentStatus = cleanText(values.paymentStatus);
  const paymentError = checkChoice(paymentStatus, paymentStatuses);
  if (paymentError) errors.paymentStatus = paymentError;
  if (!amount.ok || paymentError) return { ok: false, errors };
  return { ok: true, input: { contractValue: amount.value, paymentStatus } };
}
