// Add Lead against the fake Supabase (Add and Edit, session 2; plan 4h tests 1–8). The form is
// still off for everyone (src/lib/screens.ts addLead: false); these tests turn it on with the
// dev-server-only override `?features=addLead`, which the production build drops.
import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, mockSupabase, type FakeStack, type WriteTable } from './support/auth';

// The first page load waits for the dev server to compile the app.
test.describe.configure({ timeout: 60_000 });
// Desktop only: the one Playwright project is Desktop Chrome; this fixes the size too.
test.use({ viewport: { width: 1440, height: 900 } });

const WITH_ADD_LEAD = '/?features=addLead';

const writesTo = (stack: FakeStack, table: WriteTable) =>
  stack.writes.filter((w) => w.table === table);
const card = (page: Page, column: string, name: string) =>
  page.locator(`#column-${column}`).getByText(name, { exact: true });
const leadDialog = (page: Page) => page.getByRole('dialog', { name: 'New lead' });
const addLeadButton = (page: Page) => page.getByRole('button', { name: 'Add Lead', exact: true });
const submitButton = (page: Page) =>
  leadDialog(page).getByRole('button', { name: 'Add lead', exact: true });

/** Opens the board with the override, waits for it, then opens the Add Lead dialog. */
async function openAddLead(page: Page) {
  await page.goto(WITH_ADD_LEAD);
  await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
  await addLeadButton(page).click();
  await expect(leadDialog(page)).toBeVisible();
  // The dropdowns are filled from the database; wait for them before choosing.
  await expect(leadDialog(page).getByLabel('Certification')).toBeEnabled();
}

test('an Owner adds a lead for a new client: it appears in the Lead column', async ({ page }) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openAddLead(page);
  const dialog = leadDialog(page);

  await dialog.getByLabel('Company name').fill('Client20 Demo Ltd');
  await dialog.getByLabel('Contact person').fill('Contact 20');
  await dialog.getByLabel('Certification').selectOption('ISO 27001');
  // An Owner has values access, so the contract value field is there (left empty here).
  await expect(dialog.getByLabel('Contract value')).toBeVisible();
  await submitButton(page).click();

  await expect(leadDialog(page)).toHaveCount(0);
  await expect(card(page, 'Lead', 'Client20 Demo Ltd')).toBeVisible();
  expect(writesTo(stack, 'clients')).toHaveLength(1);
  expect(writesTo(stack, 'clients')[0].body).toMatchObject({
    name: 'Client20 Demo Ltd',
    contact_person: 'Contact 20',
  });
  const engagements = writesTo(stack, 'engagements');
  expect(engagements).toHaveLength(1);
  // Stage preselected Lead, owner preselected the signed-in Owner (answers Q5, Q14).
  expect(engagements[0].body).toMatchObject({
    certification_type: 'ISO 27001',
    status: 'Lead',
    owner_id: ACCOUNTS.owner.id,
  });
  expect(writesTo(stack, 'engagement_financials')).toHaveLength(0);
});

test('an Owner adds a lead for an existing client: no new client is created', async ({ page }) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openAddLead(page);
  const dialog = leadDialog(page);

  await dialog.getByLabel('Existing client').check();
  await dialog.getByLabel('Find a client').fill('Client03');
  await dialog
    .getByRole('combobox', { name: 'Client', exact: true })
    .selectOption({ label: 'Client03 Demo Ltd (Chennai)' });
  await dialog.getByLabel('Certification').selectOption('ISO 27701');
  await submitButton(page).click();

  await expect(leadDialog(page)).toHaveCount(0);
  // Client03 already had a lead; now it has two cards in the Lead column.
  await expect(card(page, 'Lead', 'Client03 Demo Ltd')).toHaveCount(2);
  expect(writesTo(stack, 'clients')).toHaveLength(0);
  const engagements = writesTo(stack, 'engagements');
  expect(engagements).toHaveLength(1);
  expect(engagements[0].body).toMatchObject({
    client_id: '5a3d1e00-0000-4000-8000-000000000003', // tests/support/rowBuilders.ts
    certification_type: 'ISO 27701',
  });
});

