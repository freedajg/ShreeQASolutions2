// Status-view rows → the screen types in src/types/crm.ts (Phase 2, step 2-b).
// The generated view types allow every column to be empty, so a row missing what an
// engagement can't exist without (its id, client, client name, status) is dropped. Archived
// engagements and archived clients are left out here, once, for every screen.
// Nothing is filled in: an empty column stays null (CLAUDE.md rule 7).
import {
  PIPELINE_COLUMNS,
  type Client,
  type Engagement,
  type PipelineStatus,
} from '../../types/crm';
import type { EngagementFinancialsRow, StatusViewRow, TeamMemberRow } from './queries';

export function toEngagement(row: StatusViewRow): Engagement | null {
  if (!row.id || !row.client_id || !row.client_name || !row.status) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    client: {
      id: row.client_id,
      code: row.client_code,
      name: row.client_name,
      industry: row.client_industry,
      address: row.client_address,
      city: row.client_city,
      stateCountry: row.client_state_country,
      contactPerson: row.client_contact_person,
      designation: row.client_designation,
      email: row.client_email,
      phone: row.client_phone,
      website: row.client_website,
      priority: row.client_priority,
      doNotContact: row.client_do_not_contact,
    },
    certificationType: row.certification_type,
    standardFramework: row.standard_framework,
    scope: row.scope,
    status: row.status,
    statusSortOrder: row.status_sort_order,
    initialEngagementDate: row.initial_engagement_date,
    completionDate: row.completion_date,
    certificateNumber: row.certificate_number,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    certificationBody: row.certification_body,
    surveillanceDueDate: row.surveillance_due_date,
    lastAuditDate: row.last_audit_date,
    nextAuditDate: row.next_audit_date,
    ownerId: row.owner_id,
    leadSource: row.lead_source,
    remarks: row.remarks,
    lastContactedOn: row.last_contacted_on,
    nextFollowUpOn: row.next_follow_up_on,
    dateIsEstimated: row.date_is_estimated,
  };
}

/** Keeps the rows' order; drops incomplete and archived rows. */
export function toEngagements(rows: readonly StatusViewRow[]): Engagement[] {
  const result: Engagement[] = [];
  for (const row of rows) {
    if (row.archived_at || row.client_archived_at) continue;
    const engagement = toEngagement(row);
    if (engagement) result.push(engagement);
  }
  return result;
}

