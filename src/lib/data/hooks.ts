// What Pipeline, Clients and the nav badges read (Phase 2, steps 2-b to 2-f). Pipeline reads
// the `pipeline` view since 2-c, Clients the `active_clients` view since 2-d, owner names the
// `team_members` view since 2-e, contract values `engagement_financials` since 2-f.
import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type Mutation,
} from '@tanstack/react-query';
import { useSignedInUser } from '../auth/context';
import { supabase, type DrishtiClient } from '../supabase/client';
import type { DataError } from './errors';
import type { Engagement } from '../../types/crm';
import {
  createUnknownOwnerReporter,
  ownerDisplay,
  sumValues,
  toClients,
  toEngagements,
  toFinancials,
  toOwnerChoices,
  toTeamNames,
  valueDisplay,
  type Choice,
  type OwnerDisplay,
  type ValueDisplay,
} from './mappers';
import {
  STATUS_CHANGE_KEY,
  invalidateAfterWrite,
  statusChangeMutation,
  type StatusChange,
} from './mutations';
import {
  activeClientsQuery,
  clientsQuery,
  engagementFinancialsQuery,
  lookupsQuery,
  pipelineQuery,
  teamMembersQuery,
  type ClientRow,
} from './queries';
import { saveLead, type LeadSaveError, type NewLead, type SavedLeadParts } from './writes';

// One per page load: each unknown owner id is logged once, however often it is shown.
const reportUnknownOwner = createUnknownOwnerReporter();

/** The browser client; only for components behind the sign-in gate, where it always exists. */
function useDataClient(): DrishtiClient {
  if (!supabase) throw new Error('The data hooks need a configured Supabase client');
  return supabase;
}

/**
 * The board's engagements for the signed-in user, from the `pipeline` view (step 2-c).
 * `data` is undefined while loading and when the first read fails. The cache holds the rows
 * as the database returned them; `select` maps them (memoized by TanStack).
 */
export function usePipelineEngagements() {
  const client = useDataClient();
  const { id: userId } = useSignedInUser();
  return useQuery({ ...pipelineQuery(client, userId), select: toEngagements });
}

/**
 * Moves an engagement through change_engagement_status(); never retried. `onError` is given
 * here, not to mutate(): mutate()'s own callbacks only fire for the latest call, so a refusal
 * could be missed after a quick second drag.
 */
export function useChangeEngagementStatus(onError: (error: DataError) => void) {
  const client = useDataClient();
  const queryClient = useQueryClient();
  return useMutation({ ...statusChangeMutation(client, queryClient), onError });
}

const changeOf = (mutation: Mutation<void, DataError, StatusChange>) => mutation.state.variables;

/** Status changes still in progress (saving, or waiting for the refetch), oldest first. */
export function usePendingStatusChanges(): StatusChange[] {
  const changes = useMutationState({
    filters: { mutationKey: STATUS_CHANGE_KEY, status: 'pending' },
    select: changeOf,
  });
  return useMemo(
    () => changes.filter((change): change is StatusChange => change !== undefined),
    [changes],
  );
}

/**
 * The Clients list for the signed-in user, from the `active_clients` view (step 2-d). Same
 * pattern as usePipelineEngagements: `data` is undefined while loading and when the first read
 * fails; the cache holds the raw rows and `select` groups them into clients. Marketing gets an
 * empty list (row-level security), not an error.
 */
export function useActiveClients() {
  const client = useDataClient();
  const { id: userId } = useSignedInUser();
  return useQuery({ ...activeClientsQuery(client, userId), select: toClients });
}

export interface EngagementValuesView {
  /** False: render no value, total, dash or value column at all. */
  canSeeValues: boolean;
  /** What to show for one engagement's value. */
  valueOf: (engagementId: string) => ValueDisplay;
  /** Sum of the recorded amounts; null when there is nothing to show. */
  totalOf: (engagements: readonly Engagement[]) => number | null;
}

