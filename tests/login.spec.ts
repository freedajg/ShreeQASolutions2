// Sign-in, sign-out and the signed-out gate (Phase 1, step 12), against a fake Supabase.
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, TEST_PASSWORD, mockSupabase, type FakeAccount } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

const INVALID = 'Email or password is incorrect.';
const NO_ACCESS = "Your account doesn't have access yet. Please contact an Owner.";
const CONNECTION = "Can't reach the server. Check that the local database is running.";

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function savedSession(page: Page) {
  return page.evaluate(() => localStorage.getItem('drishti-auth'));
}

async function expectLoginPage(page: Page) {
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('header nav')).toHaveCount(0);
}

test('signed-out visitors see only the login page, also after a reload', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  await expectLoginPage(page);
  await page.reload();
  await expectLoginPage(page);
});

test('a wrong password and an unknown email get the same message', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');

  await signIn(page, ACCOUNTS.owner.email, 'wrong-password');
  await expect(page.getByRole('alert')).toHaveText(INVALID);
  await expect(page.getByLabel('Password')).toHaveValue('');

  await signIn(page, 'nobody@example.com', TEST_PASSWORD);
  await expect(page.getByRole('alert')).toHaveText(INVALID);
  expect(await savedSession(page)).toBeNull();
});

test('empty fields are caught before anything is sent', async ({ page }) => {
  const stack = await mockSupabase(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Enter your email and password.');
  expect(stack.calls.filter((c) => c.startsWith('POST /auth/v1/token'))).toEqual([]);
});

test('too many attempts get a plain message', async ({ page }) => {
  await mockSupabase(page, { rateLimited: true });
  await page.goto('/');
  await signIn(page, ACCOUNTS.owner.email, TEST_PASSWORD);
  await expect(page.getByRole('alert')).toHaveText(
    'Too many attempts. Wait a few minutes and try again.',
  );
});

for (const [label, account] of [
  ['a role-less user', ACCOUNTS.roleless],
  ['an inactive user (RLS returns no profile row)', ACCOUNTS.inactive],
] as [string, FakeAccount][]) {
  test(`${label} is signed straight out with the no-access message`, async ({ page }) => {
    const stack = await mockSupabase(page);
    await page.goto('/');
    await signIn(page, account.email, TEST_PASSWORD);
    await expect(page.getByRole('alert')).toHaveText(NO_ACCESS);
    await expectLoginPage(page);
    expect(await savedSession(page)).toBeNull();
    expect(stack.calls).toContain('POST /auth/v1/logout');
  });
}

test('a failed profile check after a good sign-in shows the connection message', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { profileFails: true });
  await page.goto('/');
  await signIn(page, ACCOUNTS.owner.email, TEST_PASSWORD);
  await expect(page.getByRole('alert')).toHaveText(CONNECTION);
  await expectLoginPage(page);
  expect(await savedSession(page)).toBeNull();
  expect(stack.calls).toContain('POST /auth/v1/logout');
  // Tried once: no silent retries while the user waits.
  expect(stack.calls.filter((c) => c === 'GET /rest/v1/profiles')).toHaveLength(1);
});

test('every role lands on Pipeline', async ({ page }) => {
  // Pipeline is the landing screen for everyone while the other screens are hidden (step 2-a2).
  for (const account of [
    ACCOUNTS.owner,
    ACCOUNTS.consultant,
    ACCOUNTS.marketing,
  ] as FakeAccount[]) {
    await mockSupabase(page);
    await page.goto('/');
    await signIn(page, account.email, TEST_PASSWORD);
    await expect(page.locator('#nav-tab-pipeline')).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'Switch active user' }).click();
    await expect(page.getByText(account.full_name, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expectLoginPage(page);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('the role comes from the profiles row only, not from user metadata', async ({ page }) => {
  // The session and token claim "owner" (user metadata, editable by the user); the profile
  // row says Marketing. The app must treat the user as Marketing.
  await mockSupabase(page, { signedInAs: ACCOUNTS.marketing, userMetadata: { role: 'owner' } });
  await page.goto('/');
  await expect(page.locator('#nav-tab-pipeline')).toHaveAttribute('aria-current', 'page');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('drishti-auth') ?? '{}').user?.user_metadata?.role,
    ),
  ).toBe('owner');
});

test('a saved session opens the app; sign-out ends it and returns to the login page', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');
  await expect(page.locator('#nav-tab-pipeline')).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Switch active user' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expectLoginPage(page);
  expect(await savedSession(page)).toBeNull();
  expect(stack.calls).toContain('POST /auth/v1/logout');

  await page.reload();
  await expectLoginPage(page);
});

test.describe('phone (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Sign out from the More menu', async ({ page }) => {
    await mockSupabase(page, { signedInAs: ACCOUNTS.consultant });
    await page.goto('/');
    await page.getByRole('button', { name: 'More', exact: true }).click();
    await expect(page.getByText('Demo Consultant 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(await savedSession(page)).toBeNull();
  });
});
