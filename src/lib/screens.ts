// Which screens and features are shown (Phase 2, step 2-a2). Until a screen reads from the
// database, nobody sees or reaches it: no nav item, never mounted, and asking for it lands on
// the landing screen. To bring one back once it's wired, set `enabled: true` here; the Playwright
// tests that skip it come back by themselves. Hidden screens stay in the repo, unchanged.
// This is about what people see, not a permission: the hidden screens only ever held browser
// sample data, and permissions live in the database (RLS).
import type { TabKey } from '../types';

type ScreenInfo = {
  enabled: boolean;
  label: string;
  /** When the screen is expected back (documentation only). */
  wiredIn: string;
};

export const SCREENS = {
  pipeline: { enabled: true, label: 'Pipeline', wiredIn: '2-c' },
  clients: { enabled: true, label: 'Clients', wiredIn: '2-d' },
  drishti: { enabled: false, label: 'Drishti', wiredIn: 'Phase 4 (AI on the server)' },
  dashboard: { enabled: false, label: 'Dashboard', wiredIn: 'Phase 2, after the demo' },
  radar: { enabled: false, label: 'Renewal Radar', wiredIn: 'Phase 3' },
  import: { enabled: false, label: 'Import', wiredIn: 'Phase 3' },
  settings: { enabled: false, label: 'Settings', wiredIn: 'Phase 4 (AI on the server)' },
} as const satisfies Record<TabKey, ScreenInfo>;

export const FEATURES = {
  // OpenRouter / Groq keys and calls: Phase 4, server-side only (DECISIONS 11-Oct-2026).
  aiProviders: false,
  // Email drafts: Phase 5, sent from the engagement owner's mailbox only (CLAUDE.md rule 4).
  emailDraft: false,
  // Step 2-b. Add Lead: after Questionnaire Q4 (who enters enquiries). The MVP form fills in a
  // made-up email, phone, date and value (CLAUDE.md rule 7) and writes to the old browser store,
  // so it must be rebuilt on the database before this goes on.
  addLead: false,
  // Step 2-b. Add Client: after Q4, with the client page work. Same MVP form problems as Add Lead.
  addClient: false,
  // Step 2-b. Needs-Attention strip and "Nd quiet" pill: with the follow-up work (the interval
  // comes from `app_settings`, step 16). Seeded rows have no last-contact date yet.
  needsAttention: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const LANDING_SCREEN: TabKey = 'pipeline';

export function isScreenEnabled(key: TabKey): boolean {
  return SCREENS[key].enabled;
}

function isTabKey(value: unknown): value is TabKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCREENS, value);
}

/** The screen to show for a request: itself when enabled, otherwise the landing screen. */
export function resolveScreen(requested: unknown): TabKey {
  return isTabKey(requested) && isScreenEnabled(requested) ? requested : LANDING_SCREEN;
}

/** Keeps the order and drops hidden screens. */
export function enabledScreens<T extends TabKey>(keys: readonly T[]): T[] {
  return keys.filter((key) => isScreenEnabled(key));
}

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
