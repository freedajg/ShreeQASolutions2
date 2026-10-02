# Phase 0 part 2 — Design tokens and light/dark themes

**Branch:** `phase-0-part2` · **Plan agreed:** 01-Oct-2026
**Reads with:** `DESIGN.md` §2, §2a, §9 · `PLAN.md` Phase 0 · `DECISIONS.md`

## Goal

1. Design tokens for every colour, with a dark theme (today's look) and a new light theme.
2. Convert the 776 hardcoded hex classes, the 23 plain-string hex colours (all in `DrishtiFace.tsx`) and the 121 standard Tailwind colour classes (e.g. `text-emerald-400`) to tokens.
3. Turn on the `colors` CI job so `check:colors` must pass.
4. A check-only Prettier pre-commit hook.

**The app is dark-only today.** Dark mode must look exactly as it does now; light mode is the only new thing.

## How "dark mode is unchanged" is proven

- `tests/visual.spec.ts` (Playwright, already installed) screenshots all 7 tabs (Drishti, Dashboard, Renewal Radar, Pipeline, Clients, Import, Settings), the email draft dialog, the other dialogs, a few hover states (nav button, table row), and the main screens at 375px.
- For stable images it: fixes the clock to one date, starts from the same demo data, turns off animations, waits for fonts, and forces the dark theme (`colorScheme: 'dark'`), so the System default in step 12 can't flip the baselines to light.
- Baselines are taken in step 1, before any conversion, and committed. Every later commit re-runs the test; **the comparison is strict (no pixel tolerance)**.
- Differences are shown side by side with `bun x playwright show-report`.
- Screenshots are Windows-specific, so this test runs locally, not in CI.
- Hover and focus colours are only partly covered by screenshots. Every conversion uses one fixed mapping table (old value → token), so a value proven in a screenshot gets the same swap in its hover/focus form.

### Accepted (named) pixel changes in dark mode

No other difference is accepted. If one appears, the step stops and is fixed or brought to Freeda.

| # | Change | Step | Why |
|---|---|---|---|
| A1 | The one element using `#1e2a4a` becomes `#1e2947` (overlay token). The element is named in the commit message | the step that converts its file | Near-duplicate colour; invisible difference |
| A2 | New sun/moon theme button in the top bar (desktop and phone) | 13 | The theme toggle is a new feature (DESIGN.md §2a) |
| A3 | New "Theme" row (Light / Dark / System) in the user switcher dropdown and the phone menu, only in screenshots where they're open | 13 | Same as A2 |
| A4 | Date fields' calendar icon turns from black to light grey (`color-scheme: dark`). Only `desktop-add-client` changes: 22 px, all inside the icon | after 12 (added 02-Oct-2026) | The black icon was nearly invisible on the dark field. Dropdown arrows and scrollbars don't change |

After A2/A3, the baselines are updated once in step 13 and are strict again from then on. A4's one baseline was updated in its own commit.

## Steps

Each step is one small commit. Before each commit: `bun run typecheck`, `bun run lint`, `bun run test` and the screenshot test pass. Commit subjects never include client names.

| # | Commit | Done when |
|---|---|---|
| 1 | **test:** screenshot test + dark-mode baseline images | Passes twice in a row on unchanged code |
| 2 | **style:** colour tokens in `src/index.css` (`@theme`, dark values only), including the scrollbar colours; no component changes | Screenshots identical; `bun run build` passes |
| 3 | **style:** convert `App.tsx` + `Navbar.tsx` (59 hex classes) | `check:colors` shows 0 for these files; screenshots identical |
| 4 | **style:** convert `DashboardView.tsx` + `MetricInfoModal.tsx` (96) | Same |
| 5 | **style:** convert `RenewalRadarView.tsx` (69) | Same |
| 6 | **style:** convert `PipelineView.tsx` (148) | Same |
| 7 | **style:** convert `ClientsView.tsx` (148) | Same |
| 8 | **style:** convert `DrishtiView.tsx` (73) + `DrishtiFace.tsx` (23 plain strings) | Same; no plain-string hex left in `src/` |
| 9 | **style:** convert `EmailDraftModal.tsx` + `ProposalDiffModal.tsx` (79) | Same |
| 10 | **style:** convert `ImportView.tsx` + `SettingsView.tsx` (104) | Same; **`check:colors` passes for the whole app** |
| 11 | **ci:** turn on the `colors` job (delete `if: false`); extend `check-hex-colors.ts` to also catch standard Tailwind colour classes | Passes locally; green in CI after a push (Freeda approves the push) |
| 12 | **feat:** light-theme values (`[data-theme="light"]`), the `data-theme` switch, and the no-white-flash script in `index.html`. **Before starting:** check `docs/SECURITY.md` for a planned Content Security Policy and tell Freeda how the inline no-flash script fits it | Dark screenshots identical; forcing light shows the light theme |
| 13 | **feat:** theme toggle: sun/moon in the top bar; Light / Dark / System in the user switcher dropdown and phone menu; **default Dark**; saved in the browser | Toggle switches instantly; a first visit opens in Dark; choosing System follows the Windows setting; reload keeps the choice with no flash (each a Playwright test); only A2/A3 differ in dark screenshots |
| 14 | **fix:** light-mode review: contrast check (DESIGN.md §9 item 2), light screenshots of every screen shared with Freeda, fixes; then light baselines committed | Freeda approves the light screenshots; contrast meets WCAG AA |
| 15 | **chore:** check-only Prettier pre-commit hook | A badly formatted staged file blocks the commit |
| 16 | **docs:** DECISIONS.md lines (token mapping, extra tokens, screenshot approach, accepted changes, default theme Dark until the client approves light); tick PLAN.md Phase 0 boxes | Docs match what was built |

Steps 3–10 also convert the standard Tailwind colour classes in each file. Swaps are done with a throwaway script (kept outside the repo) that applies the fixed mapping table; each file's diff is checked before committing.

**Default theme is Dark** (changed from DESIGN.md §2a's System, 01-Oct-2026): nobody sees light mode unless they choose it. Light, Dark and System all stay in the menu. The default switches to System after the client approves the light theme.

## Choices (approved 01-Oct-2026)

1. **Where Light / Dark / System goes:** a "Theme" row at the bottom of the user switcher dropdown and in the phone menu. It's the closest thing to a user menu; Phase 2 can move it.
2. **Extra tokens:** about 8 beyond DESIGN.md (teal, text on bright buttons, hover white, two extra green and red shades, dialog backdrop, border base). Border strengths kept exact with the opacity suffix (`border-line/16`), so dark mode stays pixel-identical.
3. **Light-mode border colour:** a dark slate at the same strengths, close to DESIGN.md's `#E2E8F0`. Recorded in DECISIONS.md. This isn't an accepted pixel change: it only affects light mode, which has no baseline until step 14, when light screenshots are reviewed and become the light baseline.
4. **`#1e2a4a` → overlay token (`#1e2947`):** accepted pixel change A1.
5. **Robot face:** its own tokens, same values in both themes; changed only if it looks wrong in the step 14 light screenshots.
6. **Prettier on converted files:** run only on the files changed in that commit, inside that commit (line wrapping only). The first one is shown to Freeda before committing.
7. **Baseline screenshots are committed to git** (about 15 PNGs; `.gitattributes` already marks them binary).
8. **Prettier pre-commit hook:** yes, check-only (`prettier --check` on staged files), added to the existing `.githooks` script. No new package; it never rewrites files. If it blocks a commit, run `bun run format` and commit again.

## Ground rules for this phase

- One step at a time: after each step, show the "done when" result and wait for Freeda to say "next".
- Before committing any screenshots, confirm the demo data in them is entirely made up (no real client names, phone numbers or emails).

- No new packages, file deletions or pushes without asking. Never push to `main`.
- No `eslint --fix` or `prettier --write` over existing code beyond choice 6.
