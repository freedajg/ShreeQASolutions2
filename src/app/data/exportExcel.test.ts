import { read } from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { Client, Engagement, TeamMember } from '../types/crm';
import { exportRows, exportWorkbook } from './exportExcel';
import { previewImport } from './importExcel';

const owner = { id: 'm', name: 'Mahesh Bhaskara', role: 'Owner/Admin', active: true } as TeamMember;
const client = {
  id: 'c1',
  code: 'SQAS-C900',
  name: '=HYPERLINK("http://x","y")',
  industry: 'IT',
  address: '',
  city: 'Pune',
  stateCountry: 'India',
  contactPerson: 'Asha Rao',
  designation: 'CTO',
  email: 'asha@example.test',
  phone: '',
  website: '',
  leadSource: 'Referral',
  rating: 'High',
  tags: [],
  doNotContact: false,
  createdAt: '2026-01-01',
} as Client;
const engagement = {
  id: 'e1',
  clientId: 'c1',
  service: 'ISO 27001',
  standardFramework: 'ISO/IEC 27001:2022',
  scope: '',
  status: 'Certified',
  certificationCompletionDate: '2025-07-29',
  certificateValidTo: '2028-07-28',
  contractValueINR: 450000,
  paymentStatus: 'Paid',
  ownerId: 'm',
  leadSource: 'Referral',
  notes: [],
  emails: [],
  archived: false,
  followUpCount: 0,
  createdById: '',
} as unknown as Engagement;

async function roundTrip(includeFinancials: boolean) {
  const rows = exportRows({ c1: client }, [engagement], { m: owner }, includeFinancials);
  const bytes = exportWorkbook(rows);
  const file = new File([bytes], 'export.xlsx');
  const p = await previewImport(file, [owner], [], { skipExampleRow: false });
  if (typeof p === 'string' || 'needsMapping' in p) throw new Error('not a preview');
  return { bytes, p };
}

describe('Excel export (PLAN Phase 3)', () => {
  it('re-imports to the same data', async () => {
    const { p } = await roundTrip(true);
    expect(p.flags.filter((f) => f.level === 'flag')).toEqual([]);
    const row = p.rows[0] as {
      client: Record<string, string>;
      engagement: Record<string, string>;
      financials: Record<string, unknown>;
    };
    expect(row.client.client_code).toBe('SQAS-C900');
    expect(row.client.name).toBe('=HYPERLINK("http://x","y")');
    expect(row.engagement.completion_date).toBe('2025-07-29');
    expect(row.engagement.valid_to).toBe('2028-07-28');
    expect(row.engagement.owner_id).toBe('m');
    expect(row.financials.contract_value).toBe(450000);
  });

  it('writes a name starting with = as text, never a formula', async () => {
    const { bytes } = await roundTrip(false);
    const ws = read(bytes, { type: 'array' }).Sheets['Client Database'];
    expect(ws.B2.t).toBe('s');
    expect(ws.B2.f).toBeUndefined();
  });

  it('leaves values out for someone without values access', async () => {
    const rows = exportRows({ c1: client }, [engagement], { m: owner }, false);
    expect(rows[1][24]).toBeNull();
    expect(rows[1][25]).toBeNull();
  });
});
