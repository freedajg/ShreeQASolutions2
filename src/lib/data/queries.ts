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
export type StatusViewRow = PublicSchema['Views']['pipeline']['Row'];
export type EngagementFinancialsRow = Pick<
  PublicSchema['Tables']['engagement_financials']['Row'],
  'engagement_id' | 'contract_value' | 'payment_status'
>;
export type TeamMemberRow = PublicSchema['Views']['team_members']['Row'];

// The five status views share these 43 columns (20261006120000_status_views.sql).
export const STATUS_VIEW_COLUMNS =
  'id, client_id, certification_type, standard_framework, scope, status, status_group, status_sort_order, initial_engagement_date, completion_date, certificate_number, valid_from, valid_to, certification_body, surveillance_due_date, last_audit_date, next_audit_date, owner_id, lead_source, remarks, last_contacted_on, next_follow_up_on, date_is_estimated, created_by, archived_at, created_at, updated_at, client_code, client_name, client_industry, client_address, client_city, client_state_country, client_contact_person, client_designation, client_email, client_phone, client_website, client_priority, client_do_not_contact, client_archived_at, contract_value, payment_status' as const;

export const FINANCIALS_COLUMNS = 'engagement_id, contract_value, payment_status' as const;

export const TEAM_MEMBER_COLUMNS = 'id, full_name, email, role, booking_link, active' as const;

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
 * Contract values and payment status. For a role without values access, RLS returns no rows:
 * that's an empty list, not an error.
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
