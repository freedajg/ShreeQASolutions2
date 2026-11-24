// The sample team: the owner ids used by the fake rows (./pipelineRows.ts,
// ./activeClientRows.ts) and the names the fake `team_members` view answers with
// (./auth.ts). Moved here from src/lib/data/sampleRows.ts in step 2-e, when owner names
// started coming from the database; that file was deleted, so the app no longer ships them.
// Must not import ./auth.ts: the row files import this one, and Vitest must not load Playwright.
// Dummy data only (CLAUDE.md rule 9): fake names, no real person.

// Must match ACCOUNTS in ./auth.ts (ids and names); src/lib/data/sampleRows.test.ts checks it.
export const SAMPLE_OWNER_IDS = {
  owner: 'e2e00000-0000-4000-8000-000000000001',
  consultant: 'e2e00000-0000-4000-8000-000000000011',
  marketing: 'e2e00000-0000-4000-8000-000000000021',
} as const;

/** The names the fake `team_members` view gives these ids (via ACCOUNTS in ./auth.ts). */
export const SAMPLE_TEAM: readonly { id: string; fullName: string }[] = [
  { id: SAMPLE_OWNER_IDS.owner, fullName: 'Demo Owner 1' },
  { id: SAMPLE_OWNER_IDS.consultant, fullName: 'Demo Consultant 1' },
  { id: SAMPLE_OWNER_IDS.marketing, fullName: 'Demo Marketing 1' },
];
