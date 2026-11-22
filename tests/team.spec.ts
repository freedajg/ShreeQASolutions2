// The header and owner names (step 2-e), against a fake Supabase. The header shows the
// signed-in person's own name and role from their profiles row, never from user metadata.
// Owner names come from one `team_members` read. An owner who isn't on the team shows
// "Unknown owner" and is logged once, never "?". The MVP team switcher is gone.
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, mockSupabase, type FakeStack } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });

const TEAM_READ = 'GET /rest/v1/team_members';
// Words of the old MVP team and its switcher; none may show anywhere in the signed-in app.
const MVP_WORDS = [
  'Pramila',
  'Ramesh',
  'Mahesh',
  'Sunita',
  'Founder',
  'Auditor',
  'Active Team Member',
  'Viewing as',
];
const UNKNOWN_WARNING = 'Owner id is not on the team:';

const count = (stack: FakeStack, call: string) => stack.calls.filter((c) => c === call).length;
const accountMenu = (page: Page) => page.getByRole('button', { name: 'Account menu' });
// Card avatars carry the owner's name as their title (PipelineView.tsx).
const leadAvatars = (page: Page, title: string) => page.locator(`#column-Lead [title="${title}"]`);

async function openBoard(page: Page) {
  await page.goto('/');
  await expect(page.locator('#column-Lead').getByText('Client01 Demo Ltd')).toBeVisible();
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('an Owner sees their own name and role, and owner names from one team read', async ({
    page,
  }) => {
    const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
    await openBoard(page);

    await expect(accountMenu(page)).toContainText('Demo Owner 1');
    await expect(accountMenu(page).getByText('Owner', { exact: true })).toBeVisible();
    // Lead column: Client01 (owner), Client02 and Client07 (consultant), Client03 (marketing).
    await expect(leadAvatars(page, 'Demo Owner 1')).toHaveText('D');
    await expect(leadAvatars(page, 'Demo Consultant 1')).toHaveCount(2);
    await expect(leadAvatars(page, 'Demo Marketing 1')).toHaveCount(1);

    await accountMenu(page).click();
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeVisible();
    for (const word of MVP_WORDS) await expect(page.locator('body')).not.toContainText(word);

    await page.locator('#nav-tab-clients').click();
    await expect(page.locator('tbody tr')).toHaveCount(5);
    expect(count(stack, TEAM_READ)).toBe(1); // Pipeline and Clients share one read
  });

  test('the header comes from the profiles row, not from user metadata', async ({ page }) => {
    await mockSupabase(page, {
      signedInAs: ACCOUNTS.consultant,
      userMetadata: { full_name: 'Metadata Name', role: 'owner' },
    });
    await openBoard(page);

    await expect(accountMenu(page)).toContainText('Demo Consultant 1');
    await expect(accountMenu(page).getByText('Consultant', { exact: true })).toBeVisible();
    await expect(accountMenu(page).getByText('Owner', { exact: true })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Metadata Name');
  });

  test('an owner not on the team shows "Unknown owner", is logged once, and never "?"', async ({
    page,
  }) => {
    const warnings: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().startsWith(UNKNOWN_WARNING)) {
        warnings.push(message.text());
      }
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await mockSupabase(page, {
      signedInAs: ACCOUNTS.owner,
      teamWithout: [ACCOUNTS.consultant.id],
    });
    await openBoard(page);

    const unknown = leadAvatars(page, 'Unknown owner');
    await expect(unknown).toHaveCount(2);
    await expect(unknown.first()).toHaveText('—');
    await expect(leadAvatars(page, 'Demo Owner 1')).toHaveText('D');

    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.locator('tbody')).toContainText('Unknown owner');
    await expect(page.locator('tbody')).not.toContainText('?');

    expect(warnings).toEqual([`${UNKNOWN_WARNING} ${ACCOUNTS.consultant.id}`]);
    expect(pageErrors, 'uncaught errors in the page').toEqual([]);
  });

  test('when the team cannot be read, the board still works and owners show nothing', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner, teamMembersFails: true });
    await openBoard(page);

    // Network errors are retried twice (3 tries, about 3 s), as for the other reads.
    await expect.poll(() => count(stack, TEAM_READ), { timeout: 15_000 }).toBe(3);
    await expect(page.locator('#column-Lead [title^="Demo "]')).toHaveCount(0);
    await expect(leadAvatars(page, 'Unknown owner')).toHaveCount(0);
    // An empty owner is known without the team list.
    await expect(page.locator('#column-Proposal [title="No owner"]')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0); // no banner for names alone
    expect(pageErrors, 'uncaught errors in the page').toEqual([]);
  });

  test('the Clients owner filter lists each owner once, by name, sorted', async ({ page }) => {
    await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
    await openBoard(page);
    await page.locator('#nav-tab-clients').click();
    await expect(page.locator('tbody tr')).toHaveCount(5);

    const ownerFilter = page.locator('select', {
      has: page.locator('option', { hasText: 'All Owners' }),
    });
    await expect(ownerFilter.locator('option')).toHaveText([
      'All Owners',
      'Demo Consultant 1',
      'Demo Owner 1',
    ]);
  });
});

test.describe('phone (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the bottom bar is a labelled landmark; the More sheet has no team list or empty block', async ({
    page,
  }) => {
    await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
    await page.goto('/');

    const bar = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(bar.getByRole('button', { name: /^Pipeline/ })).toBeVisible();
    await bar.getByRole('button', { name: 'More', exact: true }).click();

    const sheet = page.locator('div.fixed.inset-0');
    await expect(sheet.getByText('Theme', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Viewing as')).toHaveCount(0);
    // All More items are hidden screens, so their list isn't rendered at all (no gap).
    await expect(sheet.locator('div.space-y-1\\.5')).toHaveCount(0);
  });
});
