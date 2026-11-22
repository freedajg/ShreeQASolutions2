import { describe, expect, it } from 'vitest';
// The test rows and the sample team live in tests/support/ (the team since step 2-e, when
// src/lib/data/sampleRows.ts was deleted); this file stays here because Vitest runs src/ only.
import { SAMPLE_ACTIVE_CLIENT_ROWS } from '../../../tests/support/activeClientRows';
import { ACCOUNTS, teamMemberRows } from '../../../tests/support/auth';
import { SAMPLE_PIPELINE_ROWS } from '../../../tests/support/pipelineRows';
import { SAMPLE_OWNER_IDS, SAMPLE_TEAM } from '../../../tests/support/team';
import { toTeamNames } from './mappers';
import { STATUS_VIEW_COLUMNS, TEAM_MEMBER_COLUMNS } from './queries';

const ALL_ROWS = [...SAMPLE_PIPELINE_ROWS, ...SAMPLE_ACTIVE_CLIENT_ROWS];

describe('sample rows', () => {
  it('have exactly the 43 status-view columns', () => {
    const columns = STATUS_VIEW_COLUMNS.split(', ').sort();
    expect(columns).toHaveLength(43);
    for (const row of ALL_ROWS) expect(Object.keys(row).sort()).toEqual(columns);
  });

  it('belong to their view: pipeline = Lead, Proposal, On Hold; active = the active statuses', () => {
    for (const row of SAMPLE_PIPELINE_ROWS) {
      expect(['Lead', 'Proposal', 'On Hold']).toContain(row.status);
    }
    for (const row of SAMPLE_ACTIVE_CLIENT_ROWS) {
      expect(['Certified', 'Renewal Due', 'Completed']).toContain(row.status);
    }
  });

  it('have unique engagement ids', () => {
    const ids = ALL_ROWS.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('use only fake contact details', () => {
    for (const row of ALL_ROWS) {
      expect(row.client_name).toMatch(/^Client\d{2} Demo Ltd$/);
      if (row.client_email) expect(row.client_email).toMatch(/@example\.com$/);
      if (row.client_phone) expect(row.client_phone).toMatch(/^\+91 00000 /);
    }
  });

  it('use only owners from the sample team, or none', () => {
    const team = SAMPLE_TEAM.map((member) => member.id);
    for (const row of ALL_ROWS) {
      if (row.owner_id !== null) expect(team).toContain(row.owner_id);
    }
  });

  it('match the fake accounts in tests/support/auth.ts (ids and names)', () => {
    expect(SAMPLE_OWNER_IDS).toEqual({
      owner: ACCOUNTS.owner.id,
      consultant: ACCOUNTS.consultant.id,
      marketing: ACCOUNTS.marketing.id,
    });
    expect(SAMPLE_TEAM).toEqual([
      { id: ACCOUNTS.owner.id, fullName: ACCOUNTS.owner.full_name },
      { id: ACCOUNTS.consultant.id, fullName: ACCOUNTS.consultant.full_name },
      { id: ACCOUNTS.marketing.id, fullName: ACCOUNTS.marketing.full_name },
    ]);
  });

  it("the fake team_members answer names every sample-team owner, with the view's columns (step 2-e)", () => {
    const rows = teamMemberRows(Object.values(ACCOUNTS));
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(TEAM_MEMBER_COLUMNS.split(', ').sort());
    }
    const names = toTeamNames(rows);
    for (const member of SAMPLE_TEAM) expect(names.get(member.id)).toBe(member.fullName);
  });
});
