// Typed reads for the screens (Phase 2, step 2-a; used from 2-b on). Each function names its
// columns (no `*`, so a column added later isn't fetched by accident), turns off supabase-js's
// own retries (TanStack Query retries network errors; see queryClient.ts) and throws a
// DataError on failure. Row-level security decides which rows come back.
import { queryOptions } from '@tanstack/react-query';
import type { Database } from '../../types/database';
import type { DrishtiClient } from '../supabase/client';
import { toDataError } from './errors';
import { queryKeys } from './keys';

type PublicSchema = Database['public'];
/**
 * One status-view row as the app reads it: the views' columns without `contract_value` and
 * `payment_status` (step 2-f). Values come only from `engagement_financials`, read only for a
 * user with values access, so a view row can't carry a value into a screen.
 */
export type StatusViewRow = Omit<
  PublicSchema['Views']['pipeline']['Row'],
  'contract_value' | 'payment_status'
>;
export type EngagementFinancialsRow = Pick<
  PublicSchema['Tables']['engagement_financials']['Row'],
  'engagement_id' | 'contract_value' | 'payment_status'
>;
export type TeamMemberRow = PublicSchema['Views']['team_members']['Row'];
export type ClientRow = Pick<
  PublicSchema['Tables']['clients']['Row'],
  | 'id'
  | 'client_code'
  | 'name'
  | 'industry'
  | 'address'
  | 'city'
  | 'state_country'
  | 'contact_person'
  | 'designation'
  | 'email'
  | 'phone'
  | 'website'
  | 'priority'
  | 'do_not_contact'
  | 'archived_at'
  | 'updated_at'
>;
export type LookupRow = { code: string; sort_order: number; active: boolean };
export type StatusRow = Pick<
  PublicSchema['Tables']['statuses']['Row'],
  'code' | 'status_group' | 'sort_order'
>;

/** The forms' dropdown lists (20261003180745_lookups.sql), as the database returns them. */
export interface LookupRows {
  certificationTypes: LookupRow[];
  statuses: StatusRow[];
  leadSources: LookupRow[];
  priorities: LookupRow[];
  paymentStatuses: LookupRow[];
}

// The five status views share 43 columns (20261006120000_status_views.sql); the app reads 41 of
// them. `contract_value` and `payment_status` (lines 84–85, a left join on
// engagement_financials) are never requested here (step 2-f): values come from
// fetchEngagementFinancials only.
export const STATUS_VIEW_COLUMNS =
  'id, client_id, certification_type, standard_framework, scope, status, status_group, status_sort_order, initial_engagement_date, completion_date, certificate_number, valid_from, valid_to, certification_body, surveillance_due_date, last_audit_date, next_audit_date, owner_id, lead_source, remarks, last_contacted_on, next_follow_up_on, date_is_estimated, created_by, archived_at, created_at, updated_at, client_code, client_name, client_industry, client_address, client_city, client_state_country, client_contact_person, client_designation, client_email, client_phone, client_website, client_priority, client_do_not_contact, client_archived_at' as const;

export const FINANCIALS_COLUMNS = 'engagement_id, contract_value, payment_status' as const;

export const TEAM_MEMBER_COLUMNS = 'id, full_name, email, role, booking_link, active' as const;

// The client's own columns, plus updated_at for the "changed meanwhile" check on edit (the
// status views carry the engagement's updated_at, not the client's).
export const CLIENT_COLUMNS =
  'id, client_code, name, industry, address, city, state_country, contact_person, designation, email, phone, website, priority, do_not_contact, archived_at, updated_at' as const;

const LOOKUP_COLUMNS = 'code, sort_order, active' as const;
const STATUS_COLUMNS = 'code, status_group, sort_order' as const;

type ReadOptions = { signal?: AbortSignal };

/** Pipeline board: Lead, Proposal, On Hold. Archived rows are included; screens filter them. */
export async function fetchPipeline(
  client: DrishtiClient,
  { signal }: ReadOptions = {},
): Promise<StatusViewRow[]> {
  let query = client
    .from('pipeline')
    .select(STATUS_VIEW_COLUMNS)
    .order('status_sort_order')
    .order('client_name')
    .retry(false);
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query;
  if (error) throw toDataError(error, status);
  return data ?? [];
}

/** Clients list: Certified, Renewal Due, Completed. */
export async function fetchActiveClients(
  client: DrishtiClient,
  { signal }: ReadOptions = {},
): Promise<StatusViewRow[]> {
  let query = client
    .from('active_clients')
    .select(STATUS_VIEW_COLUMNS)
    .order('client_name')
    .order('status_sort_order')
    .retry(false);
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query;
  if (error) throw toDataError(error, status);
  return data ?? [];
}

