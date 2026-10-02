// Screenshot comparison of every main screen and dialog, in the dark and the light theme.
// Proves the colour-token conversion (Phase 0 part 2) doesn't change how the app looks.
// Dark baselines keep their original names (desktop-drishti.png); light ones are prefixed
// (light-desktop-drishti.png). Baselines live in tests/visual.spec.ts-snapshots/ and are
// Windows-specific, so this runs locally only. Update baselines only for a change named in
// docs/PHASE-0-PART-2-PLAN.md:
//   bun run test:e2e tests/visual.spec.ts --update-snapshots
import { expect, test, type Page } from '@playwright/test';
import type { ActivityNote, Client, Lead } from '../src/types';

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

// Opens the app with fresh demo data and a paused clock. Timers only move when
// settle() advances them, so every run sees the same frame (e.g. the face's blink).
async function openApp(page: Page, theme: Theme) {
  // Dark is the default, so dark runs exactly as before; light is saved before the first load.
  if (theme === 'light') {
    await page.addInitScript(() => localStorage.setItem('drishti-theme', 'light'));
  }
  // pauseAt can only move forward, so install just before FIXED_NOW.
  await page.clock.install({ time: FIXED_NOW.getTime() - 60_000 });
  await page.clock.pauseAt(FIXED_NOW);
  // Settings fetches live model lists from these AI providers; block them so it shows its defaults.
  await page.route(/^https:\/\/(openrouter\.ai|api\.groq\.com)\//, (route) => route.abort());
  await page.goto('/');
  await settle(page);
  // The app has now saved its demo data under the frozen clock. Swap every name, email,
  // phone and note for obviously fake values, then reload. Dates, amounts and stages are
  // untouched, so every screen still shows the same states and colours.
  await page.evaluate(fakeIdentities);
  await page.reload();
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
      ]) {
        test(`tab: ${key}`, async ({ page }) => {
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

      test('user switcher dropdown', async ({ page }) => {
        await openApp(page, theme);
        await page.getByRole('button', { name: 'Switch active user' }).click();
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
        await openApp(page, theme);
        await openTab(page, 'pipeline');
        await page.getByRole('button', { name: 'Add Lead' }).click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-add-lead');
      });

      test('email draft dialog', async ({ page }) => {
        await openApp(page, theme);
        await openTab(page, 'radar');
        await page.getByTitle('Draft renewal reminder email').first().click();
        await settle(page);
        await snapDialog(page, theme, 'desktop-email-draft');
      });

      test('metric info popover', async ({ page }) => {
        await openApp(page, theme);
        await openTab(page, 'dashboard');
        // Not a top-row card: their popovers open upwards and are hidden at the top of the page.
        await page.getByLabel('Learn more about Deals Stuck by Stage').hover();
        await settle(page);
        await snap(page, theme, 'desktop-metric-info');
      });

      test('drishti change proposal', async ({ page }) => {
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
        await page.locator('#nav-tab-pipeline').hover();
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
    });

    test.describe('phone (375px)', () => {
      test.use({ viewport: { width: 375, height: 812 } });

      for (const label of ['Drishti', 'Radar', 'Pipeline', 'Clients']) {
        test(`tab: ${label}`, async ({ page }) => {
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
    });
  });
}
