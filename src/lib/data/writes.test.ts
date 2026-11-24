import { describe, expect, it } from 'vitest';
import type { ClientInput, EngagementInput } from '../../types/crm';
import type { DrishtiClient } from '../supabase/client';
import { DATA_MESSAGES, DataError } from './errors';
import {
  LeadSaveError,
  changedFields,
  insertClient,
  insertEngagement,
  saveFinancials,
  saveLead,
  toFinancialsWrite,
  updateClient,
  updateEngagement,
} from './writes';

type Result = { data: unknown; error: unknown; status: number };

/**
 * A stand-in for supabase-js `from()`: records every builder call per request and answers the
 * requests in order from `results`.
 */
function fakeClient(results: Result[]) {
  const requests: unknown[][][] = [];
  const queue = [...results];
  const client = {
    from: (table: string) => {
      const calls: unknown[][] = [['from', table]];
      requests.push(calls);
      const builder: Record<string, unknown> = {};
      for (const method of ['insert', 'update', 'select', 'single', 'eq', 'retry']) {
        builder[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return builder;
        };
      }
      builder.then = (resolve: (value: Result) => unknown, reject: (e: unknown) => unknown) => {
        const next = queue.shift();
        return next
          ? Promise.resolve(next).then(resolve, reject)
          : Promise.reject(new Error('no result queued'));
      };
      return builder;
    },
  };
  return { client: client as unknown as DrishtiClient, requests };
}

const ok = (data: unknown, status = 200): Result => ({ data, error: null, status });
const pg = (code: string, message: string, status = 400): Result => ({
  data: null,
  error: { code, message, details: '', hint: '' },
  status,
});
const callOf = (calls: unknown[][], method: string) => calls.find((c) => c[0] === method);

const CLIENT: ClientInput = {
  clientCode: null,
  name: 'Client01 Demo Ltd',
  industry: null,
  address: null,
  city: 'Pune',
  stateCountry: null,
  contactPerson: 'Contact 01',
  designation: null,
  email: null,
  phone: null,
  website: null,
  priority: null,
  doNotContact: false,
};

const ENGAGEMENT: Omit<EngagementInput, 'clientId'> = {
  certificationType: 'ISO 27001',
  standardFramework: null,
  scope: null,
  status: 'Lead',
  initialEngagementDate: null,
  completionDate: null,
  certificateNumber: null,
  validFrom: null,
  validTo: null,
  certificationBody: null,
  surveillanceDueDate: null,
  lastAuditDate: null,
  nextAuditDate: null,
  ownerId: 'owner-1',
  leadSource: null,
  remarks: null,
  lastContactedOn: null,
  nextFollowUpOn: null,
};

describe('insertClient / insertEngagement', () => {
  it('insertClient sends only the granted client columns, as snake_case, without retry', async () => {
    const { client, requests } = fakeClient([ok({ id: 'c-1', client_code: null }, 201)]);
    await expect(insertClient(client, CLIENT)).resolves.toEqual({ id: 'c-1', clientCode: null });
    const calls = requests[0];
    expect(calls[0]).toEqual(['from', 'clients']);
    expect(callOf(calls, 'insert')?.[1]).toEqual({
      client_code: null,
      name: 'Client01 Demo Ltd',
      industry: null,
      address: null,
      city: 'Pune',
      state_country: null,
      contact_person: 'Contact 01',
      designation: null,
      email: null,
      phone: null,
      website: null,
      priority: null,
      do_not_contact: false,
    });
    expect(callOf(calls, 'select')).toEqual(['select', 'id, client_code']);
    expect(callOf(calls, 'retry')).toEqual(['retry', false]);
  });

  it('insertClient turns a database refusal into a save message', async () => {
    const { client } = fakeClient([
      pg('23505', 'duplicate key value violates unique constraint "clients_client_code_key"', 409),
    ]);
    const failure = insertClient(client, { ...CLIENT, clientCode: 'SQAS-C001' });
    await expect(failure).rejects.toBeInstanceOf(DataError);
    await expect(failure).rejects.toMatchObject({
      kind: 'duplicate-code',
      message: DATA_MESSAGES['duplicate-code'],
    });
  });

  it('insertEngagement sends the granted columns only: no id, created_by or date_is_estimated', async () => {
    const { client, requests } = fakeClient([ok({ id: 'e-1' }, 201)]);
    await insertEngagement(client, { ...ENGAGEMENT, clientId: 'c-1' });
    const row = callOf(requests[0], 'insert')?.[1] as Record<string, unknown>;
    expect(requests[0][0]).toEqual(['from', 'engagements']);
    expect(row).toMatchObject({
      client_id: 'c-1',
      certification_type: 'ISO 27001',
      status: 'Lead',
      owner_id: 'owner-1',
    });
    expect(Object.keys(row)).toHaveLength(19);
    for (const column of ['id', 'created_by', 'created_at', 'updated_at', 'date_is_estimated']) {
      expect(row, column).not.toHaveProperty(column);
    }
  });
});

