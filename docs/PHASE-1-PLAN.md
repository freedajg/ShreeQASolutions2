# Phase 1: Database, roles and login

**Branch:** `phase-1` · **Plan agreed:** 03-Oct-2026
**Reads with:** `PLAN.md` Phase 1 (and Phase 2 for ordering) · `PRD.md` §4, §6, FR-1, FR-4, FR-9 · `TECH-STACK.md` §4, §8 · `SECURITY.md` A2, A3, A10, B2, B5 · `DECISIONS.md`

## Goal

1. A local Supabase database with every table, view and rule Drishti needs, built only through migration files (written fresh; no earlier schema files exist).
2. Permissions enforced **in the database** for Owner, Consultant and Marketing (PRD FR-9). Each rule is proven by pgTAP tests in CI.
   - **Reading:**
     - Marketing sees leads only and never sees contract value or payment status.
     - Consultants don't see contract value or payment status unless an Owner switches it on for them.
   - **Editing:**
     - Owners edit everything.
     - Consultants edit only the engagements they own, but can add notes to any.
     - Marketing edits only the leads it created.
3. Seed data built **only** from `test-data/SQAS_Client_Database_DUMMY.xlsx`.
4. Invite-only login (password, plus magic link), with MFA required for Owners.

**Deadline:** client demo around **17-Oct-2026**, run on Freeda's laptop against the **local** stack (no hosted project, no link). It needs Phase 1 **and** Phase 2:
- login;
- each role seeing only what it should;
- Pipeline and Clients showing real saved data.

So the steps are ordered **demo-critical first**. The can-wait steps come after the Phase 2 demo work, but they're still part of Phase 1's "Done when" and must be finished before Phase 1 is ticked.

**MFA rule:** MFA for Owners (step 18) may come after the demo, but it **must be finished before any real client data goes into any database**.

## Rules for this phase

- Each step is one small commit on `phase-1`. Before each commit: `bun run typecheck`, `bun run lint`, `bun run test`, and (once step 5 exists) the database tests.
- **⚠ = one step at a time, explain plan first.** Any step that touches the database, deletes anything, or changes git history: Claude Code explains exactly what will run and what it changes, Freeda approves, then it runs, the result is shown, and it stops.
- **Real client data never** enters this phase:
  - the real Excel is never opened, copied into the repo, or loaded into any database;
  - only the DUMMY file in `test-data/` is used.
