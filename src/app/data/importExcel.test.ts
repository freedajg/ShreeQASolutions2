import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TeamMember } from '../types/crm';
import { previewImport } from './importExcel';

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
  if (typeof result === 'string') throw new Error(result);
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
