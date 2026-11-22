// The Pipeline board against a fake Supabase (step 2-c): it reads the `pipeline` view, a drag
// calls change_engagement_status() once, and a refusal snaps the card back with a plain message.
// Step 2-f: values come only from engagement_financials, and only for users with values access.
// Step 2-g: loading, empty, no-match and Try again states; the details dialog is a named modal
// dialog with focus, Tab and Esc handling.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DATA_MESSAGES } from '../src/lib/data/errors';
import { LIST_MESSAGES } from '../src/lib/data/listState';
import {
  ACCOUNTS,
  CONSULTANT_WITH_VALUES,
  mockSupabase,
  type FakeAccount,
  type FakeStack,
} from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });
// Desktop only: the one Playwright project is Desktop Chrome; this fixes the size too.
test.use({ viewport: { width: 1440, height: 900 } });

const CLIENT01_LEAD = 'e1a90000-0000-4000-8000-000000000001'; // tests/support/pipelineRows.ts
const RPC = 'POST /rest/v1/rpc/change_engagement_status';
const READ = 'GET /rest/v1/pipeline';
const VALUES = 'GET /rest/v1/engagement_financials';
const DECOY = '₹99'; // what a status view's value columns hold in the fake (support/auth.ts)

const count = (stack: FakeStack, call: string) => stack.calls.filter((c) => c === call).length;
const card = (page: Page, column: string, name: string) =>
  page.locator(`#column-${column}`).getByText(name, { exact: true });
// The count badge on the desktop Pipeline tab (Navbar.tsx: the tab's tabular-nums span).
const pipelineBadge = (page: Page) => page.locator('#nav-tab-pipeline span.tabular-nums');
const tableRow = (page: Page, name: string) => page.locator('tbody tr', { hasText: name });
const valueHeader = (page: Page) => page.getByRole('columnheader', { name: 'Value', exact: true });
const searchBox = (page: Page) =>
  page.getByPlaceholder('Filter pipeline by company, contact, or owner...');

async function showTable(page: Page) {
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(7);
}

/** Drags `from` onto `to` with the mouse, in small steps, as a person would. */
async function drag(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('A card to drag or to drop on is not on screen');
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 4 }); // past the 5 px activation distance
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  await page.mouse.up();
}

test('an Owner drags a lead to Proposal: one call, a refetch, and the card stays', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
  expect(count(stack, READ)).toBe(1);

  await drag(
    page,
    card(page, 'Lead', 'Client01 Demo Ltd'),
    card(page, 'Proposal', 'Client04 Demo Ltd'),
  );

  await expect(card(page, 'Proposal', 'Client01 Demo Ltd')).toBeVisible();
  await expect.poll(() => count(stack, READ)).toBe(2); // the refetch after the change
  expect(stack.statusChanges).toEqual([{ engagementId: CLIENT01_LEAD, newStatus: 'Proposal' }]);
  expect(count(stack, RPC)).toBe(1);
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  // The nav badge still counts the same 7 on the board.
  await expect(pipelineBadge(page)).toHaveText('7');
});

test('Marketing is refused on a lead it did not create: the card snaps back with a plain message', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.marketing });
  await page.goto('/');
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();

  await drag(
    page,
    card(page, 'Lead', 'Client01 Demo Ltd'),
    card(page, 'Proposal', 'Client04 Demo Ltd'),
  );

  const notice = page.getByRole('alert');
  await expect(notice).toHaveText(DATA_MESSAGES['not-allowed']);
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
  await expect(card(page, 'Proposal', 'Client01 Demo Ltd')).toHaveCount(0);
  await expect.poll(() => count(stack, READ)).toBe(2); // refetched after the refusal too
  expect(count(stack, RPC)).toBe(1); // never retried
  expect(stack.statusChanges).toEqual([{ engagementId: CLIENT01_LEAD, newStatus: 'Proposal' }]);
  // No ₹ for Marketing anywhere on the board (no values request; step 2-f).
  await expect(page.locator('#column-Lead')).not.toContainText('₹');

  await page.getByRole('button', { name: 'Close message' }).click();
  await expect(notice).toHaveCount(0);
});

