import { describe, expect, it } from 'vitest';
import { PIPELINE_COLUMNS, type Engagement } from '../../types/crm';
import {
  countOnBoard,
  groupByPipelineStatus,
  groupClients,
  isPipelineStatus,
  sumValues,
  toClients,
  toEngagement,
  toEngagements,
} from './mappers';
import type { StatusViewRow } from './queries';
import { SAMPLE_PIPELINE_ROWS } from '../../../tests/support/pipelineRows';
import { SAMPLE_ACTIVE_CLIENT_ROWS } from '../../../tests/support/activeClientRows';

// A complete row with every column empty except what each test sets.
const EMPTY = Object.fromEntries(
  Object.keys(SAMPLE_PIPELINE_ROWS[0]).map((key) => [key, null]),
) as StatusViewRow;

function row(fields: Partial<StatusViewRow>): StatusViewRow {
  return {
    ...EMPTY,
    id: 'e-1',
    client_id: 'c-1',
    client_name: 'Client01 Demo Ltd',
    status: 'Lead',
    ...fields,
  };
}

function engagement(fields: Partial<StatusViewRow>): Engagement {
  const result = toEngagement(row(fields));
  if (!result) throw new Error('test row was dropped');
  return result;
}

describe('toEngagement', () => {
  it('maps every column to its screen field', () => {
    const e = engagement({
      certification_type: 'ISO 27001',
      standard_framework: 'DEV ML3',
      owner_id: 'o-1',
      lead_source: 'Referral',
      contract_value: 450000,
      last_contacted_on: '2026-09-15',
      valid_to: '2027-03-14',
      client_email: 'client01@example.com',
      client_contact_person: 'Contact 01',
      client_city: 'Pune',
    });
    expect(e).toMatchObject({
      id: 'e-1',
      clientId: 'c-1',
      status: 'Lead',
      certificationType: 'ISO 27001',
      standardFramework: 'DEV ML3',
      ownerId: 'o-1',
      leadSource: 'Referral',
      contractValue: 450000,
      lastContactedOn: '2026-09-15',
      validTo: '2027-03-14',
    });
    expect(e.client).toMatchObject({
      id: 'c-1',
      name: 'Client01 Demo Ltd',
      email: 'client01@example.com',
      contactPerson: 'Contact 01',
      city: 'Pune',
    });
  });

  it('leaves empty columns empty: no made-up email, phone, date, owner or value', () => {
    const e = engagement({});
    expect(e.client.email).toBeNull();
    expect(e.client.phone).toBeNull();
    expect(e.client.contactPerson).toBeNull();
    expect(e.lastContactedOn).toBeNull();
    expect(e.nextFollowUpOn).toBeNull();
    expect(e.validTo).toBeNull();
    expect(e.ownerId).toBeNull();
    expect(e.contractValue).toBeNull();
  });

  it('keeps a value of zero (it is a value, not an empty one)', () => {
    expect(engagement({ contract_value: 0 }).contractValue).toBe(0);
  });

  it('drops a row without an id, client, client name or status', () => {
    for (const missing of ['id', 'client_id', 'client_name', 'status'] as const) {
      expect(toEngagement(row({ [missing]: null }))).toBeNull();
    }
  });
});

describe('toEngagements', () => {
  it('keeps the order and leaves out archived engagements and archived clients', () => {
    const rows = [
      row({ id: 'a' }),
      row({ id: 'b', archived_at: '2026-09-01T10:00:00+05:30' }),
      row({ id: 'c', client_archived_at: '2026-09-01T10:00:00+05:30' }),
      row({ id: 'd', status: null }),
      row({ id: 'e' }),
    ];
    expect(toEngagements(rows).map((e) => e.id)).toEqual(['a', 'e']);
  });
});

describe('groupClients', () => {
  it('makes one client per client id, with its engagements in order', () => {
    const clients = groupClients([
      engagement({ id: 'e-1', client_id: 'c-2', client_name: 'Client02 Demo Ltd' }),
      engagement({ id: 'e-2', client_id: 'c-1', client_name: 'Client01 Demo Ltd' }),
      engagement({ id: 'e-3', client_id: 'c-2', client_name: 'Client02 Demo Ltd' }),
    ]);
    expect(clients.map((c) => c.name)).toEqual(['Client01 Demo Ltd', 'Client02 Demo Ltd']);
    expect(clients[1].engagements.map((e) => e.id)).toEqual(['e-1', 'e-3']);
  });

  it('returns nothing for no engagements', () => {
    expect(groupClients([])).toEqual([]);
  });
});

