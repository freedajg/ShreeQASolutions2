// The Pipeline board against a fake Supabase (step 2-c): it reads the `pipeline` view, a drag
// calls change_engagement_status() once, and a refusal snaps the card back with a plain message.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DATA_MESSAGES } from '../src/lib/data/errors';
import { ACCOUNTS, mockSupabase, type FakeStack } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });
// Desktop only: the one Playwright project is Desktop Chrome; this fixes the size too.
test.use({ viewport: { width: 1440, height: 900 } });

const CLIENT01_LEAD = 'e1a90000-0000-4000-8000-000000000001'; // tests/support/pipelineRows.ts
const RPC = 'POST /rest/v1/rpc/change_engagement_status';
const READ = 'GET /rest/v1/pipeline';

const count = (stack: FakeStack, call: string) => stack.calls.filter((c) => c === call).length;
const card = (page: Page, column: string, name: string) =>
  page.locator(`#column-${column}`).getByText(name, { exact: true });
// The count badge on the desktop Pipeline tab (Navbar.tsx: the tab's tabular-nums span).
const pipelineBadge = (page: Page) => page.locator('#nav-tab-pipeline span.tabular-nums');

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
  // No ₹ for Marketing anywhere on the board (values stripped, as RLS does).
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
  expect(count(stack, READ)).toBe(3);
  await expect(page.locator('#column-Lead')).toHaveCount(0);
  await expect(pipelineBadge(page)).toHaveCount(0);
  expect(pageErrors, 'uncaught errors in the page').toEqual([]);
});
