import { describe, expect, it, vi } from 'vitest';
import { MutationObserver, type QueryClient } from '@tanstack/react-query';
import type { DrishtiClient } from '../supabase/client';
import { DATA_MESSAGES, DataError } from './errors';
import { STATUS_VIEWS } from './keys';
import {
  STATUS_CHANGE_KEY,
  changeEngagementStatus,
  invalidateAfterStatusChange,
  statusChangeMutation,
} from './mutations';
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

// Runs the options the way useMutation does, without React (no React test tools installed).
function statusChange(client: DrishtiClient, queryClient: QueryClient) {
  const observer = new MutationObserver(queryClient, statusChangeMutation(client, queryClient));
  return observer.mutate({ engagementId: 'eng-1', newStatus: 'Proposal' });
}

const rpcCalls = (calls: unknown[][]) => calls.filter((call) => call[0] === 'rpc');

const pendingChanges = (queryClient: QueryClient) =>
  queryClient.getMutationCache().findAll({ mutationKey: STATUS_CHANGE_KEY, status: 'pending' });

describe('statusChangeMutation (the Pipeline drag, step 2-c)', () => {
  it('calls change_engagement_status once and refetches all five views', async () => {
    const queryClient = createQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { client, calls } = fakeRpcClient({ data: null, error: null, status: 204 });
    await statusChange(client, queryClient);
    expect(rpcCalls(calls)).toEqual([
      ['rpc', 'change_engagement_status', { p_engagement_id: 'eng-1', p_new_status: 'Proposal' }],
    ]);
    expect(spy).toHaveBeenCalledTimes(STATUS_VIEWS.length);
  });

  it('a refusal is not retried, shows the plain message, and still refetches', async () => {
    const queryClient = createQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { client, calls } = fakeRpcClient(
      refused('42501', "Engagement not found, or you can't change its status"),
    );
    const failure = statusChange(client, queryClient);
    await expect(failure).rejects.toMatchObject({
      kind: 'not-allowed',
      message: DATA_MESSAGES['not-allowed'],
    });
    expect(rpcCalls(calls)).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(STATUS_VIEWS.length);
  });

  it('a network failure is not retried either (queries would retry it; changes never do)', async () => {
    const queryClient = createQueryClient();
    const { client, calls } = fakeRpcClient({
      data: null,
      error: { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' },
      status: 0,
    });
    await expect(statusChange(client, queryClient)).rejects.toMatchObject({ kind: 'network' });
    expect(rpcCalls(calls)).toHaveLength(1);
  });

  it('stays pending until the refetch is done, so a moved card never flickers back', async () => {
    const queryClient = createQueryClient();
    let finishRefetch = () => {};
    const refetch = new Promise<void>((resolve) => {
      finishRefetch = resolve;
    });
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockReturnValue(refetch);
    const { client } = fakeRpcClient({ data: null, error: null, status: 204 });

    const done = statusChange(client, queryClient);
    await vi.waitFor(() => expect(spy).toHaveBeenCalled());
    expect(pendingChanges(queryClient)).toHaveLength(1);
    expect(pendingChanges(queryClient)[0].state.variables).toEqual({
      engagementId: 'eng-1',
      newStatus: 'Proposal',
    });

    finishRefetch();
    await done;
    expect(pendingChanges(queryClient)).toHaveLength(0);
  });

  it('writes nothing into the query cache', async () => {
    const queryClient = createQueryClient();
    const { client } = fakeRpcClient(refused('42501', 'new row violates row-level security'));
    await expect(statusChange(client, queryClient)).rejects.toBeInstanceOf(DataError);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
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