describe('updateClient / updateEngagement', () => {
  it('updateClient sends only the changes and matches both id and the loaded updated_at', async () => {
    const { client, requests } = fakeClient([ok([{ id: 'c-1', updated_at: 'T2' }])]);
    await expect(updateClient(client, 'c-1', { city: 'Mumbai' }, 'T1')).resolves.toBe('T2');
    const calls = requests[0];
    expect(callOf(calls, 'update')).toEqual(['update', { city: 'Mumbai' }]);
    expect(calls.filter((c) => c[0] === 'eq')).toEqual([
      ['eq', 'id', 'c-1'],
      ['eq', 'updated_at', 'T1'],
    ]);
    expect(callOf(calls, 'retry')).toEqual(['retry', false]);
  });

  it('an update that matches no row (changed meanwhile, or not editable) overwrites nothing and says so', async () => {
    const { client } = fakeClient([ok([]), ok([])]);
    await expect(updateClient(client, 'c-1', { city: 'Mumbai' }, 'T1')).rejects.toMatchObject({
      kind: 'changed-or-refused',
    });
    await expect(
      updateEngagement(client, 'e-1', { remarks: 'Called back' }, 'T1'),
    ).rejects.toMatchObject({ kind: 'changed-or-refused' });
  });

  it('a network failure while saving stays a network error, not a refused save', async () => {
    const { client } = fakeClient([pg('', 'TypeError: Failed to fetch', 0)]);
    await expect(updateClient(client, 'c-1', { city: 'Mumbai' }, 'T1')).rejects.toMatchObject({
      kind: 'network',
      message: DATA_MESSAGES.network,
    });
  });

  it('sends no request when nothing changed', async () => {
    const { client, requests } = fakeClient([]);
    await expect(updateClient(client, 'c-1', {}, 'T1')).resolves.toBe('T1');
    await expect(updateEngagement(client, 'e-1', {}, 'T1')).resolves.toBe('T1');
    expect(requests).toHaveLength(0);
  });

  it('updateEngagement never sends the status or the client, even if a caller passes them', async () => {
    const { client, requests } = fakeClient([ok([{ id: 'e-1', updated_at: 'T2' }])]);
    const sneaky = { remarks: 'Called back', status: 'Certified', clientId: 'c-9' };
    await updateEngagement(client, 'e-1', sneaky as never, 'T1');
    expect(callOf(requests[0], 'update')).toEqual(['update', { remarks: 'Called back' }]);
  });

  it('changedFields keeps only the fields whose value differs', () => {
    type Fields = {
      name: string;
      city: string | null;
      email: string | null;
      doNotContact: boolean;
    };
    const before: Fields = { name: 'A', city: null, email: 'a@x.in', doNotContact: false };
    const after: Fields = { name: 'A', city: 'Pune', email: null, doNotContact: false };
    expect(changedFields(before, after)).toEqual({ city: 'Pune', email: null });
    expect(changedFields(before, { ...before })).toEqual({});
  });
});

describe('saveFinancials', () => {
  it('inserts engagement_id, contract_value and payment_status when there is no row yet', async () => {
    const { client, requests } = fakeClient([ok(null, 201)]);
    await saveFinancials(client, 'e-1', { contractValue: 450000, paymentStatus: null }, false);
    expect(requests[0][0]).toEqual(['from', 'engagement_financials']);
    expect(callOf(requests[0], 'insert')).toEqual([
      'insert',
      { engagement_id: 'e-1', contract_value: 450000, payment_status: null },
    ]);
  });

  it('updates only contract_value and payment_status when the row exists (no upsert, no engagement_id)', async () => {
    const { client, requests } = fakeClient([ok([{ engagement_id: 'e-1' }])]);
    await saveFinancials(client, 'e-1', { contractValue: null, paymentStatus: 'Paid' }, true);
    expect(callOf(requests[0], 'update')).toEqual([
      'update',
      { contract_value: null, payment_status: 'Paid' },
    ]);
    expect(callOf(requests[0], 'eq')).toEqual(['eq', 'engagement_id', 'e-1']);
    expect(toFinancialsWrite({ contractValue: 1, paymentStatus: 'NA' })).toEqual({
      contract_value: 1,
      payment_status: 'NA',
    });
  });
});

describe('saveLead (Add Lead: three requests, answer Q2)', () => {
  it('saves client, engagement and financials in order; Try again sends only what is missing', async () => {
    const lead = {
      client: CLIENT,
      engagement: ENGAGEMENT,
      financials: { contractValue: 450000, paymentStatus: null },
    };
    const first = fakeClient([
      ok({ id: 'c-1', client_code: null }, 201),
      pg('42501', 'new row violates row-level security policy for table "engagements"', 403),
    ]);
    const failure = saveLead(first.client, lead);
    await expect(failure).rejects.toBeInstanceOf(LeadSaveError);
    await expect(failure).rejects.toMatchObject({
      step: 'engagement',
      saved: { clientId: 'c-1' },
      error: { kind: 'save-refused' },
    });

    const retry = fakeClient([ok({ id: 'e-1' }, 201), ok(null, 201)]);
    await expect(saveLead(retry.client, lead, { clientId: 'c-1' })).resolves.toEqual({
      clientId: 'c-1',
      engagementId: 'e-1',
    });
    expect(retry.requests.map((calls) => calls[0][1])).toEqual([
      'engagements',
      'engagement_financials',
    ]);
    expect(callOf(retry.requests[0], 'insert')?.[1]).toMatchObject({ client_id: 'c-1' });

    const existing = fakeClient([ok({ id: 'e-2' }, 201)]);
    await saveLead(existing.client, { ...lead, client: { existingId: 'c-7' }, financials: null });
    expect(existing.requests.map((calls) => calls[0][1])).toEqual(['engagements']);
  });
});
