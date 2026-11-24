# Drishti — deployment and go-live runbook (PLAN Phase 8)

Every step below is run by a person, on **SQAS's own accounts** (Freeda invited as a member; no passwords shared). Nothing in the repo deploys by itself.

## 1. Accounts (SQAS owns them)
- Supabase project, **Mumbai (ap-south-1)**. Plan: the client chose Free (DECISIONS 22-Nov-2026: no automatic backups, so the weekly Excel export is the backup).
- Cloudflare (Pages + DNS for `crm.shreeqasolutions.com`).
- Microsoft Entra (their Microsoft 365 tenant) — app registration below.
- Google Cloud (Gemini), with a monthly budget alert — **only after the client's written Yes to Q19** (AI processing outside India).
- GitHub organisation; the repo is transferred to it.

## 2. Database
```
bun x supabase login
bun x supabase link --project-ref <SQAS project ref>
bun x supabase db push          # applies supabase/migrations in order
```
Then, in the SQL editor (once per project):
```sql
-- the morning digest job calls this function URL with its own secret
update public.server_jobs
set url = 'https://<ref>.supabase.co/functions/v1/daily-digest'
where name = 'daily-digest';
```
Auth settings: sign-ups **off**; email provider on; MFA (TOTP) on; **Leaked password protection on**; Site URL = `https://crm.shreeqasolutions.com`; redirect URLs include it.

Do **not** load `supabase/seed.sql` or `supabase/seed-extras.sql` in production (dummy data).

## 3. Microsoft Entra app (Checkpoint B, with Mahesh)
1. Entra admin centre → App registrations → New: "Drishti", single tenant.
2. Redirect URI (Web): `https://<ref>.supabase.co/functions/v1/outlook-connect`.
3. API permissions (Delegated): `Mail.Send`, `Mail.ReadWrite`, `User.Read`, `offline_access`, `openid`, `email` → **Grant admin consent** (Mahesh). If the tenant is managed by GoDaddy and consent is blocked, see DECISIONS "Notes to check later" (03-Oct-2026).
4. Certificates & secrets → new client secret (note the expiry date; renew before it).

## 4. Edge Functions and secrets
```
bun x supabase secrets set MS_TENANT_ID=... MS_CLIENT_ID=... MS_CLIENT_SECRET=...
bun x supabase secrets set TOKEN_ENC_KEY=<32 random bytes, base64>   # e.g. openssl rand -base64 32
bun x supabase secrets set APP_ORIGIN=https://crm.shreeqasolutions.com
bun x supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash   # only after Q19
bun x supabase functions deploy send-email team-admin drishti-assistant
bun x supabase functions deploy outlook-connect graph-webhook track-open daily-digest --no-verify-jwt
```
`outlook-connect`, `graph-webhook`, `track-open` and `daily-digest` check their callers themselves (signed state, Graph clientState, random token, job secret), so they run without the gateway's JWT check.

Turn email live only after a test send: Settings → Outlook & M365 → **Turn off (go live)**.

## 5. Front end (Cloudflare Pages)
- Build command `bun run build`, output `dist`. `public/_redirects` sends every page address to the app.
- Environment variables (public values only): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Add the production host to `DEV_PROJECT_HOSTS`-style allow-list in `src/lib/supabase/config.ts` before building.
- Custom domain `crm.shreeqasolutions.com`; check `/health` shows all checks passing.

## 6. Go-live day
1. Invite the team (Settings → Team). Owners set up MFA at first sign-in; each owner connects Outlook.
2. Import the **real Excel in production only**; review the flag report with Pramila; fix what she can.
3. Send one real follow-up from an owner's mailbox; confirm it arrives in the same thread, shows "Likely opened", and a reply stops the sequence.
4. Freeze her Excel sheet (DECISIONS 22-Nov-2026).
5. Reduce Freeda's access to what the support agreement needs.

## 7. Weekly
- Clients → **Export to Excel**, store the file in SQAS's own storage (the backup on the Free plan).
- Once a quarter: restore test — import that export into a scratch project and compare counts.
