# Decisions

One line per decision made during the build: date, decision, reason. Newest at the bottom.
Locked decisions from before the build are in `PLAN.md` §3.

| Date | Decision | Reason |
|---|---|---|
| 30-Sep-2026 | Keep **Vite 6** (6.4.3); don't upgrade to Vite 8 during the build | The MVP uses 6; a major upgrade mid-build adds risk for no user benefit (PLAN.md Phase 0) |
| 30-Sep-2026 | Removed `express`, `@types/express`, `dotenv`, `tsx`, `motion`, `autoprefixer` | Unused: none is imported in `src/`; there's no Node server or PostCSS config; Tailwind v4's Vite plugin handles prefixing |
| 30-Sep-2026 | Removed `@google/genai` from package.json | Gemini runs only in the `drishti-chat` Edge Function (Phase 4), imported there by Deno, never in the browser |
| 30-Sep-2026 | Kept the old `xlsx` npm package for now | Replaced with the official SheetJS build in Phase 3 (TECH-STACK.md §3) |
| 30-Sep-2026 | Added `@types/react` 19.2.18 and `@types/react-dom` 19.2.7 (exact) | Needed by TypeScript strict mode; `@types/react-dom` was missing, and `@types/react` was only present indirectly through `react-markdown` |
| 30-Sep-2026 | Added ESLint 10 tooling (exact): `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, `eslint-config-prettier` | TECH-STACK.md §8 (ESLint + Prettier). Hooks rules catch common React bugs; `eslint-config-prettier` stops the two tools conflicting |
| 30-Sep-2026 | Added `prettier` 3.9.9 (exact) | TECH-STACK.md §8 |
| 30-Sep-2026 | Added `vitest` 5.0.2 (exact); Testing Library and jsdom deferred until the first component test | TECH-STACK.md §8; supports our Vite 6.4 without a second Vite copy. No component tests yet, so no need for the extra packages |
| 30-Sep-2026 | Added `@playwright/test` 1.63.0 (exact), Chromium only; runs locally, not in CI yet | TECH-STACK.md §8. One browser keeps runs fast; CI browser tests come with real journeys (Phase 7) |
| 30-Sep-2026 | TypeScript `strict: true`, with an explicit `include` | TECH-STACK.md §3. `include` stops tsc from also checking the ignored `.kilo/` worktree (a full copy of the MVP) |
| 30-Sep-2026 | `@` alias now points at `src/` (tsconfig and Vite) | PLAN.md Phase 0; nothing imported `@/` yet, so no code changed |
| 30-Sep-2026 | Dev server listens on localhost only (dropped `--host=0.0.0.0`) | Don't expose the app with dummy data to the local network |
| 30-Sep-2026 | Pre-commit hook is a plain script in `.githooks/`, enabled by the `prepare` script (`core.hooksPath`); no husky/lefthook | Nothing extra to install or audit; runs on `bun install`. It blocks the commit if Gitleaks is missing (fails closed) |
| 30-Sep-2026 | CI installs a pinned Gitleaks 8.30.1 binary and checks a hardcoded SHA-256; not `gitleaks-action` | `gitleaks-action` needs a paid licence for organisation-owned repos, and this repo moves to SQAS's organisation at handover |
| 30-Sep-2026 | GitHub Actions pinned to commit SHAs, read-only token, no persisted credentials | Supply-chain safety (SECURITY.md §A1 "poisoned dependency", §B5) |
| 30-Sep-2026 | Added `PowerShell(...)` copies of every permission rule in `.claude/settings.json` | Claude Code's `Bash(...)` rules don't apply to the PowerShell tool, which is the main shell on Windows, so the push/force-push/`bun add` guards weren't active |
| 30-Sep-2026 | Deny any Claude shell command whose text mentions `.env` or `real-data` | `Read(...)` denies don't reliably cover shell commands, and native Windows has no sandbox. This is deliberately blunt: the user runs such commands with `!`. Still not covered: scripts that open env files without naming them, and recursive pipes. Mitigation: the dev env file holds dev keys only |
| 30-Sep-2026 | `.env.example` is edited by the user, not Claude | The `Read(./.env.*)` deny rule also blocks creating or editing that file, and it stays in place |
| 30-Sep-2026 | `.gitattributes`: all text is LF on every OS; binary types marked | Makes `prettier --check` agree between Windows and CI (the machine's global `core.autocrlf=true` was checking files out as CRLF) |
| 30-Sep-2026 | Whole codebase formatted with Prettier in one commit (`00e8b74`), listed in `.git-blame-ignore-revs` | Keeps later diffs (e.g. the colour-token conversion) clean; `git blame` skips it. The bundle diff showed only 3 JSX whitespace wraps that render the same |
| 30-Sep-2026 | ESLint: 55 existing MVP violations downgraded to `warn` only in 13 listed files, and only for the rules each one fails | No MVP code changes in Phase 0. All other files, including new code, keep these rules as errors. Remove a file from the list when its phase rewrites it |
| 30-Sep-2026 | Hex-colour check (`bun run check:colors`) built but disabled in CI (`if: false`) | It fails today: **776** hex classes (PLAN.md estimated ~490). Turn on in Phase 0 part 2 once tokens land. Another **23** hex colours are plain strings (style objects, SVG, charts): the check doesn't count them, but they need tokens too |
| 02-Oct-2026 | Email draft "Copy" button hover `#1e2a4a` now uses `overlay` (`#1e2947`) | Its only use in the app; the difference can't be seen, and a one-off token would need its own light value |
| 02-Oct-2026 | Hex-colour check turned on in CI (removed `if: false`) | All hex classes in `src/` are now design tokens (0 left). The 23 plain-string colours and all Tailwind built-in colours (`slate-950`, `emerald-400`…) were converted too, though the check doesn't count those |
| 02-Oct-2026 | `check:colors` also fails on standard Tailwind colour classes (`text-emerald-400`, `bg-white`) and colour functions in arbitrary values (`border-[rgba(…)]`) | PHASE-0-PART-2-PLAN.md step 11. On the pre-conversion code it finds 776 hex + 121 palette (the plan's counts) + 160 `rgba()` classes the hex-only version missed; 0 today |
| 02-Oct-2026 | Light `primary-soft` is `#7C3AED` (violet-600), not DESIGN.md's `#EEF2FF` | The MVP uses `primary-soft` as text and gradient ends (12 places), never as a background; indigo-50 would be invisible on white. DESIGN.md updated |
| 02-Oct-2026 | Light values for tokens DESIGN.md doesn't list: `line` slate-500 (≈ slate-200 at its usual 16–18%), `on-primary`/`on-success` white, `teal` teal-700, danger/success shades from Tailwind's red/emerald, `backdrop` slate-900; tints and the Drishti face keep their dark values | Each picked by how the MVP uses the token; all text colours reach WCAG AA on white. See the light block in `src/index.css` |
| 02-Oct-2026 | Theme choice saved in `localStorage` (`drishti-theme`). Default Dark until the client approves the light theme, then switch to System. No-flash script inline in `index.html` | Phase 2 adds the profile copy. SECURITY.md plans no Content-Security-Policy; if one is added, it must allow this script by its hash |
| 02-Oct-2026 | No `color-scheme` set for dark mode | It turns the date field's calendar icon from black to light grey, a dark-mode pixel change outside the accepted list (PHASE-0-PART-2-PLAN.md A1–A3). Superseded by the next line |
| 02-Oct-2026 | `color-scheme: dark` / `light` set per theme; accepted dark-mode change **A4** | Freeda approved: the black calendar icon was nearly invisible on dark fields. Only the `desktop-add-client` baseline changed (22 px, inside the icon); dropdown arrows and scrollbars (custom-styled) are unchanged |
| 02-Oct-2026 | Accepted dark-mode change **A2**: the sun/moon theme button in the top bar (desktop and phone). On desktop the nav tabs move 22 px left as one block, because the header spaces its three groups apart and the right group is now 44 px wider | Freeda approved: the toggle is a new feature (DESIGN.md §2a). Every dark screenshot changed only by the button and the 22 px move (checked pixel by pixel); baselines updated once in step 13 |
| 02-Oct-2026 | Accepted dark-mode change **A3**: a "Theme" row (Light / Dark / System) at the bottom of the user switcher dropdown and in the phone menu. The phone menu sheet is anchored to the bottom, so it grows upward and its content starts 109 px higher | Freeda approved: same feature as A2. Only the two screenshots with those menus open changed beyond A2 |
| 02-Oct-2026 | Colour-token mapping recorded below (**Colour token mapping**): every old colour or Tailwind colour class → its token, with dark and light values | DESIGN.md §9 item 3. Built from `src/index.css` and the step 3–10 commit diffs (checked line by line); each dark value equals the old colour, so dark mode didn't change |
| 02-Oct-2026 | Extra tokens beyond DESIGN.md §2: `text-strong`, `on-primary`, `line`, `primary-tint`, `violet`, `teal`, `danger-light`, `danger-medium`, `danger-strong`, `info-tint`, `success-lighter`, `success-light`, `success-strong`, `on-success`, `backdrop`, `avatar`, `subtle`, `subtle-border`; the Drishti face's 15 `face-*` tokens; and the light-only `control-border` | The MVP used more shades than DESIGN.md lists; each got its own token so dark stays pixel-identical. Values in the mapping table below |
| 02-Oct-2026 | Screenshot approach: `tests/visual.spec.ts` compares every screen, dialog and menu with no pixel tolerance, using a fixed clock and fake demo data; it runs locally only (Windows baselines). Details in PHASE-0-PART-2-PLAN.md, "How 'dark mode is unchanged' is proven". Step 14 added 23 light baselines (`light-desktop-*`, `light-phone-*`) for the same screens | Proves each change keeps dark mode identical apart from the named changes A1–A4, and now guards light mode the same way |
| 02-Oct-2026 | Step 14, light-mode contrast (WCAG AA): light-only token values in `src/index.css`, so every light text, badge and button pair is at least 4.6:1. `muted`/`neutral` `#64748B` → `#607087`, `danger` `#DC2626` → `#BA0412`, `danger-medium` `#DC2626` → `#D51B1F`, `warning` `#B45309` → `#9E4703`, `info` `#0E7490` → `#036984`, `teal` `#0F766E` → `#08736B`, `success` `#047857` → `#067253`. New light-only token `--color-control-border` `#7C8AA0` (3.19–3.50:1) on inputs, selects, textareas, search boxes and the Drishti Ask bar form | Same hues, darkened only as far as needed (the light contrast check failed on badges, text on `raised` and input borders). Card borders left unchanged: they are decorative and cards have shadows. 23 light screenshot baselines added; the 23 dark baselines proven unchanged by SHA-256 |
| 02-Oct-2026 | Step 15: check-only Prettier pre-commit hook (`.githooks/pre-commit`). It checks the staged version of each file and never rewrites; Gitleaks runs first; if `bun` is missing the hook blocks with a message. Emergency skip for Prettier only: `SKIP_PRETTIER=1` (PowerShell: `$env:SKIP_PRETTIER=1`, then `Remove-Item Env:SKIP_PRETTIER`). CI now runs `bun run format:check` in the `checks` job | Catches unformatted files before they reach a commit, without rewriting anyone's work. Never use `--no-verify`: it also skips Gitleaks. CI was not checking formatting at all before this |
| 03-Oct-2026 | Phase 0 leftover checks (PLAN.md boxes 6, 7, 9). **6:** Claude Code's attempt to read `.env` was refused by the permission settings before the file was opened (whether the file exists wasn't checked: shell commands naming `.env` are denied by design). **7:** a commit of a file holding a fake GitHub-token-shaped key, on a throwaway branch, was blocked by the pre-commit hook (Gitleaks `github-pat`, exit 1, no commit created); file and branch removed. **9:** the first Memory Palace memory ("decision: Drishti uses three status views; delivery never gets sales follow-ups") saved locally (no cloud backend set), and `recall "which statuses get sales follow-ups"` returned it first | Proves the three safety and memory controls work. Box 8 (branch protection on `main`) stays open: not possible on GitHub Free |
| 03-Oct-2026 | Phase 1 plan approved (`docs/PHASE-1-PLAN.md`): steps ordered demo-critical first for the ~17-Oct demo, which needs Phase 1 and Phase 2. Migrations written fresh: the "tested schema files" named in PLAN.md don't exist | Demo needs login, per-role visibility, and Pipeline and Clients on real saved data |
| 03-Oct-2026 | Supabase CLI as an exact-version project dev dependency via Bun, with `"trustedDependencies": ["supabase"]` so its install script runs; not a separate Windows (Scoop) install | One pinned version for this laptop, CI (`bun install --frozen-lockfile`) and handover, visible in the lockfile. Install-script details recorded when installed (step 2) |
| 03-Oct-2026 | Local Supabase stack runs minimal services. **Off** in `config.toml`: Studio, analytics, Storage, Realtime (back in Phase 2), Edge Runtime (back in Phase 3). **On:** database, Auth, API gateway, REST API, local test inbox | Laptop has 8 GB; WSL caps itself at 4 GB. Config in git keeps CI on the same set. If still slow: `.wslconfig`, stop when idle, pgTAP in CI only as a last resort |
| 03-Oct-2026 | Contract value and payment status in a separate `engagement_financials` table with its own RLS (Owners always; Consultants only with `can_see_values`; Marketing never) | PRD FR-9 needs a per-person switch, which Postgres column permissions can't give. Refines TECH-STACK.md §4 ("view without that column plus RLS") |
| 03-Oct-2026 | Seed built only from `test-data/SQAS_Client_Database_DUMMY.xlsx` by `scripts/build-seed.ts`, which refuses any other path or a workbook without the "Test Notes (dummy data)" sheet. Bad values are seeded empty and flagged, never guessed. Test users have clearly fake names ("Demo Owner 1", …) and `@example.com` emails | Real client data never enters the repo or any database (CLAUDE.md rules 7 and 9) |
| 03-Oct-2026 | Renewal function takes the reference date as a parameter; tests always use 29-Sep-2026 (the Test Notes sheet's date). Only the app's `v_renewals` view uses today's date | Tests must give the same answer on any day |
| 03-Oct-2026 | Roles live only in `profiles.role`, set by an Owner (or by seed and invite using server-only data), never from user-editable metadata. A newly invited user has no data access until an Owner assigns a role | Users can edit their own user metadata through the login API, so a role kept there could be self-promoted |
| 03-Oct-2026 | MFA for Owners enforced in the database (Owner rules require `aal2`). It may come after the demo but **must be finished before any real data goes in** | Owners can see everything and send email as themselves (SECURITY.md A2) |
| 03-Oct-2026 | Demo runs on Freeda's laptop against the local stack (no hosted project, no link). Marketing "leads only" = the pipeline group (Lead, Proposal, On Hold) and the clients behind them; Marketing edits only leads it created | Keeps dummy data off the internet; settles PRD FR-9's "Leads only" |

## Colour token mapping

Phase 0 part 2, steps 3–10. Each old colour became the token on its row everywhere it was used, with any opacity kept (`bg-[#fb7185]/10` → `bg-danger/10`). The dark value is always the old colour itself. For old Tailwind classes, that is Tailwind's own oklch value. Values live in `src/index.css`: `@theme` (dark) and `:root[data-theme='light']` (light). "Same" = the light theme keeps the dark value.

| Old colour or class | Token | Dark value | Light value |
|---|---|---|---|
| `#080c16` | `bg` | `#080c16` | `#f8fafc` |
| `#111828` | `surface` | `#111828` | `#fff` |
| `#18213a` | `raised` | `#18213a` | `#f1f5f9` |
| `#1e2a4a` (A1, one hover) | `overlay` | `#1e2947` | `#fff` |
| `#e9eefb` | `text` | `#e9eefb` | `#0f172a` |
| `white` (hover / emphasis text) | `text-strong` | `#fff` | `#020617` |
| `#9aabcc` | `text-secondary` | `#9aabcc` | `#334155` |
| `#6d7c9c` | `muted` (`neutral` has the same values) | `#6d7c9c` | `#607087` |
| `slate-950` (text on bright fills) | `on-primary` | `oklch(12.9% 0.042 264.695)` | `#fff` |
| `rgba(148,175,235,0.NN)` | `line/NN` (strengths 6–35 kept exactly) | `rgb(148 175 235)` | `#64748b` |
| (new code only) | `border` (= `line` at 18%) | `rgb(148 175 235 / 0.18)` | `#e2e8f0` |
| (none: light only) | `control-border` (form controls) | — (dark keeps `line/*`) | `#7c8aa0` |
| `#818cf8` | `primary` | `#818cf8` | `#4f46e5` |
| `#6366f1` | `primary-strong` | `#6366f1` | `#4338ca` |
| `#a78bfa` | `primary-soft` | `#a78bfa` | `#7c3aed` |
| `indigo-500` | `primary-tint` | `oklch(58.5% 0.233 277.117)` | Same |
| `violet-500` | `violet` | `oklch(60.6% 0.25 292.717)` | Same |
| `#2dd4bf` | `teal` | `#2dd4bf` | `#08736b` |
| `#fb7185` | `danger` | `#fb7185` | `#ba0412` |
| `rose-300` | `danger-light` | `oklch(81% 0.117 11.638)` | `#b91c1c` |
| `rose-400` | `danger-medium` | `oklch(71.2% 0.194 13.428)` | `#d51b1f` |
| `rose-500` | `danger-strong` | `oklch(64.5% 0.246 16.439)` | `#ef4444` |
| `#fbbf24` | `warning` | `#fbbf24` | `#9e4703` |
| `#22d3ee` | `info` | `#22d3ee` | `#036984` |
| `cyan-400` | `info-tint` | `oklch(78.9% 0.154 211.53)` | Same |
| `emerald-400` | `success` | `oklch(76.5% 0.177 163.223)` | `#067253` |
| `emerald-200` | `success-lighter` | `oklch(90.5% 0.093 164.15)` | `#064e3b` |
| `emerald-300` | `success-light` | `oklch(84.5% 0.143 164.978)` | `#065f46` |
| `emerald-500` | `success-strong` | `oklch(69.6% 0.17 162.48)` | `#059669` |
| `emerald-950` | `on-success` | `oklch(26.2% 0.051 172.552)` | `#fff` |
| `black` | `backdrop` | `#000` | `#0f172a` |
| `slate-900` | `avatar` | `oklch(20.8% 0.042 265.755)` | `#e2e8f0` |
| `slate-800` | `subtle` | `oklch(27.9% 0.041 260.031)` | `#f1f5f9` |
| `slate-700` | `subtle-border` | `oklch(37.2% 0.044 257.287)` | `#cbd5e1` |

**Drishti face** (plain strings in `DrishtiFace.tsx`, step 8; same values in both themes): `#6366f1` → `face-indigo`, `#8b5cf6` → `face-violet`, `#06b6d4` → `face-cyan`, `#fb7185` → `face-cheek`, `#38bdf8` → `face-bulb-glow`, `#e0f2fe` → `face-bulb-core`, `#a78bfa` → `face-stem`, `#ffffff` → `face-highlight`, `rgba(255,255,255,0.08)` → `face-glass`, `rgba(255,255,255,0.25)` → `face-rim`, `#0f172a` → `face-ink`, `#1e293b` → `face-mouth`, `#64748b` → `face-offline-stem`, `#94a3b8` → `face-offline-bulb`, `#cbd5e1` → `face-offline-bulb-core`.

## Notes to check later

| Date | Note | Check in |
|---|---|---|
| 30-Sep-2026 | `setEmail` / `setPhone` (ClientsView, PipelineView) and `setSource` / `setStage` (PipelineView) are never called, so the edit forms may not be wired up | Phase 2 |
| 30-Sep-2026 | `formatINR` compact mode always shows 2 decimals (`₹4.50 L`, not `₹4.5 L`). The unit test documents the current behaviour | Confirm the preferred style with SQAS (DESIGN.md) |
| 30-Sep-2026 | `react-hooks/set-state-in-effect` warnings in CrmContext, DrishtiFace, EmailDraftModal: possible extra re-renders | CrmContext in Phase 2; the others when those screens are touched |
| 02-Oct-2026 | Dark-mode contrast failures found but not fixed, because dark is frozen: `muted` on `surface`/`raised` (4.23 and 3.81:1), the `primary/20` badge (4.35:1), and faint borders. Fixing them would change dark pixels | Open question for the client |
| 02-Oct-2026 | Proposal cards show "stage: → Won" with no old value. `ToolProposal` (`src/types.ts:52-60`) stores only new values and `ProposalDiffModal.tsx:29-38` renders only the new value. DESIGN.md §3 wants before → after, so store the current value when the proposal is made | Phase 4 |
| 02-Oct-2026 | Phone layout (same in both themes): the Renewal Radar count pill wraps to two lines next to a wrapped title | Phase 2 |
| 02-Oct-2026 | Phone layout (same in both themes): Settings, "OpenRouter" runs into "Multi-model gateway" and the "PRIMARY TIER 1" badge wraps | Phase 2 |
| 02-Oct-2026 | Phone layout (same in both themes): Settings, the Test Key buttons stick out past the card edge | Phase 2 |
| 02-Oct-2026 | Phone layout (same in both themes): Drishti, the date wraps under the greeting, so its "·" starts the line | Phase 2 |
| 03-Oct-2026 | Client's Microsoft 365 was bought through GoDaddy (confirmed 3 Oct 2026). Phase 5 admin consent may be blocked. Options: per-user consent if allowed; the hidden onmicrosoft.com admin account; or defederation by the client's IT. Ask the client early: does admin.microsoft.com redirect to GoDaddy, do they have the onmicrosoft.com admin login, and are they open to moving the subscription to Microsoft directly if needed | Ask the client early; needed before Phase 5 (Checkpoint B) |
