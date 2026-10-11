import { describe, expect, it } from 'vitest';
import type { DrishtiClient } from '../supabase/client';
import { DataError } from './errors';
import { queryKeys } from './keys';
import {
  FINANCIALS_COLUMNS,
  STATUS_VIEW_COLUMNS,
  TEAM_MEMBER_COLUMNS,
  fetchActiveClients,
  fetchEngagementFinancials,
  fetchPipeline,
  fetchTeamMembers,
  pipelineQuery,
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
    expect(STATUS_VIEW_COLUMNS.split(', ')).toHaveLength(43);
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

  it('pipelineQuery uses the key and reads the pipeline view', async () => {
    const { client, calls } = fakeClient(ok([]));
    const options = pipelineQuery(client, USER);
    expect(options.queryKey).toEqual(['pipeline', USER]);
    const queryFn = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
    await queryFn({ signal: new AbortController().signal });
    expect(calls[0]).toEqual(['from', 'pipeline']);
  });
});
