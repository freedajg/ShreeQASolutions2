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
| 02-Oct-2026 | Theme choice saved in `localStorage` (`drishti-theme`); default Dark when nothing is saved; no-flash script inline in `index.html` | Phase 2 adds the profile copy. SECURITY.md plans no Content-Security-Policy; if one is added, it must allow this script by its hash |
| 02-Oct-2026 | No `color-scheme` set for dark mode | It turns the date field's calendar icon from black to light grey, a dark-mode pixel change outside the accepted list (PHASE-0-PART-2-PLAN.md A1–A3). Superseded by the next line |
| 02-Oct-2026 | `color-scheme: dark` / `light` set per theme; accepted dark-mode change **A4** | Freeda approved: the black calendar icon was nearly invisible on dark fields. Only the `desktop-add-client` baseline changed (22 px, inside the icon); dropdown arrows and scrollbars (custom-styled) are unchanged |

## Notes to check later

| Date | Note | Check in |
|---|---|---|
| 30-Sep-2026 | `setEmail` / `setPhone` (ClientsView, PipelineView) and `setSource` / `setStage` (PipelineView) are never called, so the edit forms may not be wired up | Phase 2 |
| 30-Sep-2026 | `formatINR` compact mode always shows 2 decimals (`₹4.50 L`, not `₹4.5 L`). The unit test documents the current behaviour | Confirm the preferred style with SQAS (DESIGN.md) |
| 30-Sep-2026 | `react-hooks/set-state-in-effect` warnings in CrmContext, DrishtiFace, EmailDraftModal: possible extra re-renders | CrmContext in Phase 2; the others when those screens are touched |
