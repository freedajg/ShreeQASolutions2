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
- Commit subjects never include client names.

## Steps

**Demo:** ● = demo-critical · ○ = can wait until after the demo
**Hrs:** Freeda's hours, including reviews and screenshots
**Care:** ⚠ = one step at a time, explain plan first

| # | Commit | Demo | Hrs | Care | Done when | Done |
|---|---|---|---|---|---|---|
| 1 | **docs:** add this plan; DECISIONS lines for the approved choices | ● | 0.5 | | Freeda approves the plan | |
| 2 | **chore:** Supabase CLI as an exact-version dev dependency; `trustedDependencies` entry; scripts `db:start`, `db:stop`, `db:test`, `db:types`; permission rules updated for the new script names | ● | 1 | | The CLI runs (`bun x supabase --version`); `bun pm untrusted` shows nothing blocked; the lockfile is committed; the install script's download source and checksum check recorded in DECISIONS | |
| 3 | *(no commit)* Check `docker info` works. Docker Desktop 4.93.0 (WSL 2) is already installed, and WSL already caps itself at 4 GB. `.wslconfig` is changed only if it's slow later. | ● | 0.25 | | `docker info` reports a running engine | |
| 4 | **chore:** `supabase init`. `config.toml` with sign-up off, and Studio, analytics, Storage, Realtime and Edge Runtime off; first local start; RAM measured | ● | 1 | ⚠ | The local stack starts and stops cleanly; RAM use recorded in DECISIONS | |
| 5 | **feat(db):** migration `…_helpers_lookups`: role helper functions; lookup tables (16 certification types with default cycles, 10 statuses with their group, payment statuses, priorities, lead sources); RLS; pgTAP test helpers | ● | 2 | ⚠ | `bun run db:test` passes: every role can read lookups, only Owners can change them, `anon` gets nothing | |
| 6 | **feat(db):** migration `…_profiles`: `profiles` (name, role, booking link, mailbox connected, `can_see_values`, `theme_preference`, active), the auth trigger that creates it, and a guard so nobody but an Owner can change a role or `can_see_values` | ● | 2 | ⚠ | pgTAP: a user can edit their own name but not their own role; a new user gets no data access until an Owner sets their role | |
| 7 | **feat(db):** migration `…_clients_engagements`: `clients` and `engagements` (one client, many engagements) with every Excel column (PRD §6.2), plus last contacted, next follow-up, do-not-contact, date-is-estimated, created by, archived. Contract value and payment status go in a separate `engagement_financials` table (choice 3). | ● | 2 | ⚠ | Every one of the 30 Excel columns has exactly one home (checked against PRD §6.2) | |
| 8 | **feat(db):** RLS on `clients`, `engagements`, `engagement_financials` for each role, with pgTAP tests per role per table, for **reading and editing** (Owner, Consultant, Consultant with `can_see_values`, Marketing, `anon`) | ● | 3.5 | ⚠ | pgTAP proves the rules below | |
| 9 | **feat(db):** views `pipeline` (Lead, Proposal, On Hold), `delivery` (In Progress, Implemented, Audit Completed), `active_clients` (Certified, Renewal Due, Completed), all `security_invoker = true`, with pgTAP tests | ● | 1 | ⚠ | pgTAP: each view returns only its statuses and obeys RLS (Marketing gets `pipeline` rows only) | |
| 10 | **feat(db):** seed from the DUMMY file: `scripts/build-seed.ts` writes `supabase/seed.sql`; fake test users for each role; local reset and reseed | ● | 2.5 | ⚠ | 23 engagements and the right number of clients loaded; bad values left empty and flagged; the seed diff reviewed; the script refuses any file that isn't the DUMMY file | |
| 11 | **ci:** database-test job (start a minimal local stack on the runner, run `bun run db:test`) | ● | 1.5 | | Green in CI after a push (Freeda approves the push) | |
| 12 | **feat(auth):** `@supabase/supabase-js` (approval), login page (email + password), sign-out, "not signed in → login" gate; invite-only | ● | 3 | | Freeda logs in as each seeded user; a wrong password shows a plain message; signed-out users see only the login page | |
| 13 | **test:** per-role check: log in as each role; call the API directly with each role's session and show what comes back (screenshots + saved output) | ● | 1.5 | | Owner sees values; default Consultant doesn't; Marketing sees leads only, with no ₹ in any response | |
| 14 | **feat(db):** `activity_log` (insert-only), plus a `change_engagement_status()` function that logs every status change. Phase 2's Pipeline drag needs this. | ● | 1.5 | ⚠ | pgTAP: nobody can update or delete a log row; a status change writes exactly one log row with who, when, from and to, and obeys the step 8 edit rules | |
| | **↓ Phase 2 demo-critical steps go here (see below), then the can-wait steps** | | | | | |
| 15 | **feat(db):** renewal-date function `renewal_due(engagement, as_of date)` (PRD FR-4 rule: surveillance → next audit → valid to → estimate from completion date + default cycle), `v_renewals` view, buckets Overdue / 30 / 31–90 / Later | ○ | 3 | ⚠ | pgTAP calls it with **as_of = 29-Sep-2026** for every DUMMY row and matches the Test Notes sheet exactly | |
| 16 | **feat(db):** `email_threads`, `email_messages`, `follow_ups`, `app_settings` (intervals, reminder windows, retention), `import_batches`, all with RLS and pgTAP per role | ○ | 2.5 | ⚠ | pgTAP: each table refuses `anon`, Marketing sees none of them, Consultants only their own engagements' rows | |
| 17 | **feat(auth):** magic-link sign-in; the email arrives in the local test inbox (Mailpit) | ○ | 1 | | A magic link logs in a seeded user; an unknown email gets the same neutral message and no link | |
| 18 | **feat(auth):** MFA required for Owners: authenticator enrolment screen; Owner data rules require a second factor (Postgres `aal2`), with pgTAP. **Must be done before any real data goes in.** | ○ | 3 | ⚠ | An Owner without MFA is sent to set it up and can read no data until they do; pgTAP proves Owner access needs `aal2` | |
| 19 | **test:** an uninvited email can't sign up; a deactivated user can't log in and their history keeps their name | ○ | 0.5 | | Both shown with saved output | |
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

