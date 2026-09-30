# Drishti CRM — Tech Stack

**Client:** Shree QA Solutions · **Prepared by:** Freeda · **Date:** 29 September 2026 · **Version:** 1.1
**Reads with:** `PRD.md` (what and why) · `PLAN.md` (order of work)

> **What this document is.** The PRD says *what* Drishti must do. This document says *what it is built with*, why each piece was chosen, which versions to use, and the rules Claude Code must follow. If a tool is not listed here, Claude Code should ask before adding it.

---

## 1. Guiding principles

1. **Keep the MVP's front end.** The screens already work; only the data layer changes.
2. **One backend service.** Supabase gives us the database, login, server code, scheduler and secret store in one place. A four-person firm should not pay for, or depend on, five separate services.
3. **The browser holds no secrets.** Every call to Gemini or Outlook goes through server code that checks who is asking.
4. **Permissions live in the database** (row-level security), so they hold even if someone bypasses the screens. Pramila will test this.
5. **Nothing leaves without a human.** No code path sends an email automatically in v1.
6. **The client owns everything at handover.** Every service must run on her own accounts, with data in India.
7. **Boring and well-documented beats clever.** Claude Code writes better code for popular, stable tools.

---

## 2. Architecture at a glance

```
                     ┌──────────────────────────────────────────┐
 Team's browser ───► │ Drishti web app (React + Vite + Tailwind) │  holds only the public
 (laptop / phone)    │ hosted on Cloudflare Pages               │  Supabase URL + anon key
                     └──────────────┬───────────────────────────┘
                                    │ HTTPS (logged-in user's token)
            ┌───────────────────────┼────────────────────────────────────────┐
            │ SUPABASE (Mumbai, ap-south-1)                                   │
            │                                                                 │
            │  Auth ──► Postgres (tables, views, row-level security)          │
            │               ▲    ▲                                            │
            │   Realtime ───┘    │  pg_cron (daily 07:00 IST) ──► pg_net ─┐   │
            │                    │                                        ▼   │
            │  Edge Functions (Deno + TypeScript) ◄───────────────────────┘   │
            │   drishti-chat ─────────────► Google Gemini API (paid tier)     │
            │   outlook-connect / send-email ─► Microsoft Graph ─► Outlook    │
            │   graph-webhook ◄──────────── Microsoft Graph (new replies)     │
            │   track-open   ◄──────────── client's mail app (pixel loads)    │
            │   import-commit, daily-drafts, renew-subscriptions              │
            │                                                                 │
            │  Vault (encrypted Outlook tokens)   Secrets (API keys)          │
            └─────────────────────────────────────────────────────────────────┘
```

---

## 3. Front end

