import { describe, expect, it, vi } from 'vitest';
import { PIPELINE_COLUMNS, type Engagement } from '../../types/crm';
import {
  countOnBoard,
  createUnknownOwnerReporter,
  groupByPipelineStatus,
  groupClients,
  isPipelineStatus,
  ownerDisplay,
  ownerText,
  sumValues,
  toClients,
  toEngagement,
  toEngagements,
  toFinancials,
  toTeamNames,
  valueDisplay,
} from './mappers';
import type { EngagementFinancialsRow, StatusViewRow, TeamMemberRow } from './queries';
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

  it('leaves empty columns empty: no made-up email, phone, date or owner', () => {
    const e = engagement({});
    expect(e.client.email).toBeNull();
    expect(e.client.phone).toBeNull();
    expect(e.client.contactPerson).toBeNull();
    expect(e.lastContactedOn).toBeNull();
    expect(e.nextFollowUpOn).toBeNull();
    expect(e.validTo).toBeNull();
    expect(e.ownerId).toBeNull();
  });

  it('carries no value, even if a view row had one (values come only from engagement_financials, step 2-f)', () => {
    const withDecoy = { ...row({}), contract_value: 99, payment_status: 'Paid' } as StatusViewRow;
    const e = toEngagement(withDecoy);
    expect(e).not.toHaveProperty('contractValue');
    expect(e).not.toHaveProperty('paymentStatus');
    expect(JSON.stringify(e)).not.toContain('99');
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

// Step 2-f: values come only from engagement_financials.
const financials = (
  engagement_id: string | null,
  contract_value: unknown,
  payment_status: string | null = null,
) => ({ engagement_id, contract_value, payment_status }) as EngagementFinancialsRow;

describe('toFinancials (step 2-f)', () => {
  it('maps engagement ids to amount and payment status', () => {
    const values = toFinancials([financials('e-1', 450000, 'Paid'), financials('e-2', null)]);
    expect(values.get('e-1')).toEqual({ amount: 450000, paymentStatus: 'Paid' });
    expect(values.get('e-2')).toEqual({ amount: null, paymentStatus: null });
  });

  it('accepts a numeric string (PostgREST numeric) and keeps a recorded zero', () => {
    const values = toFinancials([financials('e-1', '420000.00'), financials('e-2', 0)]);
    expect(values.get('e-1')?.amount).toBe(420000);
    expect(values.get('e-2')?.amount).toBe(0);
  });

  it('leaves anything else empty, never NaN', () => {
    const values = toFinancials([
      financials('e-1', '4.5 L'),
      financials('e-2', Number.NaN),
      financials('e-3', ''),
      financials('e-4', {}),
    ]);
    for (const id of ['e-1', 'e-2', 'e-3', 'e-4']) expect(values.get(id)?.amount).toBeNull();
  });

  it('drops a row without an engagement id', () => {
    expect(toFinancials([financials(null, 100000)]).size).toBe(0);
  });
});

describe('valueDisplay (step 2-f)', () => {
  const values = toFinancials([
    financials('e-1', 450000),
    financials('e-2', null),
    financials('e-0', 0),
  ]);

  it('hides every value from a user without values access, even when values are present', () => {
    expect(valueDisplay(values, false, 'e-1')).toEqual({ state: 'hidden' });
    expect(valueDisplay(undefined, false, 'e-1')).toEqual({ state: 'hidden' });
  });

  it('shows nothing while values are loading (or could not be read)', () => {
    expect(valueDisplay(undefined, true, 'e-1')).toEqual({ state: 'loading' });
  });

  it('is empty for a row with no amount and for an engagement with no financials row', () => {
    expect(valueDisplay(values, true, 'e-2')).toEqual({ state: 'empty' });
    expect(valueDisplay(values, true, 'e-9')).toEqual({ state: 'empty' });
  });

  it('shows a recorded amount, including 0', () => {
    expect(valueDisplay(values, true, 'e-1')).toEqual({ state: 'amount', amount: 450000 });
    expect(valueDisplay(values, true, 'e-0')).toEqual({ state: 'amount', amount: 0 });
  });
});

describe('sumValues', () => {
  const values = toFinancials([
    financials('a', 100000),
    financials('b', null),
    financials('c', 250000),
  ]);
  const three = [engagement({ id: 'a' }), engagement({ id: 'b' }), engagement({ id: 'c' })];

  it('adds only the recorded amounts', () => {
    expect(sumValues(three, values, true)).toBe(350000);
  });

  it('is empty without values access, while loading, when none is recorded, and for no engagements', () => {
    expect(sumValues(three, values, false)).toBeNull();
    expect(sumValues(three, undefined, true)).toBeNull();
    expect(sumValues([engagement({ id: 'b' }), engagement({ id: 'x' })], values, true)).toBeNull();
    expect(sumValues([], values, true)).toBeNull();
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

// Step 2-e: owner names from the team_members view.
const OWNER = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTHER = 'bbbbbbbb-0000-4000-8000-000000000002';

const member = (overrides: Partial<TeamMemberRow> = {}): TeamMemberRow => ({
  id: OWNER,
  full_name: 'Demo Owner 1',
  email: 'demo.owner1@example.com',
  role: 'owner',
  booking_link: null,
  active: true,
  ...overrides,
});

describe('toTeamNames (step 2-e)', () => {
  it('maps ids to full names and drops rows without an id', () => {
    const names = toTeamNames([
      member(),
      member({ id: OTHER, full_name: '  Demo Owner 2 ' }),
      member({ id: null, full_name: 'No id' }),
    ]);
    expect([...names.entries()]).toEqual([
      [OWNER, 'Demo Owner 1'],
      [OTHER, 'Demo Owner 2'],
    ]);
  });

  it('keeps a blank or missing name blank, and gives an empty map for no rows', () => {
    expect(toTeamNames([member({ full_name: null })]).get(OWNER)).toBe('');
    expect(toTeamNames([]).size).toBe(0);
  });
});

describe('ownerDisplay (step 2-e)', () => {
  const team = toTeamNames([member(), member({ id: OTHER, full_name: '' })]);

  it('shows nothing while the team list is loading (or could not be read)', () => {
    expect(ownerDisplay(undefined, OWNER)).toEqual({ state: 'loading' });
    expect(ownerText(ownerDisplay(undefined, OWNER))).toBe('');
  });

  it('says "No owner" for an empty owner, even while loading', () => {
    expect(ownerDisplay(team, null)).toEqual({ state: 'none', label: 'No owner' });
    expect(ownerDisplay(undefined, null)).toEqual({ state: 'none', label: 'No owner' });
  });

  it('says "Unknown owner" for an id not on the team, never "?"', () => {
    const shown = ownerDisplay(team, 'cccccccc-0000-4000-8000-000000000003');
    expect(shown).toEqual({ state: 'unknown', label: 'Unknown owner' });
    expect(ownerText(shown)).not.toContain('?');
  });

  it("shows a known owner's full name, and a neutral label for a blank one", () => {
    expect(ownerDisplay(team, OWNER)).toEqual({ state: 'known', label: 'Demo Owner 1' });
    expect(ownerDisplay(team, OTHER)).toEqual({ state: 'known', label: 'Unnamed team member' });
  });
});

describe('createUnknownOwnerReporter (step 2-e)', () => {
  it('logs each unknown id once, with the id only', () => {
    const log = vi.fn();
    const report = createUnknownOwnerReporter(log);
    report(OWNER);
    report(OWNER);
    report(OTHER);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenNthCalledWith(1, 'Owner id is not on the team:', OWNER);
    expect(log).toHaveBeenNthCalledWith(2, 'Owner id is not on the team:', OTHER);
  });

  it('keeps a separate memory per reporter', () => {
    const first = vi.fn();
    const second = vi.fn();
    createUnknownOwnerReporter(first)(OWNER);
    createUnknownOwnerReporter(second)(OWNER);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
