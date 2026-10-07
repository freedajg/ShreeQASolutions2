import { expect, test } from '@playwright/test';
import { ACCOUNTS, mockSupabase } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

test('app loads with its title and main navigation', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');

  await expect(page).toHaveTitle('Drishti - Consulting CRM');

  const nav = page.locator('header nav');
  await expect(nav).toBeVisible();
  for (const label of ['Dashboard', 'Renewal Radar', 'Pipeline', 'Clients']) {
    await expect(nav.getByRole('button', { name: label })).toBeVisible();
  }

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
