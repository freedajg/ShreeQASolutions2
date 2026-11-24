import { describe, expect, it, vi } from 'vitest';
import { QueryObserver } from '@tanstack/react-query';
import { SAMPLE_ACTIVE_CLIENT_ROWS } from '../../../tests/support/activeClientRows';
import { SAMPLE_PIPELINE_ROWS } from '../../../tests/support/pipelineRows';
import type { DrishtiClient } from '../supabase/client';
import { DataError } from './errors';
import { queryKeys } from './keys';
import { toClients, toEngagements, toTeamNames } from './mappers';
import { createQueryClient } from './queryClient';
import {
  FINANCIALS_COLUMNS,
  STATUS_VIEW_COLUMNS,
  TEAM_MEMBER_COLUMNS,
  activeClientsQuery,
  engagementFinancialsQuery,
  fetchActiveClients,
  fetchEngagementFinancials,
  fetchPipeline,
  fetchTeamMembers,
  pipelineQuery,
  teamMembersQuery,
} from './queries';

type Result = { data: unknown; error: unknown; status: number };

/** A stand-in for supabase-js: records every builder call and resolves to `result`. */
function fakeClient(result: Result) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'in', 'retry', 'abortSignal']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
  };
  return { client: client as unknown as DrishtiClient, calls };
}

const ok = (data: unknown): Result => ({ data, error: null, status: 200 });
const USER = 'aaaaaaaa-0000-4000-8000-000000000001';

describe('status view reads', () => {
  it('fetchPipeline reads the pipeline view with named columns and no supabase-js retry', async () => {
    const rows = [{ id: '1', status: 'Lead' }];
    const { client, calls } = fakeClient(ok(rows));
    await expect(fetchPipeline(client)).resolves.toEqual(rows);
    expect(calls).toEqual([
      ['from', 'pipeline'],
      ['select', STATUS_VIEW_COLUMNS],
      ['order', 'status_sort_order'],
      ['order', 'client_name'],
      ['retry', false],
    ]);
    expect(STATUS_VIEW_COLUMNS).not.toContain('*');
    expect(STATUS_VIEW_COLUMNS.split(', ')).toHaveLength(41);
  });

  it('never asks a status view for values: they come only from engagement_financials (step 2-f)', () => {
    const columns = STATUS_VIEW_COLUMNS.split(', ');
    expect(columns).not.toContain('contract_value');
    expect(columns).not.toContain('payment_status');
    expect(FINANCIALS_COLUMNS).toBe('engagement_id, contract_value, payment_status');
  });

  it('fetchActiveClients reads the active_clients view', async () => {
    const { client, calls } = fakeClient(ok([]));
    await expect(fetchActiveClients(client)).resolves.toEqual([]);
    expect(calls[0]).toEqual(['from', 'active_clients']);
    expect(calls[1]).toEqual(['select', STATUS_VIEW_COLUMNS]);
    expect(calls).toContainEqual(['retry', false]);
  });

  it('passes the abort signal on when given', async () => {
    const { client, calls } = fakeClient(ok([]));
    const signal = new AbortController().signal;
    await fetchPipeline(client, { signal });
    expect(calls).toContainEqual(['abortSignal', signal]);
  });
});

describe('fetchEngagementFinancials', () => {
  it('returns the rows RLS allows', async () => {
    const rows = [{ engagement_id: 'e1', contract_value: 100000, payment_status: 'Paid' }];
    const { client, calls } = fakeClient(ok(rows));
    await expect(fetchEngagementFinancials(client)).resolves.toEqual(rows);
    expect(calls).toEqual([
      ['from', 'engagement_financials'],
      ['select', FINANCIALS_COLUMNS],
      ['retry', false],
    ]);
  });

  it('returns an empty list, not an error, for a role without values access', async () => {
    const { client } = fakeClient(ok([]));
    await expect(fetchEngagementFinancials(client)).resolves.toEqual([]);
  });

  it('filters by engagement id only when ids are given', async () => {
    const { client, calls } = fakeClient(ok([]));
    await fetchEngagementFinancials(client, ['e1', 'e2']);
    expect(calls).toContainEqual(['in', 'engagement_id', ['e1', 'e2']]);
  });
});

describe('fetchTeamMembers', () => {
  it('reads team_members with named columns', async () => {
    const { client, calls } = fakeClient(ok([]));
    await fetchTeamMembers(client);
    expect(calls[0]).toEqual(['from', 'team_members']);
    expect(calls[1]).toEqual(['select', TEAM_MEMBER_COLUMNS]);
    expect(calls).toContainEqual(['retry', false]);
  });
});

describe('errors from reads', () => {
  it('throws a DataError with the mapped kind', async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' },
      status: 0,
    });
    const failure = fetchPipeline(client);
    await expect(failure).rejects.toBeInstanceOf(DataError);
    await expect(failure).rejects.toMatchObject({ kind: 'network' });
  });

  it('maps a 401 response to a session error', async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: 'PGRST303', message: 'JWT expired', details: '', hint: '' },
      status: 401,
    });
    await expect(fetchTeamMembers(client)).rejects.toMatchObject({ kind: 'session' });
  });
});

