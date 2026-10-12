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
import type { StatusViewRow } from './queries';

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
    contractValue: row.contract_value,
    paymentStatus: row.payment_status,
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

/** Sum of the values present; null when none has a value (nothing to show). */
export function sumValues(engagements: readonly Engagement[]): number | null {
  let total: number | null = null;
  for (const { contractValue } of engagements) {
    if (contractValue !== null) total = (total ?? 0) + contractValue;
  }
  return total;
}

/** Nav badge: engagements on the board. */
export function countOnBoard(engagements: readonly Engagement[]): number {
  return engagements.filter((e) => isPipelineStatus(e.status)).length;
}
