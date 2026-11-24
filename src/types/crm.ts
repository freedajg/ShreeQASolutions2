// Screen types for Pipeline and Clients (Phase 2, step 2-b). Built from a status-view row
// (`StatusViewRow` in src/lib/data/queries.ts) by src/lib/data/mappers.ts.
// Not the MVP `Lead` / `Client` in src/types.ts: those stay for the hidden screens until each
// one is wired. Empty stays empty (null): nothing is filled in or guessed (CLAUDE.md rule 7).

/** Board columns, in the `pipeline` view's order (statuses in 20261003180745_lookups.sql). */
export const PIPELINE_COLUMNS = ['Lead', 'Proposal', 'On Hold'] as const;

export type PipelineStatus = (typeof PIPELINE_COLUMNS)[number];

/** The client columns every status-view row carries (`client_*`). */
export interface ClientDetails {
  id: string;
  code: string | null;
  name: string;
  industry: string | null;
  address: string | null;
  city: string | null;
  stateCountry: string | null;
  contactPerson: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  priority: string | null;
  doNotContact: boolean | null;
}

/** One piece of certification work for one client: one row of a status view. */
export interface Engagement {
  id: string;
  clientId: string;
  client: ClientDetails;
  certificationType: string | null;
  standardFramework: string | null;
  scope: string | null;
  status: string;
  statusSortOrder: number | null;
  initialEngagementDate: string | null;
  completionDate: string | null;
  certificateNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  certificationBody: string | null;
  surveillanceDueDate: string | null;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
  ownerId: string | null;
  leadSource: string | null;
  remarks: string | null;
  lastContactedOn: string | null;
  nextFollowUpOn: string | null;
  dateIsEstimated: boolean | null;
  // No contract value or payment status here (step 2-f): they come only from
  // `engagement_financials`, read separately for users with values access (useEngagementValues),
  // and are looked up by engagement id (valueDisplay in src/lib/data/mappers.ts).
}

/** A client with its engagements from one status view. */
export interface Client extends ClientDetails {
  engagements: Engagement[];
}

// What the add and edit forms write (Add and Edit, session 1). Text is trimmed and an empty
// field is null: nothing is filled in (CLAUDE.md rule 7). Dates are `YYYY-MM-DD`. Only columns
// the database lets the app write (20261006100000_clients_engagements_rls.sql lines 253–272).

/** A client's own columns (PRD §6.2 A–K, AC, plus do-not-contact). */
export interface ClientInput {
  clientCode: string | null;
  name: string;
  industry: string | null;
  address: string | null;
  city: string | null;
  stateCountry: string | null;
  contactPerson: string | null;
  designation: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  priority: string | null;
  doNotContact: boolean;
}

/** An engagement's columns (PRD §6.2 L–X, AA, AB, AD, plus the follow-up dates). */
export interface EngagementInput {
  clientId: string;
  certificationType: string | null;
  standardFramework: string | null;
  scope: string | null;
  status: string | null;
  initialEngagementDate: string | null;
  completionDate: string | null;
  certificateNumber: string | null;
  validFrom: string | null;
  validTo: string | null;
  certificationBody: string | null;
  surveillanceDueDate: string | null;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
  ownerId: string | null;
  leadSource: string | null;
  remarks: string | null;
  lastContactedOn: string | null;
  nextFollowUpOn: string | null;
}

/**
 * What an edit may change on an engagement: never its client, and never its status, which goes
 * through change_engagement_status() so it is checked and logged in one place.
 */
export type EngagementChanges = Partial<Omit<EngagementInput, 'clientId' | 'status'>>;

/**
 * Contract value and payment status, written only to `engagement_financials`. The one place a
 * currency will be added (next step); the amount itself carries no currency.
 */
export interface FinancialsInput {
  contractValue: number | null;
  paymentStatus: string | null;
}
