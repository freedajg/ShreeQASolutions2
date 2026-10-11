// Changes made from the screens (Phase 2, step 2-a; the Pipeline drag uses it in 2-c).
import type { QueryClient } from '@tanstack/react-query';
import type { DrishtiClient } from '../supabase/client';
import { toDataError } from './errors';
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
