// What Pipeline, Clients and the nav badges read (Phase 2, steps 2-b and 2-c). Pipeline reads
// the `pipeline` view since 2-c. Clients and owner names still use the sample rows in
// sampleRows.ts through the same mapping code as live rows, until 2-d switches
// useActiveClients to `activeClientsQuery` and 2-e useOwnerName to `teamMembersQuery`.
import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type Mutation,
} from '@tanstack/react-query';
import type { Client } from '../../types/crm';
import { useSignedInUser } from '../auth/context';
import { supabase, type DrishtiClient } from '../supabase/client';
import type { DataError } from './errors';
import { groupClients, toEngagements } from './mappers';
import { STATUS_CHANGE_KEY, statusChangeMutation, type StatusChange } from './mutations';
import { pipelineQuery } from './queries';
import { SAMPLE_ACTIVE_CLIENT_ROWS, SAMPLE_TEAM } from './sampleRows';

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

export function useActiveClients(): Client[] {
  return useMemo(() => groupClients(toEngagements(SAMPLE_ACTIVE_CLIENT_ROWS)), []);
}

/** Owner id → name; null when there's no owner or the id isn't on the team. */
export function useOwnerName(): (ownerId: string | null) => string | null {
  return useCallback(
    (ownerId) => SAMPLE_TEAM.find((member) => member.id === ownerId)?.fullName ?? null,
    [],
  );
}