- **Renewal tests use the fixed reference date 29-Sep-2026** (the date the Test Notes sheet uses), never today's date.
- No new package without approval and a DECISIONS.md line (SECURITY.md B5).
- Config and security files (`.claude/settings.json`, `ci.yml`, `package.json` scripts, `supabase/config.toml`) are shown as a diff before writing.
- Never `supabase db reset --linked`, never anything against a hosted project. Everything is local.
- **Fixing a migration (agreed 03-Oct-2026):** before its commit, a bug is fixed in the migration file itself and the local database rebuilt with `supabase db reset` (with Freeda's OK each time). After the commit, a migration is never edited; fixes go in a new migration.
- Commit subjects never include client names.

## Steps

**Demo:** ● = demo-critical · ○ = can wait until after the demo
**Hrs:** Freeda's hours, including reviews and screenshots
**Care:** ⚠ = one step at a time, explain plan first

| # | Commit | Demo | Hrs | Care | Done when | Done |
|---|---|---|---|---|---|---|
| 1 | **docs:** add this plan; DECISIONS lines for the approved choices | ● | 0.5 | | Freeda approves the plan | ✓ 8756a57 |
| 2 | **chore:** Supabase CLI as an exact-version dev dependency; `trustedDependencies` entry; scripts `db:start`, `db:stop`, `db:test`, `db:types`; permission rules updated for the new script names | ● | 1 | | The CLI runs (`bun x supabase --version`); `bun pm untrusted` shows nothing blocked; the lockfile is committed; the install script's download source and checksum check recorded in DECISIONS | ✓ 703d764 |
| 3 | *(no commit)* Check `docker info` works. Docker Desktop 4.93.0 (WSL 2) is already installed, and WSL already caps itself at 4 GB. `.wslconfig` is changed only if it's slow later. | ● | 0.25 | | `docker info` reports a running engine | ✓ no commit |
| 4 | **chore:** `supabase init`. `config.toml` with sign-up off, and Studio, analytics, Storage, Realtime and Edge Runtime off; first local start; RAM measured | ● | 1 | ⚠ | The local stack starts and stops cleanly; RAM use recorded in DECISIONS | ✓ be8f36e |
| 5 | **feat(db):** migration `…_profiles_roles`: role type; `profiles` (name, role, booking link, mailbox connected, `can_see_values`, `theme_preference`, active); the trigger that creates a profile for each new login (role only from server-set `app_metadata`); role helpers (`current_app_role`, `is_owner`, `can_see_values`) in the private `app` schema; a guard so only an Owner changes role, values access, active status, email or mailbox status, and **the last active Owner can never be demoted, deactivated or deleted**; `team_members` view of colleagues' safe columns only. *(Swapped with the old step 6 on 03-Oct-2026: lookups need the role helpers.)* | ● | 2 | ⚠ | `bun run db:test` passes (38 pgTAP checks): a user edits their own name but not their own role, values access or active status; a Consultant can't see a colleague's `can_see_values`; a role-less or inactive user gets no data access; the last active Owner can't remove their own role or deactivate themselves; `anon` gets nothing | ✓ 8cfa8ea |
| 6 | **feat(db):** migration `…_lookups`: lookup tables (16 certification types with default cycles, 10 statuses with their group, payment statuses, priorities, lead sources), keyed by the exact Excel spellings; RLS. Statuses are read-only (changed only by a new migration); in the other four lists Owners can add values and change cycles, sort order and `active`, but can't rename or delete a value | ● | 2 | ⚠ | pgTAP (34 checks): exact values and default cycles; every role-holder can read; only Owners can change the four editable lists; nobody can change statuses, rename or delete a value; `anon`, role-less and inactive users get nothing | ✓ 3fd956c |
| 7 | **feat(db):** migration `…_clients_engagements`: `clients` and `engagements` (one client, many engagements) with every Excel column (PRD §6.2), plus do-not-contact on the client, and last contacted, next follow-up and date-is-estimated on the engagement; created by and archived on both. Lead source (AB) is on the engagement, not the client (decided 04-Oct-2026). Contract value and payment status go in a separate `engagement_financials` table (choice 3). | ● | 2 | ⚠ | Every one of the 30 Excel columns has exactly one home (checked against PRD §6.2) | ✓ 275121d |
| 8 | **feat(db):** RLS on `clients`, `engagements`, `engagement_financials` for each role, with pgTAP tests per role per table, for **reading and editing** (Owner, Consultant, Consultant with `can_see_values`, Marketing, `anon`) | ● | 3.5 | ⚠ | pgTAP proves the rules below | ✓ 905a244 |
| 9 | **feat(db):** views `pipeline` (Lead, Proposal, On Hold), `delivery` (In Progress, Implemented, Audit Completed), `active_clients` (Certified, Renewal Due, Completed), `closed` (Closed) and `needs_review` (no status, or a status with no group), all `security_invoker = true`, select-only, same 43 columns, financials left-joined; with pgTAP tests *(closed and needs_review added 06-Oct-2026)* | ● | 1 | ⚠ | pgTAP (67 checks): each view returns only its statuses and obeys RLS; every engagement is in exactly one view; Marketing gets `pipeline` rows only; no values without values access; role-less and inactive users get nothing; anon is refused | ✓ 229cd00 |
| 10 | **feat(db):** seed from the DUMMY file: `scripts/build-seed.ts` writes `supabase/seed.sql`; fake test users for each role; local load (`bun run db:seed`, no reset) | ● | 2.5 | ⚠ | 23 engagements and the right number of clients loaded; bad values left empty and flagged; the seed diff reviewed; the script refuses any file that isn't the DUMMY file | ✓ a822b07 |
| 11 | **ci:** database-test job (start a minimal local stack on the runner, run `bun run db:test`) | ● | 1.5 | | Green in CI after a push (Freeda approves the push) | ✓ 7c9012e (CI run 37579924424) |
| 12 | **feat(auth):** `@supabase/supabase-js` (approval), login page (email + password), sign-out, "not signed in → login" gate; invite-only | ● | 3 | | Freeda logs in as each seeded user; a wrong password shows a plain message; signed-out users see only the login page | ✓ 2a80327 + 8ccbb79 + email-login config fix (this commit). Manual check passed 10-Oct-2026: 5 demo logins land correctly (Owners/Consultants → Drishti, Marketing → Pipeline), sign-out + reload stays on login, wrong password and unknown email show the same message |
| 13 | **test:** per-role check: log in as each role; call the API directly with each role's session and show what comes back (screenshots + saved output) | ● | 1.5 | | Owner sees values; default Consultant doesn't; Marketing sees leads only, with no ₹ in any response | ✓ b45204f. `bun run check:roles` passed 10-Oct-2026: 80 PASS, 0 FAIL. 5 real logins, sign-up refused (signup_disabled, profiles 5 → 5), per-role counts as expected, no values and no ₹ for consultant1 and marketing1; anon refused. Redacted output kept outside the repo. |
| 14 | **feat(db):** `activity_log` (insert-only), plus a `change_engagement_status()` function that logs every status change. Phase 2's Pipeline drag needs this. | ● | 1.5 | ⚠ | pgTAP: nobody can update or delete a log row; a status change writes exactly one log row with who, when, from and to, and obeys the step 8 edit rules | ✓ db0e9e0. pgTAP 126; db:test 420 PASS (294 + 126); db:seed-check PASS. Applied with `migration up --local` after a rolled-back dry run, no reset |
| | **↓ Phase 2 demo-critical steps go here (see below), then the can-wait steps** | | | | | |
| 15 | **feat(db):** renewal-date function `renewal_due(engagement, as_of date)` (PRD FR-4 rule: surveillance → next audit → valid to → estimate from completion date + default cycle), `v_renewals` view, buckets Overdue / 30 / 31–90 / Later | ○ | 3 | ⚠ | pgTAP calls it with **as_of = 29-Sep-2026** for every DUMMY row and matches the Test Notes sheet exactly | |
| 16 | **feat(db):** `email_threads`, `email_messages`, `follow_ups`, `app_settings` (intervals, reminder windows, retention), `import_batches`, all with RLS and pgTAP per role | ○ | 2.5 | ⚠ | pgTAP: each table refuses `anon`, Marketing sees none of them, Consultants only their own engagements' rows | |
| 17 | **feat(auth):** magic-link sign-in; the email arrives in the local test inbox (Mailpit) | ○ | 1 | | A magic link logs in a seeded user; an unknown email gets the same neutral message and no link | |
| 18 | **feat(auth):** MFA required for Owners: authenticator enrolment screen; Owner data rules require a second factor (Postgres `aal2`), with pgTAP. **Must be done before any real data goes in.** | ○ | 3 | ⚠ | An Owner without MFA is sent to set it up and can read no data until they do; pgTAP proves Owner access needs `aal2` | |
| 19 | **test:** an uninvited email can't sign up; a deactivated user can't log in and their history keeps their name *(The uninvited sign-up check is already done by `check:roles` since step 13; step 19 keeps the deactivated-user check and adds the CI run of `check:roles --ci`.)* | ○ | 0.5 | | Both shown with saved output | |
| 20 | **review:** `/security-review` and a fresh-session review of the whole phase diff; dotfile diff check; fixes | ○ | 1.5 | | No open findings, or each one logged with a reason | |
| 21 | **docs:** DECISIONS lines, a Memory Palace lesson (no client data), tick PLAN.md Phase 1 boxes, open PR | ○ | 1 | | PR open with CI green; Freeda merges | |

**Step 8: the pgTAP rules it must prove**

| Role | Reading | Editing |
|---|---|---|
| Owner | All clients, engagements and financials | Edits all of them |
| Consultant | All engagements; no financials | Edits only engagements they own; can add notes on any engagement; can't edit others' engagements |
| Consultant with `can_see_values` | All engagements, plus financials | Same editing rules as a default Consultant |
| Marketing | Pipeline-group engagements only (Lead, Proposal, On Hold) and the clients behind them; no financials | Edits only leads it created |
| `anon` (not logged in) | Nothing | Nothing |

Nobody can hard-delete.

**Note (04-Oct-2026):** in `statuses`, On Hold is in the `paused` group, not `pipeline` (PRD §6.4). Marketing's "leads only" must include On Hold, so the rule matches both groups (`pipeline` and `paused`) or names the three statuses. Checking `status_group = 'pipeline'` alone would hide On Hold. The same applies to the step 9 `pipeline` view.

**Note for step 9 (06-Oct-2026):** any view that shows financials must **left join** `engagement_financials`. Engagements created by Marketing, or by Consultants without values access, have no financials row, so an inner join would drop them from the view.

**Note for step 14 (11-Oct-2026):** notes on engagements are **not** part of step 14; they move to after the demo. Until then, "Consultants can add notes on any engagement" (Goal 2 and the step 8 table) isn't built. The comment at `20261006100000_clients_engagements_rls.sql:31` that puts notes in step 14 is out of date and stays as it is (applied migration).

**Demo note (11-Oct-2026):** seeded leads have no creator (`created_by` is empty, DECISIONS 07-Oct-2026), so Demo Marketing 1 can't drag any seeded lead. The demo shows Marketing being refused when dragging a seeded lead; that refusal is the role rule at work. Add Lead stays hidden until Questionnaire Q4 is answered (DECISIONS 12-Oct-2026, decision A).

**Totals:**
- Phase 1 demo-critical (steps 1–14): **≈ 23.25 h**
- Phase 1 can-wait (steps 15–21): **≈ 12.5 h**
- Phase 1 in all: **≈ 35.75 h**

### Phase 2 demo-critical steps (summary; detailed plan comes after Phase 1)

| # | What | Hrs | Done |
|---|---|---|---|
| 2-a | supabase-js data layer + TanStack Query (approval); generated database types | 1.5 | ✓ aa0d805. `@tanstack/react-query` 5.104.0 (exact; lockfile adds only it and `query-core` 5.104.0; `bun pm untrusted` 0). `src/types/database.ts` from `bun run db:types`, no keys in it. typecheck PASS; lint 0 errors; test 129 PASS (30 new in `src/lib/data/`); format:check PASS. Manual login check passed 11-Oct-2026: Owner sign-in, sign-out, Marketing sign-in all work; Console shows no errors (only the React DevTools tip). No screen reads the new layer yet |
| 2-a2 | Hide every screen not yet connected to the database, for every role (`src/lib/screens.ts`); Pipeline is the landing screen | 2.75 | ✓ b8733d5. Shown: Pipeline, Clients. Hidden (no nav item, never mounted, address lands on Pipeline): Drishti, Dashboard, Renewal Radar, Import, Settings; email drafts off; saved AI keys blanked on load. typecheck PASS; lint 0 errors; test 137 PASS (8 new); format:check PASS; check:colors PASS. Playwright: smoke, login, theme 21 PASS; visual 26 baselines re-made by name (SHA-256: 26 match their actual, 24 byte-identical), then `test:e2e` twice: 0 failed, 20 skipped |
| 2-b | Types become `Client` + `Engagement`; adapt Pipeline and Clients | 4 | ✓ d416b69. New types in `src/types/crm.ts` (MVP types unchanged); Pipeline and Clients show view-shaped sample rows through the new mapping code; board columns Lead / Proposal / On Hold. typecheck PASS; lint 0 errors (PipelineView and ClientsView off the legacy-warnings list, 0 warnings); test 160 PASS (23 new); format:check PASS; check:colors PASS. Visual: 22 baselines re-made by name (SHA-256: 22 match their actual, 28 byte-identical); `test:e2e` twice: 47 passed, 0 failed, 24 skipped |
| 2-c | Pipeline board reads `pipeline`; drag calls `change_engagement_status()` | 2.5 | ✓ b923f3e. Board reads `pipeline`; drag calls change_engagement_status() (optimistic in the UI, snaps back on refusal). typecheck PASS; lint 0 errors (31 legacy warnings); test 168 PASS (8 new); format:check PASS; check:colors PASS; build proof: pipeline sample rows absent from dist. Playwright: 3 new in pipeline.spec.ts; test:e2e twice: 50 passed, 0 failed, 24 skipped; no baseline changed. Live check 12-Oct-2026: Owner move saved and logged; Consultant and Marketing refused, not logged |
| 2-c2 | Lead dialog status list (incl. In Progress, Closed) calling `change_engagement_status()`; 2 lead-detail baselines re-made. After the 17-Oct-2026 demo | 1 | |
| 2-d | Clients list reads `active_clients`; client detail with its engagements | 2.5 | ✓ 350361a. Clients reads `active_clients` (useQuery + toClients); badge from the same hook; client dialog lists Certifications (Certification · Status · Valid To). typecheck PASS; lint 0 errors (31 legacy warnings); test 175 PASS (7 new); format:check PASS; check:colors PASS; build proof: active-client rows and builders absent from dist (control present). Playwright: 4 new in clients.spec.ts; visual: 2 baselines re-made by name (client-detail dark and light; SHA-256: 2 match their actual, 48 byte-identical); test:e2e twice: 54 passed, 0 failed, 24 skipped. Live check 12-Oct-2026: Owner 8 clients with ₹; Consultant 1 no ₹; Consultant 2 ₹; Marketing role message, no badge |
| 2-e | Hard-coded team replaced with `profiles` | 2 | ✓ dac7547. Owner names from `team_members` (useQuery, key holds the user id); header shows the signed-in profile's name + role; MVP team switcher removed; `src/lib/data/sampleRows.ts` deleted (team → `tests/support/team.ts`). typecheck PASS; lint 0 errors (30 legacy warnings); test 189 PASS (14 files); format:check PASS; check:colors PASS; build PASS + build proof PASS (`team_members` and `Main navigation` present; sample ids and switcher strings absent). Playwright: 6 new in team.spec.ts; visual: 22 baselines replaced by name (SHA-256: 22 match their actual, 28 byte-identical, step2e-hashes.csv); test:e2e twice: 60 passed, 0 failed, 24 skipped (1.9 m, 1.7 m). Live check 22-Nov-2026: Demo Owner 1 / 2 in the header; owner names on cards, table and Clients filter; "—" for no owner; More sheet one divider; Arjun FinTech Proposal → Lead, logged by Demo Owner 1 |
| 2-f | ₹ values come only from `engagement_financials`, so roles without access see no value at all | 2.5 | ✓ 84ff9ca. Values read only from `engagement_financials` (`useEngagementValues`), only with values access; status views no longer asked for values (41 columns); `canSeeValues` mirrors `app.can_see_values()` (Owners always). typecheck OK; lint 0 errors (30 legacy warnings); unit 203 (14 files); db:test 420 PASS; Playwright 90 = 66 pass + 24 skipped, twice (2.4 m, 2.0 m); all 50 baselines byte-identical (SHA-256); build proof passed. Live check 22-Nov-2026 passed: Owner, cyan "—" for Arjun FinTech in table and dialog, dark and light; Consultant 2 same as Owner; Consultant 1 and Marketing: no Value or Contract Value column, no ₹ |
| 2-g | Minimum loading, empty and error states on Pipeline and Clients | 1 | ✓ 1d3bc22. Loading line (`role="status"`), error + Try again, "No open deals yet.", no-match messages with Clear search / Clear search and filters (`listState` + `LIST_MESSAGES`); client and lead dialogs are named modal dialogs (`useDialog`: panel focus, Esc, Tab stays inside, focus back); phone Clients table doesn't wrap (scrolls sideways); favicon `data:,`. typecheck OK; lint 0 errors (30 legacy warnings); unit 211 (15 files); format:check, check:colors, build pass; Playwright 101 = 77 pass + 24 skipped, twice (2.2 m, 2.2 m); 2 baselines replaced (`phone-clients` dark and light), 48 unchanged (SHA-256); db:test not run (no database change). Live check 23-Nov-2026 passed: Owner no-match message + clear on both screens; both dialogs Tab stays inside, Esc closes; Try again recovers after a blocked read; no favicon 404 in Console; phone 375 px Clients one line per cell, client dialog fine; dark and light. Took ≈ 4.5 h (planned 1 h) |
| 2-g2 | Dates as `dd-MMM-yyyy` (e.g. 28-Sep-2026) on Pipeline and Clients: shared `formatStandardDate` rewritten (no "Sept", leading zero, no time-zone shift); 12 baselines expected to change | 1.25 | |
| 2-h | Demo rehearsal per role, with screenshots | 1.5 | |
| | **Total** | **≈ 20.25 h** | |

### Time to the demo

| Item | Hours |
|---|---|
| Demo path: Phase 1 steps 1–14 + Phase 2 steps 2-a to 2-h, plus 2-a2 (2.75 h, added 11-Oct-2026) | **≈ 42 h** |
| Available, Mon 05-Oct to Fri 16-Oct: 10 weekdays × 4 focused hours | **≈ 40 h** |
| **Buffer on weekdays alone** | **none: about 2 h over** |

The weekend time (10–11 Oct, and 4 Oct if available) is the **real buffer**. That's tight: one bad day, or Docker trouble at step 4, uses it up.

**If the work falls behind, these move after the demo, in this order:**
1. Step 11 (CI database tests): the tests still run locally before every commit.
2. 2-g (loading/empty/error states): keep only a basic loading message.
3. 2-h shortened to one run-through.

Everything that proves the role rules (steps 8, 9, 13) stays before the demo.

## Done when (from PLAN.md)

- [ ] Each seeded role logs in and sees only what its role allows
- [ ] pgTAP proves: Marketing and a default Consultant can't read contract values, even through the API
- [ ] pgTAP proves the FR-9 edit rules for each role (added 03-Oct-2026)
- [ ] The renewal function returns the expected bucket for every dummy row (Test Notes sheet, reference date 29-Sep-2026)
- [ ] An Owner without MFA is asked to set it up before continuing
- [ ] An uninvited email can't sign up

## Open questions for Checkpoint A

- **Confirm the default renewal cycles** (added 03-Oct-2026):
  - all ISO: 12-month surveillance + 36-month recertification;
  - CMMI and CMMC: 36 months;
  - SOC 1, SOC 2 and VAPT: 12 months;
  - GDPR, DPDP, HIPAA and Other: no automatic cycle.

  These are in the `…_lookups` migration as defaults (PRD FR-4). An Owner can change them later; a change of default for everyone goes in a new migration.

## Choices (approved 03-Oct-2026)

1. **Supabase CLI:** a project dev dependency via Bun, exact version, with a `trustedDependencies` entry so Bun runs its install script. CI gets the same version from the lockfile. Chosen over a separate Windows install (Scoop), which would mean a second version to keep in step with CI.
2. **Local stack:** minimal services only, switched off in `config.toml` so the set is reviewed in git and CI uses the same one.
   - **Off:** Studio, analytics, Storage, Realtime (back on in Phase 2) and Edge Runtime (back on in Phase 3).
   - **On:** database, Auth, API gateway, REST API and the local test inbox.
   - **If slow:** cap WSL memory in `.wslconfig`, stop the stack when idle, and as a last resort run pgTAP in CI only.
3. **Contract value and payment status** go in a separate `engagement_financials` table with its own row rules:
   - Owners: always;
   - Consultants: only with `can_see_values`;
   - Marketing: never.

   Postgres column permissions can't give a per-person switch. This refines TECH-STACK.md §4 ("view without that column plus RLS").
4. **Seed** generated from the DUMMY file only, by `scripts/build-seed.ts`.
   - It refuses any other path, and any workbook without the "Test Notes (dummy data)" sheet.
   - Bad values (misspelt status, impossible date, "4.5 L") are seeded **empty and flagged**, never guessed.
   - The real Excel never enters the repo or any database; if it's ever on this machine before handover, it lives in `real-data/` (git-ignored, denied to Claude Code).
5. **Renewal function** takes the reference date as a parameter. Tests always pass 29-Sep-2026; only the app's `v_renewals` view uses today's date.
6. **Roles** live only in `profiles.role`, set by an Owner (or by the seed and invite step using server-only data), never from anything a user can edit about themselves. A newly invited user has no data access until an Owner assigns a role.
7. **MFA for Owners** is enforced in the database (Owner rules require `aal2`), not only on screen. It may follow the demo but **must be finished before any real data goes in**.

**Also decided 03-Oct-2026:**
- The demo runs on Freeda's laptop against the local stack (no hosted project, no link).
- Marketing "leads only" = the pipeline group (Lead, Proposal, On Hold) and the clients behind them.
- Test users have clearly fake names ("Demo Owner 1", "Demo Consultant 1", …) and `@example.com` emails.
- Docker Desktop 4.93.0 (WSL 2) is already installed; WSL caps itself at 4 GB (half of the laptop's 8 GB).
