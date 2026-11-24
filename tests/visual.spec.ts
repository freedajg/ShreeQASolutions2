// Screenshot comparison of every main screen and dialog, in the dark and the light theme.
// Proves the colour-token conversion (Phase 0 part 2) doesn't change how the app looks.
// Dark baselines keep their original names (desktop-drishti.png); light ones are prefixed
// (light-desktop-drishti.png). Baselines live in tests/visual.spec.ts-snapshots/ and are
// Windows-specific, so this runs locally only.
// Never use --update-snapshots. New baselines are copied in by name from
// test-results/*-actual.png after review, with a SHA-256 before/after proof (DECISIONS.md).
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ActivityNote, Client, Lead, TabKey } from '../src/types';
import { SCREENS, isFeatureEnabled, isScreenEnabled } from '../src/lib/screens';
import { ACCOUNTS, mockSupabase, type FakeStack } from './support/auth';

// Hidden screens (src/lib/screens.ts) are skipped, not deleted: their tests and baselines come
// back when the screen is switched on again.
function skipUnlessShown(key: TabKey) {
  test.skip(
    !isScreenEnabled(key),
    `${SCREENS[key].label} is hidden until it is wired (src/lib/screens.ts, ${SCREENS[key].wiredIn})`,
  );
}

type Theme = 'dark' | 'light';
const THEMES: Theme[] = ['dark', 'light'];

// Dark keeps the names its baselines were taken under, so they're never renamed or rewritten.
const shotName = (theme: Theme, name: string) => (theme === 'dark' ? name : `light-${name}`);

// A fixed "now", so countdowns, "days ago" and renewal buckets never drift.
const FIXED_NOW = new Date('2026-10-01T10:00:00+05:30');

// Strict: any changed pixel fails.
const STRICT = { threshold: 0, maxDiffPixels: 0, animations: 'disabled' } as const;

// Deterministic drawing: otherwise the edges of rounded, clipped, see-through panels
// can differ by a pixel or two between runs (GPU, raster threads, partial redraws).
test.use({
  colorScheme: 'dark',
  launchOptions: {
    args: [
      '--disable-gpu',
      '--num-raster-threads=1',
      '--disable-partial-raster',
      '--disable-skia-runtime-opts',
      '--force-color-profile=srgb',
    ],
  },
});
// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