**Totals:**
- Phase 1 demo-critical (steps 1–14): **≈ 23.25 h**
- Phase 1 can-wait (steps 15–21): **≈ 12.5 h**
- Phase 1 in all: **≈ 35.75 h**

### Phase 2 demo-critical steps (summary; detailed plan comes after Phase 1)

| # | What | Hrs |
|---|---|---|
| 2-a | supabase-js data layer + TanStack Query (approval); generated database types | 1.5 |
| 2-b | Types become `Client` + `Engagement`; adapt Pipeline and Clients | 4 |
| 2-c | Pipeline board reads `pipeline`; drag calls `change_engagement_status()` | 2.5 |
| 2-d | Clients list reads `active_clients`; client detail with its engagements | 2.5 |
| 2-e | Hard-coded team replaced with `profiles` | 2 |
| 2-f | ₹ values come only from `engagement_financials`, so roles without access see no value at all | 1 |
| 2-g | Minimum loading, empty and error states on Pipeline and Clients | 1 |
| 2-h | Demo rehearsal per role, with screenshots | 1.5 |
| | **Total** | **≈ 16 h** |

### Time to the demo

| Item | Hours |
|---|---|
| Demo path: Phase 1 steps 1–14 + Phase 2 steps 2-a to 2-h | **≈ 39.25 h** |
| Available, Mon 05-Oct to Fri 16-Oct: 10 weekdays × 4 focused hours | **≈ 40 h** |
| **Buffer on weekdays alone** | **under 1 h** |

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
