// What Pipeline, Clients and the nav badges read (Phase 2, step 2-b). For now these return the
// sample rows in sampleRows.ts through the same mapping code as live rows; 2-c switches
// usePipelineEngagements to `pipelineQuery`, 2-d useActiveClients to `activeClientsQuery`, and
// 2-e useOwnerName to `teamMembersQuery`, without the screens changing.
import { useCallback, useMemo } from 'react';
import type { Client, Engagement } from '../../types/crm';
import { groupClients, toEngagements } from './mappers';
import { SAMPLE_ACTIVE_CLIENT_ROWS, SAMPLE_PIPELINE_ROWS, SAMPLE_TEAM } from './sampleRows';

export function usePipelineEngagements(): Engagement[] {
  return useMemo(() => toEngagements(SAMPLE_PIPELINE_ROWS), []);
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
