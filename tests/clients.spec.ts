// The Clients list against a fake Supabase (step 2-d): it reads the `active_clients` view once
// (the nav badge and the screen share it), shows each client's engagements in the detail
// dialog, never shows a value (or the Contract Value column) to a role without values access
// (values come only from engagement_financials, step 2-f), and gives Marketing (which
// reads no active clients) a plain message instead of an empty table.
// Step 2-g: loading, empty, no-match and Try again states; the details dialog is a named modal
// dialog with focus, Tab and Esc handling.
import { expect, test, type Page } from '@playwright/test';
import { DATA_MESSAGES } from '../src/lib/data/errors';
import { LIST_MESSAGES } from '../src/lib/data/listState';
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
// The client detail dialog, by its role and its name (the heading, via aria-labelledby; 2-g).
const clientDialog = (page: Page, name: string) => page.getByRole('dialog', { name });
const searchBox = (page: Page) =>
  page.getByPlaceholder('Search clients by name, contact, city, or certification...');

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
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  expect(count(stack, READ)).toBe(3);
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(clientsBadge(page)).toHaveCount(0);
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

test('while the clients are being read, a loading line shows', async ({ page }) => {
  const stack = await mockSupabase(page, {
    signedInAs: ACCOUNTS.owner,
    holdReads: ['active_clients'],
  });
  try {
    await openClients(page); // the board isn't held; the nav badge's read of clients is
    const loading = page.getByText(LIST_MESSAGES.clientsLoading, { exact: true });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute('role', 'status');
    await expect(page.locator('tbody tr')).toHaveCount(0);
    await expect(clientsBadge(page)).toHaveCount(0);
  } finally {
    stack.releaseReads();
  }
  await expect(clientRows(page)).toHaveCount(5);
});

test('an Owner with no active clients gets a plain message, not an empty table', async ({
  page,
}) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner, activeClientsEmpty: true });
  await openClients(page);

  await expect(page.getByText(LIST_MESSAGES.clientsEmpty, { exact: true })).toBeVisible();
  await expect(page.getByText('0 Active Accounts')).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
  await expect(page.getByText(MARKETING_MESSAGE)).toHaveCount(0);
});

test('a search or filters with no match say so; Clear search and filters brings all 5 back', async ({
  page,
}) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openClients(page);
  await expect(clientRows(page)).toHaveCount(5);
  const noMatch = page.getByText(LIST_MESSAGES.clientsNoMatch, { exact: true });
  const clear = page.getByRole('button', { name: LIST_MESSAGES.clearSearchAndFilters });

  // Search alone
  await searchBox(page).fill('zzz-no-such-client');
  await expect(noMatch).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
  await clear.click();
  await expect(searchBox(page)).toHaveValue('');
  await expect(clientRows(page)).toHaveCount(5);

  // Filters alone: ISO 13485 is Client10's only engagement, owned by Demo Owner 1, so with
  // owner Demo Consultant 1 nothing matches (tests/support/activeClientRows.ts).
  const [standard, owner] = [page.locator('select').nth(0), page.locator('select').nth(1)];
  await standard.selectOption('ISO 13485');
  await owner.selectOption({ label: 'Demo Consultant 1' });
  await expect(noMatch).toBeVisible();
  await clear.click();
  await expect(standard).toHaveValue('ALL');
  await expect(owner).toHaveValue('ALL');
  await expect(clientRows(page)).toHaveCount(5);
  await expect(noMatch).toHaveCount(0);
});

test('Try again after a failed read shows the loading line, then the clients', async ({ page }) => {
  const stack = await mockSupabase(page, {
    signedInAs: ACCOUNTS.owner,
    activeClientsFailsFirst: 3,
    holdReads: ['active_clients'],
  });
  try {
    await openClients(page);
    await expect(page.getByRole('alert')).toHaveText(DATA_MESSAGES.network, { timeout: 15_000 });
    expect(count(stack, READ)).toBe(3);

    await page.getByRole('button', { name: LIST_MESSAGES.tryAgain, exact: true }).click();
    await expect(page.getByText(LIST_MESSAGES.clientsLoading, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    stack.releaseReads();
  }
  await expect(clientRows(page)).toHaveCount(5);
  expect(count(stack, READ)).toBe(4);
  await expect(clientsBadge(page)).toHaveText('5');
});

test('the client dialog is a named modal dialog: focus inside, Tab stays inside, Esc closes and focus returns', async ({
  page,
}) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openClients(page);
  await expect(clientRows(page)).toHaveCount(5);

  // Rows can't take focus yet (later list): focus the search box, open the row with a click
  // event that doesn't move focus, and check focus comes back to the search box.
  await searchBox(page).focus();
  await clientRows(page).filter({ hasText: 'Client01 Demo Ltd' }).dispatchEvent('click');

  const dialog = clientDialog(page, 'Client01 Demo Ltd');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toBeFocused();

  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(searchBox(page)).toBeFocused();
});

test('Last Audit and Valid To show dd-MMM-yyyy (step 2-g2)', async ({ page }) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openClients(page);
  await expect(clientRows(page)).toHaveCount(5);

  // Client01: last_audit_date '2026-03-10', valid_to '2027-03-14'.
  const client01 = clientRows(page).filter({ hasText: 'Client01 Demo Ltd' });
  await expect(client01.locator('td').nth(3)).toHaveText('10-Mar-2026');
  await expect(client01.locator('td').nth(4)).toContainText('14-Mar-2027');

  // Client09: latest audit '2025-11-18'; valid_to '2028-05-31' and '2026-11-20'.
  const client09 = clientRows(page).filter({ hasText: 'Client09 Demo Ltd' });
  await expect(client09.locator('td').nth(3)).toHaveText('18-Nov-2025');
  await expect(client09.locator('td').nth(4)).toContainText('31-May-2028');
  await expect(client09.locator('td').nth(4)).toContainText('20-Nov-2026');

  // Client10: no audit date, no certificate dates: "—", never an estimate.
  const client10 = clientRows(page).filter({ hasText: 'Client10 Demo Ltd' });
  await expect(client10.locator('td').nth(3)).toHaveText('—');

  // Dialog Valid To uses the same format.
  await client01.click();
  const dialog = clientDialog(page, 'Client01 Demo Ltd');
  await expect(dialog.locator('tbody tr').first().locator('td').last()).toHaveText('14-Mar-2027');
});