// Theme, frozen clock and blocked AI providers, before the first load.
async function prepare(page: Page, theme: Theme) {
  // Dark is the default, so dark runs exactly as before; light is saved before the first load.
  if (theme === 'light') {
    await page.addInitScript(() => localStorage.setItem('drishti-theme-v2', 'light'));
  }
  // pauseAt can only move forward, so install just before FIXED_NOW.
  await page.clock.install({ time: FIXED_NOW.getTime() - 60_000 });
  await page.clock.pauseAt(FIXED_NOW);
  // Settings fetches live model lists from these AI providers; block them so it shows its defaults.
  await page.route(/^https:\/\/(openrouter\.ai|api\.groq\.com)\//, (route) => route.abort());
}

// Diagnostics for waitUntilShown: what the page asked the fake stack, what it logged and which
// requests failed, each restarted at every main-frame navigation (so: since the latest load).
type PageWatch = { calls: string[]; console: string[]; failed: string[] };

function watchPage(page: Page, stack: FakeStack): PageWatch {
  const watch: PageWatch = { calls: stack.calls, console: [], failed: [] };
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    watch.calls.push(`--- navigation: ${frame.url()} ---`);
    watch.console.length = 0;
    watch.failed.length = 0;
  });
  page.on('console', (message) => watch.console.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => watch.console.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) =>
    watch.failed.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`),
  );
  return watch;
}

const listOrNone = (lines: string[]) => (lines.length ? lines.join('\n  ') : '(none)');

// The app appears only after the sign-in check (a deferred callback, then a profile request).
// Moves the paused clock 1 ms per poll until `ready` shows. Not 0 ms: Playwright's clock gives
// a 0 ms timer that is created while it is firing another timer a due time of now + 1 ms, so
// `runFor(0)` on a paused clock never fires it. TanStack Query sends every result to the screen
// with such a timer, so a stranded one left the board on "Loading pipeline…" (step 2-e,
// step2e-flake-diagnosis.md). The drift is 1 ms per 25 ms poll: no screen shows time that
// fine (dates are whole days; the face first blinks 5 s after it mounts; settle() is 1.6 s).
// `attached`: wait until `ready` is in the page, even when hidden by CSS (e.g. the desktop nav
// on a phone).
async function waitUntilShown(
  page: Page,
  ready: Locator,
  watch: PageWatch,
  { attached = false } = {},
) {
  const deadline = Date.now() + 30_000; // the test runner's clock, not the page's frozen one
  while (Date.now() < deadline) {
    if (attached ? (await ready.count()) > 0 : await ready.isVisible()) return;
    await page.clock.runFor(1);
    await page.waitForTimeout(25);
  }
  throw new Error(
    [
      'The expected element never showed (sign-in check, or data not on screen)',
      `Calls to the fake stack (all, with navigations):\n  ${listOrNone(watch.calls)}`,
      `Console since the latest load:\n  ${listOrNone(watch.console)}`,
      `Failed requests since the latest load:\n  ${listOrNone(watch.failed)}`,
    ].join('\n'),
  );
}

// Opens the app with fresh demo data and a paused clock. Timers only move when
// settle() advances them, so every run sees the same frame (e.g. the face's blink).
async function openApp(page: Page, theme: Theme) {
  await prepare(page, theme);
  // Signed in as a fake Owner against a fake Supabase (step 12); the screens are unchanged.
  const watch = watchPage(page, await mockSupabase(page, { signedInAs: ACCOUNTS.owner }));
  await page.goto('/');
  await waitUntilShown(page, page.locator('header'), watch);
  await settle(page);
  // The app has now saved its demo data under the frozen clock. Swap every name, email,
  // phone and note for obviously fake values, then reload. Dates, amounts and stages are
  // untouched, so every screen still shows the same states and colours.
  // Pipeline and Clients don't read this store since step 2-b. Pipeline reads the fake
  // `pipeline` view (tests/support/pipelineRows.ts, step 2-c), Clients the fake
  // `active_clients` view (tests/support/activeClientRows.ts, step 2-d), owner names the fake
  // `team_members` view (tests/support/auth.ts, step 2-e), values the fake engagement_financials
  // (tests/support/financialsRows.ts, step 2-f). All are already fake. This still
  // covers the hidden screens.
  await page.evaluate(fakeIdentities);
  await page.reload();
  // Pipeline is the landing screen; its first card means the rows (and the nav badge) are in.
  await waitUntilShown(page, page.locator('#column-Lead').getByText('Client01 Demo Ltd'), watch);
  // The Clients badge comes from its own request (`active_clients`, step 2-d). On a phone the
  // desktop nav is hidden by CSS, so wait for the badge to be in the page, not to be visible.
  await waitUntilShown(page, page.locator('#nav-tab-clients span.tabular-nums'), watch, {
    attached: true,
  });
  // Owner names come from a third request (`team_members`, step 2-e): wait until the first
  // Lead card's avatar carries its owner's name (Client01 → Demo Owner 1, pipelineRows.ts).
  await waitUntilShown(page, page.locator('#column-Lead [title="Demo Owner 1"]'), watch, {
    attached: true,
  });
  // Values come from a fourth request (`engagement_financials`, step 2-f): wait until Client01's
  // card shows its amount (tests/support/financialsRows.ts).
  await waitUntilShown(page, page.locator('#column-Lead').getByText('₹12,00,000'), watch, {
    attached: true,
  });
  // Test-only: background blur renders a few different corner pixels on every frame.
  // It holds no colour, so removing it hides nothing the token conversion could change.
  await page.addStyleTag({ content: '*, ::before, ::after { backdrop-filter: none !important; }' });
  await settle(page);
}

// Runs in the page. Companies become "Client01 Demo Ltd" / "Lead01 Demo Ltd", contacts
// "Contact C01" / "Contact L01", emails @example.com, phones +91 00000 000NN.
function fakeIdentities() {
  const key = 'drishti_crm_v1_store';
  const store = JSON.parse(localStorage.getItem(key) ?? '{}') as {
    clients: Client[];
    leads: Lead[];
  };
  const nn = (i: number) => String(i + 1).padStart(2, '0');
  const fakeNotes = (activity?: ActivityNote[]) =>
    activity?.map((a) => ({ ...a, note: 'Demo activity note.' }));

  store.clients = store.clients.map((c, i) => ({
    ...c,
    company: `Client${nn(i)} Demo Ltd`,
    contactName: `Contact C${nn(i)}`,
    email: `client${nn(i)}@example.com`,
    phone: `+91 00000 000${nn(i)}`,
    notes: 'Demo client note.',
    activity: fakeNotes(c.activity),
  }));
  store.leads = store.leads.map((l, i) => ({
    ...l,
    company: `Lead${nn(i)} Demo Ltd`,
    contactName: `Contact L${nn(i)}`,
    email: `lead${nn(i)}@example.com`,
    phone: `+91 00000 001${nn(i)}`,
    meetingContext: 'Demo meeting note.',
    activity: fakeNotes(l.activity) ?? [],
    ...(l.lostReason ? { lostReason: 'Demo lost reason.' } : {}),
  }));
  localStorage.setItem(key, JSON.stringify(store));
}

// The login page, signed out (step 12; new baselines desktop-login / phone-login).
async function openLogin(page: Page, theme: Theme) {
  await prepare(page, theme);
  const watch = watchPage(page, await mockSupabase(page));
  await page.goto('/');
  await waitUntilShown(page, page.getByRole('heading', { name: 'Sign in' }), watch);
  await page.addStyleTag({ content: '*, ::before, ::after { backdrop-filter: none !important; }' });
  await settle(page);
}

// 1.6s lets the Drishti briefing's staged reveal (last step at 1.5s) finish.
async function settle(page: Page) {
  await page.clock.runFor(1600);
  await page.evaluate(() => document.fonts.ready);
}

async function openTab(page: Page, key: string) {
  await page.locator(`#nav-tab-${key}`).click();
  await settle(page);
}