test('when the board cannot be read, it says so and offers Try again', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner, pipelineFails: true });
  await page.goto('/');

  // Network errors are retried twice (3 tries, about 3 s) before the message shows.
  await expect(page.getByRole('alert')).toHaveText(DATA_MESSAGES.network, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled();
  expect(count(stack, READ)).toBe(3);
  await expect(page.locator('#column-Lead')).toHaveCount(0);
  await expect(pipelineBadge(page)).toHaveCount(0);
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

for (const [label, account] of [
  ['an Owner (profile flag off, as in the seed)', ACCOUNTS.owner],
  ['a Consultant with values access', CONSULTANT_WITH_VALUES],
] as [string, FakeAccount][]) {
  test(`${label} sees values from engagement_financials only: card, total, table, dialog`, async ({
    page,
  }) => {
    const stack = await mockSupabase(page, { signedInAs: account });
    await page.goto('/');
    const lead = page.locator('#column-Lead');
    await expect(lead.getByText('₹12,00,000')).toBeVisible(); // Client01's card
    await expect(page.locator('body')).not.toContainText(DECOY);
    await expect(lead.getByText('₹20,00,000')).toBeVisible(); // Lead total: 12 L + 4.5 L + 3.5 L
    expect(count(stack, VALUES)).toBe(1);

    await showTable(page);
    await expect(valueHeader(page)).toBeVisible();
    await expect(page.locator('thead th').nth(4)).toHaveText('Value');
    // Client03 has no financials row: an em dash in the value colour (DECISIONS 12-Oct-2026).
    const empty = tableRow(page, 'Client03 Demo Ltd').locator('td').nth(4);
    await expect(empty).toHaveText('—');
    await expect(empty).toHaveClass(/\btext-info\b/);

    await tableRow(page, 'Client01 Demo Ltd').click();
    await expect(page.getByText('Deal Value', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(DECOY);
  });
}

for (const [label, account] of [
  ['A default Consultant', ACCOUNTS.consultant],
  ['Marketing', ACCOUNTS.marketing],
] as [string, FakeAccount][]) {
  test(`${label} sees no value, total, Value column or Deal Value, and never asks for values`, async ({
    page,
  }) => {
    const stack = await mockSupabase(page, { signedInAs: account });
    await page.goto('/');
    await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('₹');

    await showTable(page);
    await expect(valueHeader(page)).toHaveCount(0);
    await expect(page.locator('thead th')).toHaveCount(6);
    // (No "—" check on the row: Client03's Last Contact cell is "—" by itself.)
    await expect(tableRow(page, 'Client03 Demo Ltd').locator('td')).toHaveCount(6);

    await tableRow(page, 'Client01 Demo Ltd').click();
    await expect(page.getByText('Current Stage', { exact: true })).toBeVisible();
    await expect(page.getByText('Deal Value', { exact: true })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('₹');
    expect(count(stack, VALUES)).toBe(0); // no values request ever leaves the browser
  });
}

test('when values cannot be read, the board still shows, with no value, total or dash', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner, financialsFails: true });
  await page.goto('/');
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
  // Network errors are retried twice (3 tries, about 3 s; src/lib/data/queryClient.ts line 7).
  await expect.poll(() => count(stack, VALUES), { timeout: 15_000 }).toBe(3);
  await expect(page.locator('body')).not.toContainText('₹');

  await showTable(page);
  await expect(valueHeader(page)).toBeVisible(); // the Owner may see values; none arrived
  await expect(page.locator('thead th').nth(4)).toHaveText('Value');
  await expect(tableRow(page, 'Client01 Demo Ltd').locator('td').nth(4)).toHaveText('');
  await expect(tableRow(page, 'Client03 Demo Ltd').locator('td').nth(4)).toHaveText('');
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});

test('while the board is being read, a loading line shows, with no board or badge', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner, holdReads: ['pipeline'] });
  try {
    await page.goto('/');
    const loading = page.getByText(LIST_MESSAGES.pipelineLoading, { exact: true });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute('role', 'status');
    await expect(page.locator('#column-Lead')).toHaveCount(0);
    await expect(pipelineBadge(page)).toHaveCount(0);
  } finally {
    stack.releaseReads();
  }
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
  await expect(page.getByText(LIST_MESSAGES.pipelineLoading, { exact: true })).toHaveCount(0);
});

test('with no open deals, it says so instead of the board and the table', async ({ page }) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner, pipelineEmpty: true });
  await page.goto('/');
  const empty = page.getByText(LIST_MESSAGES.pipelineEmpty, { exact: true });
  await expect(empty).toBeVisible();
  await expect(page.getByText('0 Open Deals')).toBeVisible();
  await expect(page.locator('#column-Lead')).toHaveCount(0);

  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(empty).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
});

test('a search with no match says so on board and table; Clear search brings the deals back', async ({
  page,
}) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();

  await searchBox(page).fill('zzz-no-such-deal');
  const noMatch = page.getByText(LIST_MESSAGES.pipelineNoMatch, { exact: true });
  await expect(noMatch).toBeVisible();
  await expect(page.locator('#column-Lead')).toHaveCount(0); // no "Drag deals here" columns
  await expect(page.getByText('7 Open Deals')).toBeVisible(); // the count is of all deals

  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(noMatch).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);

  await page.getByRole('button', { name: LIST_MESSAGES.clearSearch, exact: true }).click();
  await expect(searchBox(page)).toHaveValue('');
  await expect(page.locator('tbody tr')).toHaveCount(7);
  await expect(noMatch).toHaveCount(0);
});

test('Try again after a failed read shows the loading line, then the board', async ({ page }) => {
  const stack = await mockSupabase(page, {
    signedInAs: ACCOUNTS.owner,
    pipelineFailsFirst: 3,
    holdReads: ['pipeline'],
  });
  try {
    await page.goto('/');
    // The 3 failures aren't held (they abort before the hold): the message shows after them.
    await expect(page.getByRole('alert')).toHaveText(DATA_MESSAGES.network, { timeout: 15_000 });
    expect(count(stack, READ)).toBe(3);

    await page.getByRole('button', { name: LIST_MESSAGES.tryAgain, exact: true }).click();
    // The 4th read is held: the error is gone and the loading line is back (TanStack v5).
    await expect(page.getByText(LIST_MESSAGES.pipelineLoading, { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally {
    stack.releaseReads();
  }
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
  expect(count(stack, READ)).toBe(4);
  await expect(pipelineBadge(page)).toHaveText('7');
});

test('the details dialog is a named modal dialog: focus inside, Tab stays inside, Esc closes and focus returns', async ({
  page,
}) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await page.goto('/');
  await showTable(page);

  // Rows can't take focus yet (keyboard opening is on the later list). Focus the search box,
  // then open the row with a click event that doesn't move focus, to prove focus comes back.
  await searchBox(page).focus();
  await tableRow(page, 'Client01 Demo Ltd').dispatchEvent('click');

  const dialog = page.getByRole('dialog', { name: 'Client01 Demo Ltd' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toBeFocused();

  // Close is the only control inside, so Tab and Shift+Tab both stay on it.
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