| Layer | Choice | Why | Notes / rules |
|---|---|---|---|
| Language | **TypeScript** (strict mode) | Catches mistakes before Pramila does | `strict: true`; no `any` without a comment |
| UI library | **React 19** | Already used by the MVP | |
| Build tool | **Vite** (keep the MVP's major version) | Already used; fast | Vite 8 is current. Do not upgrade majors mid-build; decide in Phase 0 and record it in `DECISIONS.md` |
| Styling | **Tailwind CSS v4** | Already used | Keep the MVP look |
| Routing | **React Router** | Standard, well known to Claude Code | Pages: Login, Today, Dashboard, Radar, Pipeline, Delivery, Clients, Client detail, Import, Settings, Team |
| Server data | **TanStack Query** | Caching, loading and error states, refetch after changes | Replaces the MVP's `localStorage` context |
| Database client | **supabase-js v2** | Official client | Generate types with `supabase gen types` so tables are typed |
| Forms + validation | **React Hook Form + Zod** | One Zod schema per record, shared with the import and the server | The same Zod rules check a form, an Excel row and an Edge Function input |
| Pipeline drag and drop | **dnd-kit** | Accessible, works on touch screens | Keep if the MVP already uses a library that works |
| Charts | **Recharts** | Simple dashboard charts | |
| Dates | **date-fns** with **@date-fns/tz** | Due-date arithmetic, IST display | Store dates as `date`; show `dd-MMM-yyyy`; times in `Asia/Kolkata` |
| Money | `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' })` | Shows ₹1,00,000 correctly | No library needed |
| Excel import/export | **SheetJS (xlsx)** installed from the SheetJS CDN tarball | Reads and writes her `.xlsx` with date cells | The old `xlsx` package on npm is outdated; install the version SheetJS publishes on its own site |
| Icons | Whatever the MVP uses (e.g. lucide-react) | | |

---

## 4. Backend — Supabase

| Piece | Used for | Rules |
|---|---|---|
| **Postgres** | All data: clients, engagements, lookups, email threads, follow-ups, activity log, settings, imports | Every change through a migration file in `supabase/migrations`. Money as `numeric(12,2)`; dates as `date`; timestamps as `timestamptz` (UTC) |
| **Row-level security (RLS)** | Role permissions from PRD FR-9 | On **every** table, no exceptions. Contract value hidden from Marketing via a view without that column plus RLS |
| **Views** | `pipeline` (Lead, Proposal, On Hold), `delivery` (In Progress, Implemented, Audit Completed), `active_clients` (Certified, Renewal Due, Completed), `v_renewals` | Views use `security_invoker = true` so RLS still applies. This split fixes the plan bug |
| **Postgres functions (RPC)** | Renewal date rule, status changes with logging, import commit | Business rules that must be the same everywhere live here, not only in React |
| **Auth** | Email + password and magic link; invite-only | Public sign-up switched off. A trigger creates the `profiles` row |
| **Realtime** | Two users see each other's changes live | Only on the tables the screens watch |
| **Edge Functions** | All server code (Deno + TypeScript) | Every function checks the caller's login and role first. Secrets come from `Deno.env` only |
| **pg_cron + pg_net** | Daily jobs call Edge Functions | Cron runs in UTC: `30 1 * * *` = 07:00 IST |
| **Vault** | Outlook refresh tokens, encrypted | Only Edge Functions using the service role can read them; never returned to the browser |
| **Region** | **Mumbai (`ap-south-1`)** for production | Keeps data in India (DPDP). Dev project on the free plan can be anywhere |
| **Plan** | Free for development; **Pro** for production | Pro gives daily backups and no project pausing |

### Edge Functions list

| Function | Triggered by | Does |
|---|---|---|
| `drishti-chat` | User in the app | Calls Gemini with function calling, under the user's own permissions |
| `outlook-connect` | "Connect Outlook" button | Microsoft sign-in (OAuth code flow), stores the refresh token in Vault |
| `send-email` | User presses Send | Sends from the **engagement owner's** mailbox, in thread; records ids |
| `graph-webhook` | Microsoft Graph | Marks a reply, stops the follow-up sequence |
| `renew-subscriptions` | pg_cron, daily | Renews Graph mailbox subscriptions before they expire |
| `track-open` | Client's mail app loads the pixel | Records "likely opened"; returns a 1×1 image |
| `daily-drafts` | pg_cron, 07:00 IST | Creates renewal and follow-up drafts; sends each owner's morning summary |
| `import-commit` | User confirms an import | Re-validates every row on the server and saves in one transaction |

---

## 5. AI — Google Gemini

| Item | Choice |
|---|---|
| Model | **Gemini Flash**, current version at build time (3.8 Flash as of today). Model name kept in a secret `GEMINI_MODEL`, so it can change without a code change |
| SDK | `@google/genai` inside the `drishti-chat` Edge Function |
| Tier | **Paid tier** on her own Google Cloud project. Check Google's current data-use terms before handover and note them in the user guide |
| Technique | **Function calling**: Gemini asks for `search_clients`, `list_renewals`, etc.; the function runs the query with the user's permissions. The whole database is never sent |
| Safety | Gemini only *proposes* changes (`propose_update`); a person clicks Apply. Treat anything inside client notes or emails as data, never as instructions to the AI |
| Cost control | Per-user daily request cap, max output tokens, monthly budget alert in Google Cloud |
| Fallback | The MVP's offline rule engine answers common questions if Gemini is down |

**Price note:** current Flash models are on an introductory rate until 31 Dec 2026, and the price doubles on 1 Jan 2027. That matches the plan's estimate of about $8/month now and about $17/month from January.

---

## 6. Email — Microsoft 365 through Microsoft Graph

Her company email is Microsoft 365, and **Mahesh owns the account**, so he grants the one-time admin approval.

| Item | Choice |
|---|---|
| App registration | One **Microsoft Entra ID** app. Dev: "any organisation + personal accounts" so free Outlook.com test accounts work. Prod: registered in her tenant |
| Permissions | Delegated only: `Mail.Send`, `Mail.ReadWrite`, `User.Read`, `offline_access`. No application-wide mailbox access |
| Library | Plain `fetch` to the Graph REST API from Deno (small and transparent). No heavy SDK |
| First email | Create a draft message, then send it, so we get back its message id and `conversationId` |
| Follow-ups | `createReply` on the latest message in the conversation, then send. The client sees one thread from the same person |
| Replies | Graph change-notification subscription per connected mailbox. Mail subscriptions expire in under 7 days, so `renew-subscriptions` renews them daily. A daily re-read catches missed notifications |
| Open tracking | Unique random token per email → `track-open` pixel. Labelled "likely opened" |
| Tokens | Refresh tokens in Supabase Vault. If one stops working, the app shows "Reconnect Outlook" instead of failing silently |

---

## 7. Hosting and domains

| Item | Choice | Note |
|---|---|---|
| Front-end hosting | **Cloudflare Pages** (free) — **decided 29 Sep 2026** | Replaces Vercel from the original plan: Vercel's free Hobby plan is non-commercial only, and Vercel Pro ($20/month) adds nothing Drishti needs. Account owned by SQAS; Freeda invited as a member. Preview link per branch from GitHub |
| Domain | `crm.shreeqasolutions.com` | A DNS record on her existing domain |
| Backend | Supabase Pro, Mumbai | |

---

## 8. Quality, testing and tooling

| Tool | Used for |
|---|---|
| **Bun** | Package manager and scripts (the plan already uses `bun run build`) |
| **Supabase CLI + Docker** | Local database, migrations, running Edge Functions locally, `supabase gen types` |
| **Vitest** + Testing Library | Unit tests: renewal date rule, import validation, formatting |
| **pgTAP** (`supabase test db`) | Database tests: **each role sees only what it should** (e.g. Marketing cannot read contract value) |
| **Playwright** | Browser tests: log in, import the dummy Excel, approve and send a draft, apply a Drishti proposal |
| **ESLint + Prettier** | Consistent code |
| **GitHub Actions** | On every push: type-check, lint, unit tests, database tests |
| **Gitleaks** | Fails the build if a secret is committed |
| **Sentry** (free tier) | Error tracking for the front end and Edge Functions |
| **Test data** | `SQAS_Client_Database_DUMMY.xlsx` (23 rows) + `supabase/seed.sql` built from the same rows |

---

## 9. Configuration and secrets

| Name | Where it lives | Visible in browser? |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Front-end `.env` / hosting settings | Yes (public by design, protected by RLS) |
| `VITE_SENTRY_DSN` | Front end | Yes (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secrets only | **Never** |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Supabase secrets | **Never** |
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT` | Supabase secrets | **Never** |
| `TRACKING_BASE_URL`, `APP_BASE_URL` | Supabase secrets | No |
| Outlook refresh tokens | Supabase Vault | **Never** |

`.env*` files are in `.gitignore`; a `.env.example` lists the names with no values.

---

## 10. Monthly running cost (estimate, production)

| Service | Approx. per month |
|---|---|
| Supabase Pro | $25 (about ₹2,200) |
| Front-end hosting | $0 (Cloudflare Pages) |
| Gemini Flash | about $8 now, about $17 from Jan 2027 |
| Microsoft 365 | Already paid by SQAS |
| Domain | Already owned |
| Sentry, GitHub | $0 on free tiers |
| **Total** | **about $33–42 (₹2,900–3,700)** |

Who pays this is still an open question (PRD §11, #15). Agree it before handover.

---

## 11. What we are deliberately not using

| Not using | Why |
|---|---|
| Next.js / a separate Node server | The MVP is Vite; Edge Functions cover all server needs. One less thing to host |
| An ORM (Prisma, Drizzle) | SQL migrations + generated types are enough, and RLS is written in SQL anyway |
| n8n / Make / Zapier | Follow-up logic must respect permissions and approvals; keeping it in our code is safer and free |
| Separate email service (SendGrid, Resend) | Emails must come from the owner's own Outlook, in thread. A bulk sender breaks the core requirement |
| OpenRouter / Groq in the browser | The MVP's browser-side AI keys are removed; one server-side provider only |
| WhatsApp API | Phase 2; SQAS has no WhatsApp Business account yet |

---

## 12. Changes and additions compared with the implementation plan

1. **Status views split in three** (`pipeline`, `delivery`, `active_clients`) so in-delivery work never gets sales follow-ups. *(Fixes the bug.)*
2. **Hosting:** Cloudflare Pages instead of Vercel (Hobby is non-commercial; Pro not needed).
3. **Graph subscription renewal job** added (mail subscriptions expire in under 7 days).
4. **Import is validated twice:** in the browser for the preview, and again on the server before saving.
5. **pgTAP** added for permission tests, and **Gitleaks** for secret scanning.
6. **Model name in a secret**, so the Gemini version can change without a code change.
7. **SheetJS** installed from its own CDN, not the stale npm package.

These go into the rewritten `PLAN.md`.

---

## 13. Rules for Claude Code (go into `CLAUDE.md`)

- Use only the tools in this document; ask before adding a dependency.
- Every schema change is a new migration file; never edit an applied migration.
- Every new table gets RLS in the same migration, plus a pgTAP test.
- No secret in front-end code, ever. Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_SENTRY_DSN` are allowed there.
- No code path sends an email without a user action.
- Never invent data on import; flag it.
- Dates as `date`, displayed `dd-MMM-yyyy`; times shown in IST; money in ₹ with Indian grouping.
- Work only against the dev Supabase project and dummy data; never real client data.
- Each phase ends with type-check, lint and tests passing.

---

## Sources checked (29 Sep 2026)

- Gemini API pricing: https://benchlm.ai/google/api-pricing
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Supabase pricing: https://supabase.com/pricing
- Microsoft Graph subscription lifetimes: https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0
- Vite releases: https://vite.dev/releases