async function snap(page: Page, theme: Theme, name: string) {
  await expect(page).toHaveScreenshot(`${shotName(theme, name)}.png`, {
    ...STRICT,
    fullPage: true,
  });
}

// Dialogs cover the visible screen only, so capture just that.
async function snapDialog(page: Page, theme: Theme, name: string) {
  await expect(page).toHaveScreenshot(`${shotName(theme, name)}.png`, STRICT);
}

for (const theme of THEMES) {
  test.describe(theme, () => {
    test.describe('desktop', () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      for (const key of [
        'drishti',
        'dashboard',
        'radar',
        'pipeline',
        'clients',
        'import',
        'settings',
      ] as TabKey[]) {
        test(`tab: ${key}`, async ({ page }) => {
          skipUnlessShown(key);
          await openApp(page, theme);
          await openTab(page, key);
          await snap(page, theme, `desktop-${key}`);
        });
      }

      test('pipeline: table view', async ({ page }) => {
        await openApp(page, theme);
        await openTab(page, 'pipeline');
        await page.getByRole('button', { name: 'Table', exact: true }).click();
        await settle(page);
        await snap(page, theme, 'desktop-pipeline-table');
      });

      test('account menu dropdown', async ({ page }) => {
        await openApp(page, theme);
        await page.getByRole('button', { name: 'Account menu' }).click();
        await settle(page);
        await snap(page, theme, 'desktop-user-dropdown');
      });

      test('client detail dialog', async ({ page }) => {
        await openApp(page, theme);
        await openTab(page, 'clients');
        await page.locator('tbody tr').first().click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-client-detail');
      });

      test('add client dialog', async ({ page }) => {
        test.skip(
          !isFeatureEnabled('addClient'),
          'Add Client is hidden until it is wired (src/lib/screens.ts)',
        );
        await openApp(page, theme);
        await openTab(page, 'clients');
        await page.getByRole('button', { name: 'Add Client' }).click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-add-client');
      });

      test('lead detail dialog', async ({ page }) => {
        await openApp(page, theme);
        await openTab(page, 'pipeline');
        await page.getByRole('button', { name: 'Table', exact: true }).click();
        await settle(page);
        await page.locator('tbody tr').first().click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-lead-detail');
      });

      test('add lead dialog', async ({ page }) => {
        test.skip(
          !isFeatureEnabled('addLead'),
          'Add Lead is hidden until it is wired (src/lib/screens.ts)',
        );
        await openApp(page, theme);
        await openTab(page, 'pipeline');
        await page.getByRole('button', { name: 'Add Lead' }).click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-add-lead');
      });

      test('email draft dialog', async ({ page }) => {
        skipUnlessShown('radar');
        test.skip(!isFeatureEnabled('emailDraft'), 'Email drafts are hidden until Phase 5');
        await openApp(page, theme);
        await openTab(page, 'radar');
        await page.getByTitle('Draft renewal reminder email').first().click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-email-draft');
      });

      test('metric info popover', async ({ page }) => {
        skipUnlessShown('dashboard');
        await openApp(page, theme);
        await openTab(page, 'dashboard');
        // Not a top-row card: their popovers open upwards and are hidden at the top of the page.
        await page.getByLabel('Learn more about Deals Stuck by Stage').hover();
        await settle(page);
        await snap(page, theme, 'desktop-metric-info');
      });

      test('drishti change proposal', async ({ page }) => {
        skipUnlessShown('drishti');
        // Tall enough that the floating "Ask Drishti" bar sits below the proposal, not over it.
        await page.setViewportSize({ width: 1440, height: 1400 });
        await openApp(page, theme);
        await page.getByRole('textbox').first().fill('move Lead01 to won');
        await page.keyboard.press('Enter');
        await settle(page);
        await snap(page, theme, 'desktop-proposal');
      });

      test('hover: nav button', async ({ page }) => {
        await openApp(page, theme);
        // Clients, not Pipeline: Pipeline is the landing (active) tab, so hovering it shows nothing.
        await page.locator('#nav-tab-clients').hover();
        await settle(page);
        await snap(page, theme, 'desktop-hover-nav');
      });

      test('hover: clients table row', async ({ page }) => {
        await openApp(page, theme);
        await openTab(page, 'clients');
        await page.locator('tbody tr').nth(1).hover();
        await settle(page);
        await snap(page, theme, 'desktop-hover-row');
      });

      test('login page', async ({ page }) => {
        await openLogin(page, theme);
        await snap(page, theme, 'desktop-login');
      });
    });

    test.describe('phone (375px)', () => {
      test.use({ viewport: { width: 375, height: 812 } });

      for (const [label, key] of [
        ['Drishti', 'drishti'],
        ['Radar', 'radar'],
        ['Pipeline', 'pipeline'],
        ['Clients', 'clients'],
      ] as [string, TabKey][]) {
        test(`tab: ${label}`, async ({ page }) => {
          skipUnlessShown(key);
          await openApp(page, theme);
          // The name may end with a badge count, e.g. "Radar 5".
          await page.getByRole('button', { name: new RegExp(`^${label}( \\d+)?$`) }).click();
          await settle(page);
          await snap(page, theme, `phone-${label.toLowerCase()}`);
        });
      }

      test('more menu', async ({ page }) => {
        await openApp(page, theme);
        await page.getByRole('button', { name: 'More', exact: true }).click();
        await settle(page);
        await snap(page, theme, 'phone-more-menu');
      });

      test('login page', async ({ page }) => {
        await openLogin(page, theme);
        await snap(page, theme, 'phone-login');
      });
    });
  });
}
