import { describe, expect, it } from 'vitest';
import type { DrishtiClient } from '../supabase/client';
import { clearQueryCache, shouldClearCache, userIdOf } from './cache';
import { activeClientsQuery, pipelineQuery, teamMembersQuery } from './queries';
import { createQueryClient } from './queryClient';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

/**
 * A stand-in for supabase-js reads. Each read answers `rowsFor()` (asked at read time), or
 * with `hang`, never answers until its abort signal fires. Counts the reads.
 */
function fakeReads(rowsFor: () => unknown[], { hang = false } = {}) {
  const reads = { count: 0, signals: [] as AbortSignal[] };
  const client = {
    from: () => {
      reads.count += 1;
      let signal: AbortSignal | undefined;
      const builder = {
        select: () => builder,
        order: () => builder,
        retry: () => builder,
        abortSignal: (s: AbortSignal) => {
          signal = s;
          reads.signals.push(s);
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          (hang
            ? new Promise((_, fail) =>
                signal?.addEventListener('abort', () => fail(new Error('aborted'))),
              )
            : Promise.resolve({ data: rowsFor(), error: null, status: 200 })
          ).then(resolve, reject),
      };
      return builder;
    },
  };
  return { client: client as unknown as DrishtiClient, reads };
}

describe('shouldClearCache', () => {
  it('does nothing on the first decision or when the user stays the same', () => {
    expect(shouldClearCache(undefined, A)).toBe(false);
    expect(shouldClearCache(undefined, null)).toBe(false);
    expect(shouldClearCache(A, A)).toBe(false);
    expect(shouldClearCache(null, null)).toBe(false);
  });

  it('clears on sign-out, on sign-in after a sign-out and when another user takes over', () => {
    expect(shouldClearCache(A, null)).toBe(true);
    expect(shouldClearCache(null, B)).toBe(true);
    expect(shouldClearCache(A, B)).toBe(true);
  });
});

describe('userIdOf', () => {
  it('reads the user id only when signed in', () => {
    const user = { id: A, fullName: 'Demo Owner 1', role: 'owner' as const, canSeeValues: true };
    expect(userIdOf({ status: 'signed-in', user })).toBe(A);
    expect(userIdOf({ status: 'signed-out' })).toBeNull();
    expect(userIdOf({ status: 'signed-out', notice: 'x' })).toBeNull();
    expect(userIdOf({ status: 'not-configured', problem: 'x' })).toBeNull();
    expect(userIdOf({ status: 'loading' })).toBeUndefined();
  });
});

describe('clearQueryCache', () => {
  it('removes every cached entry', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['pipeline', A], [{ id: '1' }]);
    queryClient.setQueryData(['team_members', A], [{ id: A }]);
    await clearQueryCache(queryClient);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryData(['pipeline', A])).toBeUndefined();
  });
});

