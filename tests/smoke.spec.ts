import { expect, test } from '@playwright/test';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

test('app loads with its title and main navigation', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Drishti - Consulting CRM');

  const nav = page.locator('header nav');
  await expect(nav).toBeVisible();
  for (const label of ['Dashboard', 'Renewal Radar', 'Pipeline', 'Clients']) {
    await expect(nav.getByRole('button', { name: label })).toBeVisible();
  }

  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});