/** One client per `clientId`, sorted by name; each keeps its engagements in the given order. */
export function groupClients(engagements: readonly Engagement[]): Client[] {
  const byId = new Map<string, Client>();
  for (const engagement of engagements) {
    const existing = byId.get(engagement.clientId);
    if (existing) existing.engagements.push(engagement);
    else byId.set(engagement.clientId, { ...engagement.client, engagements: [engagement] });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en-IN'));
}

/** `active_clients` rows → clients with their engagements (archived left out). Step 2-d. */
export const toClients = (rows: readonly StatusViewRow[]): Client[] =>
  groupClients(toEngagements(rows));

export function isPipelineStatus(status: string): status is PipelineStatus {
  return (PIPELINE_COLUMNS as readonly string[]).includes(status);
}

/** Board columns; an engagement with any other status is on no column. */
export function groupByPipelineStatus(
  engagements: readonly Engagement[],
): Record<PipelineStatus, Engagement[]> {
  const columns = Object.fromEntries(
    PIPELINE_COLUMNS.map((s) => [s, [] as Engagement[]]),
  ) as Record<PipelineStatus, Engagement[]>;
  for (const engagement of engagements) {
    if (isPipelineStatus(engagement.status)) columns[engagement.status].push(engagement);
  }
  return columns;
}

// Values (step 2-f) come only from `engagement_financials`
// (20261006100000_clients_engagements_rls.sql lines 400–402: read only with
// app.can_see_values()). The status views' own value columns are never requested.

/** One engagement's financials as the screens use them. */
export interface EngagementValue {
  /** Rupees; null when not recorded. A recorded 0 stays 0. */
  amount: number | null;
  paymentStatus: string | null;
}

/** engagement id → its financials. */
export type EngagementValues = ReadonlyMap<string, EngagementValue>;

/**
 * A finite number, or a plain numeric string (PostgREST may send `numeric` as text, e.g.
 * "420000.00"); anything else is empty. Never NaN, so never a made-up "₹0".
 */
function toAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

/** `engagement_financials` rows → engagement id → value. A row without an id is dropped. */
export function toFinancials(rows: readonly EngagementFinancialsRow[]): EngagementValues {
  const values = new Map<string, EngagementValue>();
  for (const row of rows) {
    if (!row.engagement_id) continue;
    values.set(row.engagement_id, {
      amount: toAmount(row.contract_value as unknown),
      paymentStatus: row.payment_status ?? null,
    });
  }
  return values;
}

export type ValueDisplay =
  /** The signed-in user has no values access: render nothing, not even a dash or a column. */
  | { state: 'hidden' }
  /** Values not here yet, or the read failed: render nothing (no dash, no total). */
  | { state: 'loading' }
  /** Not recorded (no financials row, or a row with no amount): "—". */
  | { state: 'empty' }
  | { state: 'amount'; amount: number };

/** What to show for one engagement's value. */
export function valueDisplay(
  values: EngagementValues | undefined,
  canSeeValues: boolean,
  engagementId: string,
): ValueDisplay {
  if (!canSeeValues) return { state: 'hidden' };
  if (!values) return { state: 'loading' };
  const amount = values.get(engagementId)?.amount ?? null;
  return amount === null ? { state: 'empty' } : { state: 'amount', amount };
}

/**
 * Sum of the recorded amounts; null (nothing to show) when values are hidden or loading, or
 * none is recorded.
 */
export function sumValues(
  engagements: readonly Engagement[],
  values: EngagementValues | undefined,
  canSeeValues: boolean,
): number | null {
  let total: number | null = null;
  for (const { id } of engagements) {
    const shown = valueDisplay(values, canSeeValues, id);
    if (shown.state === 'amount') total = (total ?? 0) + shown.amount;
  }
  return total;
}

/** Nav badge: engagements on the board. */
export function countOnBoard(engagements: readonly Engagement[]): number {
  return engagements.filter((e) => isPipelineStatus(e.status)).length;
}

// Owner names (step 2-e) come from the `team_members` view: every profile, for any active
// user with a role (20261003161427_profiles_roles.sql lines 222–239).

/** `team_members` rows → id → full name. A row without an id is dropped; a blank name stays blank. */
export const toTeamNames = (rows: readonly TeamMemberRow[]): ReadonlyMap<string, string> => {
  const names = new Map<string, string>();
  for (const row of rows) {
    if (row.id) names.set(row.id, row.full_name?.trim() ?? '');
  }
  return names;
};

export const NO_OWNER = 'No owner';
export const UNKNOWN_OWNER = 'Unknown owner';
export const UNNAMED_MEMBER = 'Unnamed team member';

export type OwnerDisplay =
  /** The team list isn't here yet, or couldn't be read: show nothing. */
  | { state: 'loading' }
  | { state: 'none'; label: typeof NO_OWNER }
  | { state: 'unknown'; label: typeof UNKNOWN_OWNER }
  | { state: 'known'; label: string };

/**
 * What to show for an engagement's owner. No owner is known without the team list; an id
 * that isn't on the team says so (never "?"); a blank name is never filled in from elsewhere.
 */
export function ownerDisplay(
  team: ReadonlyMap<string, string> | undefined,
  ownerId: string | null,
): OwnerDisplay {
  if (ownerId === null) return { state: 'none', label: NO_OWNER };
  if (!team) return { state: 'loading' };
  const name = team.get(ownerId);
  if (name === undefined) return { state: 'unknown', label: UNKNOWN_OWNER };
  return { state: 'known', label: name || UNNAMED_MEMBER };
}

/** The text for an owner: empty while loading, otherwise the label. */
export const ownerText = (shown: OwnerDisplay): string =>
  shown.state === 'loading' ? '' : shown.label;

/**
 * Reports each unknown owner id once per page load (the id only: no name, no client).
 * Returns the function the hook calls; `log` is injectable for the unit tests.
 */
export function createUnknownOwnerReporter(
  log: (message: string, id: string) => void = (message, id) => console.warn(message, id),
): (id: string) => void {
  const reported = new Set<string>();
  return (id) => {
    if (reported.has(id)) return;
    reported.add(id);
    log('Owner id is not on the team:', id);
  };
}