/**
 * Contract values and payment status: the only source of values on screen (step 2-f). The app
 * asks only for a user with values access; for anyone else RLS would return no rows
 * (20261006100000_clients_engagements_rls.sql lines 400–402): an empty list, not an error.
 */
export async function fetchEngagementFinancials(
  client: DrishtiClient,
  engagementIds?: readonly string[],
  { signal }: ReadOptions = {},
): Promise<EngagementFinancialsRow[]> {
  let query = client.from('engagement_financials').select(FINANCIALS_COLUMNS).retry(false);
  if (engagementIds) query = query.in('engagement_id', [...engagementIds]);
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query;
  if (error) throw toDataError(error, status);
  return data ?? [];
}

/** Everyone on the team (names for owners, the team screen). */
export async function fetchTeamMembers(
  client: DrishtiClient,
  { signal }: ReadOptions = {},
): Promise<TeamMemberRow[]> {
  let query = client
    .from('team_members')
    .select(TEAM_MEMBER_COLUMNS)
    .order('full_name')
    .retry(false);
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query;
  if (error) throw toDataError(error, status);
  return data ?? [];
}

/**
 * Every client the caller may read (Owners and Consultants: all; Marketing: lead clients and
 * its own new ones; rls.sql lines 277–292), for the Add Lead client picker and the client edit
 * form. Archived rows are included; screens filter them.
 */
export async function fetchClients(
  client: DrishtiClient,
  { signal }: ReadOptions = {},
): Promise<ClientRow[]> {
  let query = client.from('clients').select(CLIENT_COLUMNS).order('name').retry(false);
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query;
  if (error) throw toDataError(error, status);
  return data ?? [];
}

/**
 * The five dropdown lists, read together (every role-holder may read them; lookups.sql lines
 * 156–195). Inactive values are included here and dropped by the mappers, so an edit form can
 * still show a value that has since been retired.
 */
export async function fetchLookups(
  client: DrishtiClient,
  { signal }: ReadOptions = {},
): Promise<LookupRows> {
  const rowsOf = async <T>(
    query: PromiseLike<{ data: T[] | null; error: unknown; status: number }>,
  ): Promise<T[]> => {
    const { data, error, status } = await query;
    if (error) throw toDataError(error, status);
    return data ?? [];
  };
  const withSignal = <Q extends { abortSignal: (s: AbortSignal) => Q }>(query: Q): Q =>
    signal ? query.abortSignal(signal) : query;
  const lookup = (
    table: 'certification_types' | 'lead_sources' | 'priorities' | 'payment_statuses',
  ) => withSignal(client.from(table).select(LOOKUP_COLUMNS).order('sort_order').retry(false));

  const [certificationTypes, statuses, leadSources, priorities, paymentStatuses] =
    await Promise.all([
      rowsOf<LookupRow>(lookup('certification_types')),
      rowsOf<StatusRow>(
        withSignal(client.from('statuses').select(STATUS_COLUMNS).order('sort_order').retry(false)),
      ),
      rowsOf<LookupRow>(lookup('lead_sources')),
      rowsOf<LookupRow>(lookup('priorities')),
      rowsOf<LookupRow>(lookup('payment_statuses')),
    ]);
  return { certificationTypes, statuses, leadSources, priorities, paymentStatuses };
}

// Ready-made options for useQuery, e.g. useQuery(pipelineQuery(supabase, user.id)).

export const pipelineQuery = (client: DrishtiClient, userId: string) =>
  queryOptions({
    queryKey: queryKeys.pipeline(userId),
    queryFn: ({ signal }) => fetchPipeline(client, { signal }),
  });

export const activeClientsQuery = (client: DrishtiClient, userId: string) =>
  queryOptions({
    queryKey: queryKeys.activeClients(userId),
    queryFn: ({ signal }) => fetchActiveClients(client, { signal }),
  });

export const engagementFinancialsQuery = (
  client: DrishtiClient,
  userId: string,
  engagementIds?: readonly string[],
) =>
  queryOptions({
    queryKey: queryKeys.engagementFinancials(userId, engagementIds),
    queryFn: ({ signal }) => fetchEngagementFinancials(client, engagementIds, { signal }),
  });

export const teamMembersQuery = (client: DrishtiClient, userId: string) =>
  queryOptions({
    queryKey: queryKeys.teamMembers(userId),
    queryFn: ({ signal }) => fetchTeamMembers(client, { signal }),
  });

export const clientsQuery = (client: DrishtiClient, userId: string) =>
  queryOptions({
    queryKey: queryKeys.clients(userId),
    queryFn: ({ signal }) => fetchClients(client, { signal }),
  });

export const lookupsQuery = (client: DrishtiClient, userId: string) =>
  queryOptions({
    queryKey: queryKeys.lookups(userId),
    queryFn: ({ signal }) => fetchLookups(client, { signal }),
  });
