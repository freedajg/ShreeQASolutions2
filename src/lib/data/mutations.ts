// Changes made from the screens (Phase 2, step 2-a; the Pipeline drag uses it from 2-c).
import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { DrishtiClient } from '../supabase/client';
import { toDataError, type DataError } from './errors';
import { STATUS_VIEWS } from './keys';

/**
 * Moves an engagement to another status through change_engagement_status() (step 14). The
 * database checks the role, the status and the row rules, and writes the activity log.
 * Throws a DataError (e.g. kind 'not-allowed', 'same-status') when it refuses.
 */
export async function changeEngagementStatus(
  client: DrishtiClient,
  engagementId: string,
  newStatus: string,
): Promise<void> {
  const { error, status } = await client
    .rpc('change_engagement_status', {
      p_engagement_id: engagementId,
      p_new_status: newStatus,
    })
    .retry(false);
  if (error) throw toDataError(error, status);
}

/** A status change can move a row from one view to another, so all five are refetched. */
export async function invalidateAfterStatusChange(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    STATUS_VIEWS.map((view) => queryClient.invalidateQueries({ queryKey: [view] })),
  );
}

/**
 * What to refetch after a form saves (Add and Edit, session 1). Prefixes only (no user id), so
 * the list is refreshed whoever's cache holds it. A new or edited engagement can move between
 * views, and a client's details show on every view row and in the client list. Values are
 * refetched only when money was written.
 */
export function writeInvalidationKeys({ money }: { money: boolean }): string[] {
  return [...STATUS_VIEWS, 'clients', ...(money ? ['engagement_financials'] : [])];
}

/** Refetches after a save; the returned promise ends when the fresh rows are in the cache. */
export async function invalidateAfterWrite(
  queryClient: QueryClient,
  options: { money: boolean },
): Promise<void> {
  await Promise.all(
    writeInvalidationKeys(options).map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}

export type StatusChange = { engagementId: string; newStatus: string };

/** Finds the status changes still in progress (useMutationState). */
export const STATUS_CHANGE_KEY = ['change_engagement_status'] as const;

/**
 * Options for useMutation. Never retried (the client default, see queryClient.ts). onSettled
 * returns the refetch, so the change stays pending until the fresh rows are in the cache: the
 * board shows a pending move in its new column until then (step 2-c), and a refused move
 * goes back by itself. Nothing is written into the cache here.
 */
export const statusChangeMutation = (client: DrishtiClient, queryClient: QueryClient) =>
  mutationOptions<void, DataError, StatusChange>({
    mutationKey: STATUS_CHANGE_KEY,
    mutationFn: ({ engagementId, newStatus }) =>
      changeEngagementStatus(client, engagementId, newStatus),
    onSettled: () => invalidateAfterStatusChange(queryClient),
  });