describe('toClients (step 2-d)', () => {
  it('groups rows into clients; archived engagements and clients are left out', () => {
    const clients = toClients([
      row({ id: 'e-1', client_id: 'c-1', client_name: 'Client01 Demo Ltd', status: 'Certified' }),
      row({ id: 'e-2', client_id: 'c-1', client_name: 'Client01 Demo Ltd', status: 'Completed' }),
      row({
        id: 'e-3',
        client_id: 'c-1',
        client_name: 'Client01 Demo Ltd',
        status: 'Renewal Due',
        archived_at: '2026-09-01T10:00:00+05:30',
      }),
      row({
        id: 'e-4',
        client_id: 'c-2',
        client_name: 'Client02 Demo Ltd',
        status: 'Certified',
        client_archived_at: '2026-09-01T10:00:00+05:30',
      }),
    ]);
    expect(clients.map((c) => c.id)).toEqual(['c-1']);
    expect(clients[0].engagements.map((e) => e.id)).toEqual(['e-1', 'e-2']);
  });

  it('returns nothing for no rows (e.g. Marketing, which reads no active clients)', () => {
    expect(toClients([])).toEqual([]);
  });
});

describe('pipeline columns', () => {
  it('are Lead, Proposal, On Hold, in that order', () => {
    expect(PIPELINE_COLUMNS).toEqual(['Lead', 'Proposal', 'On Hold']);
  });

  it('knows which statuses are on the board', () => {
    for (const s of ['Lead', 'Proposal', 'On Hold']) expect(isPipelineStatus(s)).toBe(true);
    for (const s of ['In Progress', 'Certified', 'Closed', 'New', 'Won', 'Lost', 'lead', '']) {
      expect(isPipelineStatus(s)).toBe(false);
    }
  });

  it('puts each engagement in its column and ignores any other status', () => {
    const columns = groupByPipelineStatus([
      engagement({ id: 'a', status: 'Lead' }),
      engagement({ id: 'b', status: 'On Hold' }),
      engagement({ id: 'c', status: 'In Progress' }),
      engagement({ id: 'd', status: 'Lead' }),
    ]);
    expect(Object.keys(columns)).toEqual(['Lead', 'Proposal', 'On Hold']);
    expect(columns.Lead.map((e) => e.id)).toEqual(['a', 'd']);
    expect(columns.Proposal).toEqual([]);
    expect(columns['On Hold'].map((e) => e.id)).toEqual(['b']);
  });

  it('counts only engagements on the board for the nav badge', () => {
    expect(
      countOnBoard([
        engagement({ status: 'Lead' }),
        engagement({ status: 'Certified' }),
        engagement({ status: 'Proposal' }),
      ]),
    ).toBe(2);
  });
});

describe('sumValues', () => {
  it('adds only the values present', () => {
    expect(
      sumValues([
        engagement({ contract_value: 100000 }),
        engagement({ contract_value: null }),
        engagement({ contract_value: 250000 }),
      ]),
    ).toBe(350000);
  });

  it('is empty when no engagement has a value, and for no engagements', () => {
    expect(sumValues([engagement({}), engagement({})])).toBeNull();
    expect(sumValues([])).toBeNull();
  });
});

describe('sample rows through the mapping code', () => {
  it('give 7 engagements on the board (the archived one left out)', () => {
    const board = toEngagements(SAMPLE_PIPELINE_ROWS);
    expect(board).toHaveLength(7);
    expect(countOnBoard(board)).toBe(7);
    const columns = groupByPipelineStatus(board);
    expect([columns.Lead.length, columns.Proposal.length, columns['On Hold'].length]).toEqual([
      4, 2, 1,
    ]);
  });

  it('give 5 active clients, two of them with two engagements', () => {
    const clients = toClients(SAMPLE_ACTIVE_CLIENT_ROWS);
    expect(clients).toHaveLength(5);
    expect(clients.filter((c) => c.engagements.length === 2)).toHaveLength(2);
  });
});
