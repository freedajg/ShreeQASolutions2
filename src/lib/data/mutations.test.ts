import { describe, expect, it, vi } from 'vitest';
import type { DrishtiClient } from '../supabase/client';
import { DataError } from './errors';
import { STATUS_VIEWS } from './keys';
import { changeEngagementStatus, invalidateAfterStatusChange } from './mutations';
import { createQueryClient } from './queryClient';

type Result = { data: unknown; error: unknown; status: number };

/** A stand-in for supabase-js `rpc()`: records the call and resolves to `result`. */
function fakeRpcClient(result: Result) {
  const calls: unknown[][] = [];
  const builder = {
    retry: (enabled: boolean) => {
      calls.push(['retry', enabled]);
      return builder;
    },
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  const client = {
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return builder;
    },
  };
  return { client: client as unknown as DrishtiClient, calls };
}

const refused = (code: string, message: string): Result => ({
  data: null,
  error: { code, message, details: '', hint: '' },
  status: 403,
});

describe('changeEngagementStatus', () => {
  it('calls change_engagement_status with the named arguments, without supabase-js retry', async () => {
    const { client, calls } = fakeRpcClient({ data: null, error: null, status: 204 });
    await expect(changeEngagementStatus(client, 'eng-1', 'Proposal')).resolves.toBeUndefined();
    expect(calls).toEqual([
      ['rpc', 'change_engagement_status', { p_engagement_id: 'eng-1', p_new_status: 'Proposal' }],
      ['retry', false],
    ]);
  });

  it('throws the matching DataError for each database refusal', async () => {
    const cases: [Result, string][] = [
      [refused('42501', "You don't have access to change statuses"), 'no-access'],
      [refused('22023', 'Unknown status'), 'unknown-status'],
      [refused('42501', "Engagement not found, or you can't change its status"), 'not-allowed'],
      [refused('22023', 'The engagement already has that status'), 'same-status'],
      [
        refused('42501', 'new row violates row-level security policy for table "engagements"'),
        'rls',
      ],
    ];
    for (const [result, kind] of cases) {
      const { client } = fakeRpcClient(result);
      const failure = changeEngagementStatus(client, 'eng-1', 'Certified');
      await expect(failure).rejects.toBeInstanceOf(DataError);
      await expect(failure).rejects.toMatchObject({ kind });
    }
  });
});

describe('invalidateAfterStatusChange', () => {
  it('invalidates all five status views', async () => {
    const queryClient = createQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await invalidateAfterStatusChange(queryClient);
    expect(spy).toHaveBeenCalledTimes(5);
    for (const view of STATUS_VIEWS) {
      expect(spy).toHaveBeenCalledWith({ queryKey: [view] });
    }
  });
});
