import { expect, test, type Page } from '@playwright/test';
import type { TabKey } from '../src/types';
import { SCREENS, isScreenEnabled } from '../src/lib/screens';
import { ACCOUNTS, mockSupabase } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

const ALL_SCREENS = Object.keys(SCREENS) as TabKey[];
const SHOWN = ALL_SCREENS.filter(isScreenEnabled);
const HIDDEN = ALL_SCREENS.filter((key) => !isScreenEnabled(key));

// Records every request to an AI provider instead of letting it out.
async function recordAiCalls(page: Page): Promise<string[]> {
  const calls: string[] = [];
  await page.route(/^https:\/\/(openrouter\.ai|api\.groq\.com)\//, (route) => {
    calls.push(route.request().url());
    return route.abort();
  });
  return calls;
}

test('app loads with its title and main navigation', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');

  await expect(page).toHaveTitle('Drishti - Consulting CRM');

  const nav = page.locator('header nav');
  await expect(nav).toBeVisible();
  // Only the screens wired to the database are in the nav (src/lib/screens.ts).
  for (const key of SHOWN) {
    await expect(nav.locator(`#nav-tab-${key}`)).toBeVisible();
  }
  for (const key of HIDDEN) {
    await expect(page.locator(`#nav-tab-${key}`)).toHaveCount(0);
  }
  await expect(page.locator('#nav-tab-pipeline')).toHaveAttribute('aria-current', 'page');

  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

test('signed out, only the login page loads', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await mockSupabase(page);
  await page.goto('/');

  await expect(page).toHaveTitle('Drishti - Consulting CRM');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('header nav')).toHaveCount(0);

  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

test('typing the address of a hidden screen lands on Pipeline', async ({ page }) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  for (const path of ['/dashboard', '/#/radar', '/?tab=drishti', '/settings']) {
    await page.goto(path);
    await expect(page.locator('#nav-tab-pipeline')).toHaveAttribute('aria-current', 'page');
    for (const key of HIDDEN) {
      await expect(page.locator(`#nav-tab-${key}`)).toHaveCount(0);
    }
  }
});

test('no request goes to an AI provider on the shown screens', async ({ page }) => {
  const aiCalls = await recordAiCalls(page);
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');
  for (const key of SHOWN) {
    await page.locator(`#nav-tab-${key}`).click();
    await expect(page.locator(`#nav-tab-${key}`)).toHaveAttribute('aria-current', 'page');
  }
  await page.waitForLoadState('networkidle');
  expect(aiCalls).toEqual([]);
});

test.describe('phone (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the bottom bar has only the shown screens and More; More opens with no AI call', async ({
    page,
  }) => {
    const aiCalls = await recordAiCalls(page);
    await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
    await page.goto('/');

    const bar = page.locator('div.fixed.bottom-0');
    for (const key of SHOWN) {
      await expect(
        bar.getByRole('button', { name: new RegExp(`^${SCREENS[key].label}`) }),
      ).toBeVisible();
    }
    // Scoped to the bar: the header's brand button is also named "Drishti".
    for (const label of ['Drishti', 'Radar', 'Dashboard', 'Import', 'Settings']) {
      await expect(bar.getByRole('button', { name: new RegExp(label) })).toHaveCount(0);
    }

    await bar.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByText('Executive Dashboard')).toHaveCount(0);
    await expect(page.getByText('Import Excel / CSV')).toHaveCount(0);
    await expect(page.getByText('API Keys & Settings')).toHaveCount(0);

    await page.waitForLoadState('networkidle');
    expect(aiCalls).toEqual([]);
  });
});