test('Add Lead invents nothing: empty email, phone and dates are sent as null', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openAddLead(page);
  const dialog = leadDialog(page);

  await dialog.getByLabel('Company name').fill('Client21 Demo Ltd');
  await dialog.getByLabel('Certification').selectOption('CMMI');
  await submitButton(page).click();
  await expect(leadDialog(page)).toHaveCount(0);

  expect(writesTo(stack, 'clients')[0].body).toEqual({
    client_code: null,
    name: 'Client21 Demo Ltd',
    industry: null,
    address: null,
    city: null,
    state_country: null,
    contact_person: null,
    designation: null,
    email: null,
    phone: null,
    website: null,
    priority: null,
    do_not_contact: false,
  });
  expect(writesTo(stack, 'engagements')[0].body).toMatchObject({
    standard_framework: null,
    lead_source: null,
    remarks: null,
    last_contacted_on: null,
    next_follow_up_on: null,
    initial_engagement_date: null,
    valid_to: null,
  });
  // No amount typed: no financials request at all (never a made-up value).
  expect(writesTo(stack, 'engagement_financials')).toHaveLength(0);
});

test('required fields: company and certification show field errors; nothing is sent', async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openAddLead(page);
  const dialog = leadDialog(page);

  await submitButton(page).click();

  await expect(dialog.getByText('Enter the company name.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Choose a certification.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Company name')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByLabel('Certification')).toHaveAttribute('aria-invalid', 'true');
  await expect(leadDialog(page)).toBeVisible();
  expect(stack.writes).toHaveLength(0);
});

test("the Add lead button can't be pressed twice: one client and one engagement are sent", async ({
  page,
}) => {
  const stack = await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openAddLead(page);
  const dialog = leadDialog(page);

  await dialog.getByLabel('Company name').fill('Client22 Demo Ltd');
  await dialog.getByLabel('Certification').selectOption('SOC 2');
  await submitButton(page).dblclick();

  await expect(leadDialog(page)).toHaveCount(0);
  await expect(card(page, 'Lead', 'Client22 Demo Ltd')).toHaveCount(1);
  expect(writesTo(stack, 'clients')).toHaveLength(1);
  expect(writesTo(stack, 'engagements')).toHaveLength(1);
});

test('client saved but lead failed: Try again sends only the engagement', async ({ page }) => {
  const stack = await mockSupabase(page, {
    signedInAs: ACCOUNTS.owner,
    writeFails: { engagements: 1 },
  });
  await openAddLead(page);
  const dialog = leadDialog(page);

  await dialog.getByLabel('Company name').fill('Client23 Demo Ltd');
  await dialog.getByLabel('Certification').selectOption('ISO 9001');
  await submitButton(page).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    "The client was saved, but the lead wasn't. Can't reach the server. Check that the local database is running.Try again",
  );
  // The saved client's fields are locked, so Try again can't send a different client.
  await expect(
    dialog.getByText('The client is saved. Try again adds only the lead.'),
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();

  await expect(leadDialog(page)).toHaveCount(0);
  await expect(card(page, 'Lead', 'Client23 Demo Ltd')).toBeVisible();
  expect(writesTo(stack, 'clients')).toHaveLength(1);
  const engagements = writesTo(stack, 'engagements');
  expect(engagements.map((w) => w.aborted)).toEqual([true, false]);
  expect(engagements[1].body.client_id).toBe(engagements[0].body.client_id);
});

test('owner list comes from team_members: active team members only, no MVP names', async ({
  page,
}) => {
  await mockSupabase(page, { signedInAs: ACCOUNTS.owner });
  await openAddLead(page);
  const owner = leadDialog(page).getByLabel('Owner');

  // ACCOUNTS: the role-less and the inactive account are left out; sorted by name.
  await expect(owner.locator('option')).toHaveText([
    'No owner',
    'Demo Consultant 1',
    'Demo Marketing 1',
    'Demo Owner 1',
  ]);
  await expect(owner).toHaveValue(ACCOUNTS.owner.id);
  for (const name of ['Ramesh', 'Sunita', 'Pramila', 'Mahesh']) {
    await expect(leadDialog(page)).not.toContainText(name);
  }
});

test('Consultant and Marketing see no Add Lead button', async ({ browser }) => {
  // A fresh browser context per account: the fake seeds one session per page.
  for (const account of [ACCOUNTS.consultant, ACCOUNTS.marketing]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      baseURL: 'http://localhost:3000', // playwright.config.ts `use.baseURL`
    });
    try {
      const page = await context.newPage();
      await mockSupabase(page, { signedInAs: account });
      await page.goto(WITH_ADD_LEAD);
      await expect(card(page, 'Lead', 'Client01 Demo Ltd')).toBeVisible();
      await expect(addLeadButton(page)).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
});