describe('query keys and options', () => {
  it('include the user id, so two users never share a cache entry', () => {
    expect(queryKeys.pipeline(USER)).toEqual(['pipeline', USER]);
    expect(queryKeys.pipeline(USER)).not.toEqual(queryKeys.pipeline('someone-else'));
    expect(queryKeys.teamMembers(USER)).toEqual(['team_members', USER]);
    expect(queryKeys.engagementFinancials(USER, ['b', 'a'])).toEqual([
      'engagement_financials',
      USER,
      ['a', 'b'],
    ]);
  });

  it('engagementFinancialsQuery uses the user-scoped key and reads every row RLS allows (step 2-f)', async () => {
    const { client, calls } = fakeClient(ok([]));
    const options = engagementFinancialsQuery(client, USER);
    expect(options.queryKey).toEqual(['engagement_financials', USER]);
    const queryFn = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
    await queryFn({ signal: new AbortController().signal });
    expect(calls[0]).toEqual(['from', 'engagement_financials']);
    expect(calls.some(([method]) => method === 'in')).toBe(false);
  });

  it('pipelineQuery uses the key and reads the pipeline view', async () => {
    const { client, calls } = fakeClient(ok([]));
    const options = pipelineQuery(client, USER);
    expect(options.queryKey).toEqual(['pipeline', USER]);
    const queryFn = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
    await queryFn({ signal: new AbortController().signal });
    expect(calls[0]).toEqual(['from', 'pipeline']);
  });

  it('the board (pipelineQuery + toEngagements, as usePipelineEngagements) caches the raw rows and maps them', async () => {
    const queryClient = createQueryClient();
    const { client } = fakeClient(ok(SAMPLE_PIPELINE_ROWS));
    const observer = new QueryObserver(queryClient, {
      ...pipelineQuery(client, USER),
      select: toEngagements,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBeDefined());
      // 8 rows from the view; the archived one is left out on screen, so 7 on the board.
      expect(queryClient.getQueryData(['pipeline', USER])).toHaveLength(8);
      expect(observer.getCurrentResult().data?.map((e) => e.client.name)).toEqual(
        toEngagements(SAMPLE_PIPELINE_ROWS).map((e) => e.client.name),
      );
      expect(observer.getCurrentResult().data).toHaveLength(7);
    } finally {
      unsubscribe();
    }
  });

  it('activeClientsQuery uses the key and reads the active_clients view (step 2-d)', async () => {
    const { client, calls } = fakeClient(ok([]));
    const options = activeClientsQuery(client, USER);
    expect(options.queryKey).toEqual(['active_clients', USER]);
    const queryFn = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
    await queryFn({ signal: new AbortController().signal });
    expect(calls[0]).toEqual(['from', 'active_clients']);
  });

  it('the Clients list (activeClientsQuery + toClients, as useActiveClients) caches the raw rows and groups them', async () => {
    const queryClient = createQueryClient();
    const { client } = fakeClient(ok(SAMPLE_ACTIVE_CLIENT_ROWS));
    const observer = new QueryObserver(queryClient, {
      ...activeClientsQuery(client, USER),
      select: toClients,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBeDefined());
      // 7 engagement rows from the view, grouped into 5 clients in name order.
      expect(queryClient.getQueryData(['active_clients', USER])).toHaveLength(7);
      const clients = observer.getCurrentResult().data;
      expect(clients).toHaveLength(5);
      expect(clients?.map((c) => c.name)).toEqual(
        toClients(SAMPLE_ACTIVE_CLIENT_ROWS).map((c) => c.name),
      );
      expect(clients?.map((c) => c.engagements.length)).toEqual([1, 2, 1, 2, 1]);
    } finally {
      unsubscribe();
    }
  });

  it('owner names (teamMembersQuery + toTeamNames, as useOwnerName) cache the raw rows and map them (step 2-e)', async () => {
    const row = { email: null, role: 'owner', booking_link: null, active: true };
    const rows = [
      { ...row, id: 'u1', full_name: 'Demo Owner 1' },
      { ...row, id: 'u2', full_name: 'Demo Owner 2' },
    ];
    const queryClient = createQueryClient();
    const { client, calls } = fakeClient(ok(rows));
    const observer = new QueryObserver(queryClient, {
      ...teamMembersQuery(client, USER),
      select: toTeamNames,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toBeDefined());
      expect(calls[0]).toEqual(['from', 'team_members']);
      expect(queryClient.getQueryData(['team_members', USER])).toEqual(rows);
      expect(observer.getCurrentResult().data?.get('u2')).toBe('Demo Owner 2');
    } finally {
      unsubscribe();
    }
  });
});
