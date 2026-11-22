// The Clients list against a fake Supabase (step 2-d): it reads the `active_clients` view once
// (the nav badge and the screen share it), shows each client's engagements in the detail
// dialog, never shows a value (or the Contract Value column) to a role without values access
// (values come only from engagement_financials, step 2-f), and gives Marketing (which
// reads no active clients) a plain message instead of an empty table.
import { expect, test, type Page } from '@playwright/test';
import { DATA_MESSAGES } from '../src/lib/data/errors';
import { ACCOUNTS, CONSULTANT_WITH_VALUES, mockSupabase, type FakeStack } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });
// Desktop only: the one Playwright project is Desktop Chrome; this fixes the size too.
test.use({ viewport: { width: 1440, height: 900 } });

const READ = 'GET /rest/v1/active_clients';
const VALUES = 'GET /rest/v1/engagement_financials';
const MARKETING_MESSAGE = 'Certified clients are shown to Owners and Consultants.';

const count = (stack: FakeStack, call: string) => stack.calls.filter((c) => c === call).length;
// The count badge on the desktop Clients tab (Navbar.tsx: the tab's tabular-nums span).
const clientsBadge = (page: Page) => page.locator('#nav-tab-clients span.tabular-nums');
const clientRows = (page: Page) => page.locator('table').first().locator('tbody tr');
const clientHeaders = (page: Page) => page.locator('table').first().locator('thead th');
const valueHeader = (page: Page) =>
  page.getByRole('columnheader', { name: 'Contract Value', exact: true });
// The client detail dialog has no dialog role (ClientsView.tsx): it is the fixed overlay that
// holds the client's name as its heading.
const clientDialog = (page: Page, name: string) =>
  page.locator('div.fixed.inset-0', { has: page.getByRole('heading', { name }) });

/** Opens the app (Pipeline is the landing screen), waits for the board, then opens Clients. */
async function openClients(page: Page) {
  await page.goto('/');
  await expect(page.locator('#column-Lead').getByText('Client01 Demo Ltd')).toBeVisible();
  await page.locator('#nav-tab-clients').click();
}

test('an Owner sees the 5 clients from one read, with values, and their certifications', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openClients(page);

  await expect(clientRows(page)).toHaveCount(5);
  await expect(page.getByText('5 Active Accounts')).toBeVisible();
  await expect(clientsBadge(page)).toHaveText('5');
  expect(count(stack, READ)).toBe(1); // the badge and the screen share one read
  await expect(clientRows(page).first()).toContainText('₹');
  await expect(valueHeader(page)).toBeVisible();
  await expect(clientHeaders(page).nth(5)).toHaveText('Contract Value');
  // Client10's only engagement has a financials row with no amount: "—".
  const client10 = clientRows(page).filter({ hasText: 'Client10 Demo Ltd' });
  await expect(client10.locator('td').nth(5)).toHaveText('—');
  expect(count(stack, VALUES)).toBe(1);
  await expect(page.locator('body')).not.toContainText('₹99'); // the fake view's decoy

  // Completed with no certificate dates: Valid To shows "—", never an estimate.
  await clientRows(page).filter({ hasText: 'Client10 Demo Ltd' }).click();
  const dialog = clientDialog(page, 'Client10 Demo Ltd');
  await expect(dialog.getByText('Certifications', { exact: true })).toBeVisible();
  const certifications = dialog.locator('tbody tr');
  await expect(certifications).toHaveCount(1);
  await expect(certifications.locator('td')).toHaveText(['ISO 13485', 'Completed', '—']);
});

test('a Consultant without values access sees the same clients, no ₹ and no Contract Value column', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.consultant });
  await openClients(page);

  await expect(clientRows(page)).toHaveCount(5);
  await expect(clientsBadge(page)).toHaveText('5');
  await expect(page.locator('body')).not.toContainText('₹');
  await expect(valueHeader(page)).toHaveCount(0);
  await expect(clientHeaders(page)).toHaveCount(6);

  await clientRows(page).filter({ hasText: 'Client09 Demo Ltd' }).click();
  const dialog = clientDialog(page, 'Client09 Demo Ltd');
  await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('body')).not.toContainText('₹');
  expect(count(stack, VALUES)).toBe(0);
});

test('a Consultant with values access sees the Contract Value column and ₹ (step 2-f)', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: CONSULTANT_WITH_VALUES });
  await openClients(page);

  await expect(clientRows(page)).toHaveCount(5);
  await expect(valueHeader(page)).toBeVisible();
  await expect(clientHeaders(page).nth(5)).toHaveText('Contract Value');
  await expect(clientRows(page).first()).toContainText('₹');
  expect(count(stack, VALUES)).toBe(1);
  await expect(page.locator('body')).not.toContainText('₹99');
});

test('Marketing reads no active clients: a plain message, no table, no badge, no ₹', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.marketing });
  await openClients(page);

  await expect(page.getByText(MARKETING_MESSAGE)).toBeVisible();
  expect(count(stack, READ)).toBe(1); // the app still asks; the database decides
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.getByText('0 Active Accounts')).toBeVisible();
  await expect(clientsBadge(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('₹');
  expect(count(stack, VALUES)).toBe(0);
});

test('when the clients cannot be read, Clients says so and offers Try again', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const stack = await mockSupabase(page, {
    signedInAs: ACCOUNTS.owner,
    activeClientsFails: true,
  });
  await openClients(page); // the board still loads: only the Clients read fails

  // Network errors are retried twice (3 tries, about 3 s) before the message shows.
  await expect(page.getByRole('alert')).toHaveText(DATA_MESSAGES.network, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(count(stack, READ)).toBe(3);
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(clientsBadge(page)).toHaveCount(0);
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});