describe('the Pipeline board when the user changes (step 2-c)', () => {
  it("user B never gets user A's cached rows, and A's rows are gone after the clear", async () => {
    const queryClient = createQueryClient();
    let rows: unknown[] = [{ id: 'seen-by-A' }];
    const { client, reads } = fakeReads(() => rows);

    await queryClient.fetchQuery(pipelineQuery(client, A));
    expect(queryClient.getQueryData(['pipeline', A])).toEqual([{ id: 'seen-by-A' }]);

    await clearQueryCache(queryClient); // what QueryCacheGuard does on A → B
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    rows = [{ id: 'seen-by-B' }];
    await expect(queryClient.fetchQuery(pipelineQuery(client, B))).resolves.toEqual([
      { id: 'seen-by-B' },
    ]);
    expect(reads.count).toBe(2); // B read the database; nothing came from A's entry
    expect(queryClient.getQueryData(['pipeline', A])).toBeUndefined();
  });

  it("a read still in flight is stopped by the clear and doesn't refill A's entry", async () => {
    const queryClient = createQueryClient();
    const { client, reads } = fakeReads(() => [], { hang: true });

    const inFlight = queryClient.fetchQuery(pipelineQuery(client, A)).catch(() => 'stopped');
    await clearQueryCache(queryClient);

    await expect(inFlight).resolves.toBe('stopped');
    expect(reads.signals[0]?.aborted).toBe(true);
    expect(queryClient.getQueryData(['pipeline', A])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('the Clients list when the user changes (step 2-d)', () => {
  it("user B never gets user A's cached clients, and A's rows are gone after the clear", async () => {
    const queryClient = createQueryClient();
    let rows: unknown[] = [{ id: 'seen-by-A' }];
    const { client, reads } = fakeReads(() => rows);

    await queryClient.fetchQuery(activeClientsQuery(client, A));
    expect(queryClient.getQueryData(['active_clients', A])).toEqual([{ id: 'seen-by-A' }]);

    await clearQueryCache(queryClient); // what QueryCacheGuard does on A → B
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    rows = [{ id: 'seen-by-B' }];
    await expect(queryClient.fetchQuery(activeClientsQuery(client, B))).resolves.toEqual([
      { id: 'seen-by-B' },
    ]);
    expect(reads.count).toBe(2); // B read the database; nothing came from A's entry
    expect(queryClient.getQueryData(['active_clients', A])).toBeUndefined();
  });

  it("a read still in flight is stopped by the clear and doesn't refill A's entry", async () => {
    const queryClient = createQueryClient();
    const { client, reads } = fakeReads(() => [], { hang: true });

    const inFlight = queryClient.fetchQuery(activeClientsQuery(client, A)).catch(() => 'stopped');
    await clearQueryCache(queryClient);

    await expect(inFlight).resolves.toBe('stopped');
    expect(reads.signals[0]?.aborted).toBe(true);
    expect(queryClient.getQueryData(['active_clients', A])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('one clear removes the Pipeline and the Clients entries together', async () => {
    const queryClient = createQueryClient();
    const { client } = fakeReads(() => [{ id: 'seen-by-A' }]);
    await queryClient.fetchQuery(pipelineQuery(client, A));
    await queryClient.fetchQuery(activeClientsQuery(client, A));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(2);

    await clearQueryCache(queryClient);

    expect(queryClient.getQueryData(['pipeline', A])).toBeUndefined();
    expect(queryClient.getQueryData(['active_clients', A])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('owner names when the user changes (step 2-e)', () => {
  it("user B never gets user A's cached team list, and A's entry is gone after the clear", async () => {
    const queryClient = createQueryClient();
    let rows: unknown[] = [{ id: 'seen-by-A' }];
    const { client, reads } = fakeReads(() => rows);

    await queryClient.fetchQuery(teamMembersQuery(client, A));
    expect(queryClient.getQueryData(['team_members', A])).toEqual([{ id: 'seen-by-A' }]);

    await clearQueryCache(queryClient); // what QueryCacheGuard does on A → B
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

    rows = [{ id: 'seen-by-B' }];
    await expect(queryClient.fetchQuery(teamMembersQuery(client, B))).resolves.toEqual([
      { id: 'seen-by-B' },
    ]);
    expect(reads.count).toBe(2); // B read the database; nothing came from A's entry
    expect(queryClient.getQueryData(['team_members', A])).toBeUndefined();
  });

  it("a team read still in flight is stopped by the clear and doesn't refill A's entry", async () => {
    const queryClient = createQueryClient();
    const { client, reads } = fakeReads(() => [], { hang: true });

    const inFlight = queryClient.fetchQuery(teamMembersQuery(client, A)).catch(() => 'stopped');
    await clearQueryCache(queryClient);

    await expect(inFlight).resolves.toBe('stopped');
    expect(reads.signals[0]?.aborted).toBe(true);
    expect(queryClient.getQueryData(['team_members', A])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('one clear removes the Pipeline, Clients and owner-name entries together', async () => {
    const queryClient = createQueryClient();
    const { client } = fakeReads(() => [{ id: 'seen-by-A' }]);
    await queryClient.fetchQuery(pipelineQuery(client, A));
    await queryClient.fetchQuery(activeClientsQuery(client, A));
    await queryClient.fetchQuery(teamMembersQuery(client, A));
    expect(queryClient.getQueryCache().getAll()).toHaveLength(3);

    await clearQueryCache(queryClient);

    expect(queryClient.getQueryData(['pipeline', A])).toBeUndefined();
    expect(queryClient.getQueryData(['active_clients', A])).toBeUndefined();
    expect(queryClient.getQueryData(['team_members', A])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
