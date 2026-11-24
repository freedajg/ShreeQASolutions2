import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TeamMember } from '../types/crm';
import { csvDateSerial, previewImport, suggestMapping } from './importExcel';

// The DUMMY workbook's Test Notes sheet lists what the import must flag (PRD FR-3 acceptance).
const member = (id: string, name: string): TeamMember =>
  ({ id, name, role: 'Owner/Admin', active: true }) as TeamMember;
const TEAM = [
  member('m', 'Mahesh Bhaskara'),
  member('p', 'Pramila Pullela'),
  member('s', 'Sarath Chandra'),
  member('t', 'Teenu Puri'),
];

async function preview() {
  const bytes = readFileSync('test-data/SQAS_Client_Database_DUMMY.xlsx');
  const file = new File([bytes], 'SQAS_Client_Database_DUMMY.xlsx');
  // The DUMMY file has data from row 2 (no example row).
  const result = await previewImport(file, TEAM, [], { skipExampleRow: false });
  if (typeof result === 'string' || 'needsMapping' in result) throw new Error('not a preview');
  return result;
}

describe('previewImport with the DUMMY workbook', () => {
  it('reads every row and groups rows sharing a Client ID into one client', async () => {
    const p = await preview();
    expect(p.counts.total).toBe(23);
    expect(p.rows).toHaveLength(23);
    expect(p.newClients).toBe(21);
  });

  it('flags the Test Notes cases instead of guessing', async () => {
    const p = await preview();
    const codes = (code: string) => p.flags.filter((f) => f.code === code).map((f) => f.clientCode);
    expect(codes('UNKNOWN_STATUS')).toContain('SQAS-C016'); // "Certifed"
    expect(codes('UNKNOWN_SERVICE')).toContain('SQAS-C008'); // PCI-DSS
    expect(codes('INVALID_DATE')).toContain('SQAS-C017'); // "31/02/2027"
    expect(codes('NON_NUMERIC_VALUE')).toContain('SQAS-C017'); // "4.5 L"
    expect(codes('MISSING_EMAIL')).toContain('SQAS-C007');
    expect(codes('MISSING_OWNER')).toContain('SQAS-C009');
    expect(codes('POSSIBLE_DUPLICATE')).toContain('SQAS-C015');
  });

  it('never invents data: flagged values are sent empty', async () => {
    const p = await preview();
    const row = p.rows.find(
      (r) => (r as { client: { client_code: string } }).client.client_code === 'SQAS-C016',
    ) as { engagement: { status: string } };
    expect(row.engagement.status).toBe('');
  });

  it('refuses a workbook that is not the 30-column template', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'notes.txt');
    expect(await previewImport(file, TEAM, [])).toMatch(/Excel file/);
  });
});

describe('other layouts and CSV (PLAN Phase 3)', () => {
  it('asks for a column mapping when the headers are not the template', async () => {
    const csv = ['Company,Mail,Cert', 'X Co,x@example.test,ISO 27001', ''].join('\n');
    const result = await previewImport(new File([csv], 'other.csv'), TEAM, [], {
      skipExampleRow: false,
    });
    expect(typeof result !== 'string' && 'needsMapping' in result).toBe(true);
  });

  it('imports with a mapping: Company → Client Name, Mail → Email, Cert → Service', async () => {
    const csv = [
      'Company,Mail,Cert,Valid To',
      'X Co,x@example.test,ISO 27001,28-Jul-2028',
      '',
    ].join('\n');
    const mapping = Array(30).fill(-1);
    mapping[1] = 0;
    mapping[8] = 1;
    mapping[11] = 2;
    mapping[19] = 3;
    const result = await previewImport(new File([csv], 'other.csv'), TEAM, [], {
      skipExampleRow: false,
      mapping,
    });
    if (typeof result === 'string' || 'needsMapping' in result) throw new Error('no preview');
    const row = result.rows[0] as {
      client: Record<string, string>;
      engagement: Record<string, string>;
    };
    expect(row.client.name).toBe('X Co');
    expect(row.client.email).toBe('x@example.test');
    expect(row.engagement.certification_type).toBe('ISO 27001');
    expect(row.engagement.valid_to).toBe('2028-07-28');
  });

  it('accepts only unambiguous CSV dates, never guesses', () => {
    expect(csvDateSerial('12-Mar-2024')).toBe(csvDateSerial('2024-03-12'));
    expect(csvDateSerial('03/04/2024')).toBeNull();
    expect(csvDateSerial('31-Feb-2027')).toBeNull();
  });

  it('suggests exact header matches only', () => {
    const m = suggestMapping(['client name', 'EMAIL', 'Something else']);
    expect(m[1]).toBe(0);
    expect(m[8]).toBe(1);
    expect(m[0]).toBe(-1);
  });
});
