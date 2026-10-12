// What Pipeline, Clients and the nav badges read (Phase 2, steps 2-b to 2-d). Pipeline reads
// the `pipeline` view since 2-c, Clients the `active_clients` view since 2-d. Owner names
// still use the sample team in sampleRows.ts until 2-e switches useOwnerName to
// `teamMembersQuery`.
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
import { toClients, toEngagements } from './mappers';
import { STATUS_CHANGE_KEY, statusChangeMutation, type StatusChange } from './mutations';
import { activeClientsQuery, pipelineQuery } from './queries';
import { SAMPLE_TEAM } from './sampleRows';

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

/** Owner id → name; null when there's no owner or the id isn't on the team. */
export function useOwnerName(): (ownerId: string | null) => string | null {
  return useCallback(
    (ownerId) => SAMPLE_TEAM.find((member) => member.id === ownerId)?.fullName ?? null,
    [],
  );
}
