// The sample team the app still ships until 2-e reads `team_members` (owner names).
// The Pipeline rows moved to tests/support/pipelineRows.ts in 2-c, the Clients rows to
// tests/support/activeClientRows.ts and the row builders to tests/support/rowBuilders.ts in
// 2-d, when the screens started reading the database. 2-e deletes this file.
// Dummy data only (CLAUDE.md rule 9): fake names, no real person.

// Must match ACCOUNTS in tests/support/auth.ts (ids and names); sampleRows.test.ts checks it.
export const SAMPLE_OWNER_IDS = {
  owner: 'e2e00000-0000-4000-8000-000000000001',
  consultant: 'e2e00000-0000-4000-8000-000000000011',
  marketing: 'e2e00000-0000-4000-8000-000000000021',
} as const;

/** Names for owner ids until 2-e reads `team_members`. */
export const SAMPLE_TEAM: readonly { id: string; fullName: string }[] = [
  { id: SAMPLE_OWNER_IDS.owner, fullName: 'Demo Owner 1' },
  { id: SAMPLE_OWNER_IDS.consultant, fullName: 'Demo Consultant 1' },
  { id: SAMPLE_OWNER_IDS.marketing, fullName: 'Demo Marketing 1' },
];