/**
 * Contract values (step 2-f), only from `engagement_financials`. The read is sent only for a
 * user with values access (`enabled`); for anyone else no request leaves the browser and every
 * value is `hidden`. One cached read per user (the key holds the user id), every financials row
 * the user may see. While loading, or if the read fails, values are `loading` (nothing shown).
 */
export function useEngagementValues(): EngagementValuesView {
  const client = useDataClient();
  const { id: userId, canSeeValues } = useSignedInUser();
  const { data: values } = useQuery({
    ...engagementFinancialsQuery(client, userId),
    enabled: canSeeValues,
    select: toFinancials,
  });
  return useMemo(
    () => ({
      canSeeValues,
      valueOf: (engagementId) => valueDisplay(values, canSeeValues, engagementId),
      totalOf: (engagements) => sumValues(engagements, values, canSeeValues),
    }),
    [values, canSeeValues],
  );
}

// ---------------------------------------------------------------------------
// Add and Edit (session 2): the forms' lists and the Add Lead save.
// ---------------------------------------------------------------------------

/** The five dropdown lists (one cached read per user). `data` is undefined while loading. */
export function useLookups() {
  const client = useDataClient();
  const { id: userId } = useSignedInUser();
  return useQuery(lookupsQuery(client, userId));
}

const liveClients = (rows: ClientRow[]) => rows.filter((row) => !row.archived_at);

/** Clients the user may read, archived ones left out (Add Lead's client picker). */
export function useClientsList() {
  const client = useDataClient();
  const { id: userId } = useSignedInUser();
  return useQuery({ ...clientsQuery(client, userId), select: liveClients });
}

/**
 * Owner choices from `team_members` (active members with a role, by name), sharing the cached
 * team read with useOwnerName. `keep`: an owner the form already holds (see toOwnerChoices).
 */
export function useOwnerChoices(keep: string | null = null): Choice[] | undefined {
  const client = useDataClient();
  const { id: userId } = useSignedInUser();
  const { data } = useQuery(teamMembersQuery(client, userId));
  return useMemo(() => (data ? toOwnerChoices(data, keep) : undefined), [data, keep]);
}

export const ADD_LEAD_KEY = ['add_lead'] as const;

export interface AddLeadRequest {
  lead: NewLead;
  /** What an earlier try already saved, so Try again adds nothing twice. */
  saved: SavedLeadParts;
}

/**
 * Saves a new lead (client, engagement, contract value) through saveLead: three requests, never
 * retried. Afterwards, failed or not, the lists are read again (something may have been saved
 * part-way), and the mutation stays pending until they are in. Errors are LeadSaveErrors.
 */
export function useAddLead() {
  const client = useDataClient();
  const queryClient = useQueryClient();
  return useMutation<{ clientId: string; engagementId: string }, LeadSaveError, AddLeadRequest>({
    mutationKey: ADD_LEAD_KEY,
    mutationFn: ({ lead, saved }) => saveLead(client, lead, saved),
    retry: false,
    onSettled: (_data, _error, { lead }) =>
      invalidateAfterWrite(queryClient, { money: lead.financials !== null }),
  });
}

/**
 * Owner id → what to show (step 2-e), from the `team_members` view. One cached read per user
 * (the key holds the user id), shared by every screen. While loading, or if the read fails,
 * owners show nothing (`state: 'loading'`); an id not on the team shows "Unknown owner" and is
 * logged once.
 */
export function useOwnerName(): (ownerId: string | null) => OwnerDisplay {
  const client = useDataClient();
  const { id: userId } = useSignedInUser();
  const { data: team } = useQuery({ ...teamMembersQuery(client, userId), select: toTeamNames });
  return useCallback(
    (ownerId) => {
      const shown = ownerDisplay(team, ownerId);
      if (shown.state === 'unknown' && ownerId !== null) reportUnknownOwner(ownerId);
      return shown;
    },
    [team],
  );
}
