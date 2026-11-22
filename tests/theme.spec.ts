// Theme toggle (PHASE-0-PART-2-PLAN.md step 13, DESIGN.md §2a).
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, mockSupabase } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

// The theme controls live in the signed-in app.
test.beforeEach(async ({ page }) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
});

const DARK_BG = 'rgb(8, 12, 22)';
const LIGHT_BG = 'rgb(248, 250, 252)';

async function expectTheme(page: Page, theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    theme === 'light' ? LIGHT_BG : DARK_BG,
  );
}

async function chooseInUserMenu(page: Page, option: 'Light' | 'Dark' | 'System') {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('radio', { name: option }).click();
}

test.describe('on a light device', () => {
  test.use({ colorScheme: 'light' });

  test('a first visit opens in Dark', async ({ page }) => {
    await page.goto('/');
    await expectTheme(page, 'dark');
  });

  test('System follows the device setting, live', async ({ page }) => {
    await page.goto('/');
    await chooseInUserMenu(page, 'System');
    await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expectTheme(page, 'light');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectTheme(page, 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectTheme(page, 'light');
  });
});

test('the top-bar button switches Light and Dark instantly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expectTheme(page, 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expectTheme(page, 'dark');
});

test('reloading keeps the choice, set before the page body exists (no flash)', async ({ page }) => {
  await page.goto('/');
  await chooseInUserMenu(page, 'Light');
  await expectTheme(page, 'light');

  // Records the theme at the moment <body> is created: before any content can paint,
  // and before React runs. Only the inline script in index.html can have set it by then.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.body) return;
      (window as unknown as { themeAtBody?: string }).themeAtBody =
        document.documentElement.dataset.theme;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();

  await expectTheme(page, 'light');
  const themeAtBody = await page.evaluate(
    () => (window as unknown as { themeAtBody?: string }).themeAtBody,
  );
  expect(themeAtBody).toBe('light');
});

test.describe('phone (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the top-bar button and the More menu Theme row both work', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expectTheme(page, 'light');

    await page.getByRole('button', { name: 'More', exact: true }).click();
    await page.getByRole('radio', { name: 'Dark' }).click();
    await expectTheme(page, 'dark');
  });
});
