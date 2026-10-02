# Drishti CRM — Design Guide (Tier 1)

**Client:** Shree QA Solutions · **Prepared by:** Freeda · **Date:** 29 September 2026 · **Version:** 1.2
**Reads with:** `PRD.md` (what) · `TECH-STACK.md` (built with) · `PLAN.md` (order)

> **Purpose.** Keep every screen consistent with the MVP as Claude Code adds new ones. This is a Tier 1 guide ("MVP quality"): enough rules to stay consistent, not a full design system. **Do not redesign the MVP.** Extend it.

---

## 1. The five design decisions

| Question | Answer | What it means for the UI |
|---|---|---|
| **Vibe** | Professional, calm, trustworthy | Dark neutral surfaces, the indigo brand colour used sparingly, no playful animation, no new gradients. Colour is reserved for meaning (overdue, due soon, replied). |
| **Brand colour** | Keep the MVP's colours | Indigo `#818CF8` on a dark theme (from `src/index.css`); see §2. |
| **Content** | Data-heavy | Tables, pipeline board, dashboard numbers. Typography and alignment matter more than decoration. |
| **Device** | Desktop-first, phone-friendly | Sidebar on desktop. Today, Radar, client lookup and draft review must work well at 375px. |
| **Users** | Tech-savvy | Compact density, more information visible per screen, filters always visible, keyboard shortcuts. Labels stay plain (Mahesh and the consultants use it too). |

---

## 2. Design tokens

Tailwind v4: define tokens with `@theme` in `src/index.css`, then use them as utility classes (`bg-primary`, `text-muted`). **Never hardcode a hex value in a component.**

### Colour — taken from the MVP (`src/index.css`)

The MVP is a **dark theme** with an indigo brand. We keep it exactly; the tokens below are the MVP's own variables, now exposed through `@theme`.

| Token | MVP value | Use |
|---|---|---|
| `--color-primary` | `#818CF8` (`--brand`) | Links, active nav, focus ring, highlights |
| `--color-primary-strong` | `#6366F1` (`--brand-strong`) | Primary buttons, hover |
| `--color-primary-soft` | `#A78BFA` (`--brand-soft`), or primary at low opacity | Selected row, active filter chip |
| `--color-bg` | `#080C16` (`--canvas`) | App background |
| `--color-surface` | `#111828` (`--surface`) | Cards, tables, panels |
| `--color-raised` | `#18213A` (`--raised`) | Hovered rows, inputs |
| `--color-overlay` | `#1E2947` (`--overlay`) | Dropdowns, dialogs, drawers |
| `--color-border` | `rgba(148,175,235,0.18)` (`--line-default`) | Dividers, table lines, inputs (subtle `0.12`, strong `0.32`) |
| `--color-text` | `#E9EEFB` (`--ink`) | Main text |
| `--color-text-secondary` | `#9AABCC` (`--ink-secondary`) | Secondary text |
| `--color-muted` | `#6D7C9C` (`--ink-muted`) | Labels, timestamps (large or bold text only; check contrast) |

**Meaning colours** (the only other colours allowed), mapped to the MVP's accents:

| Token | Value | Meaning in Drishti |
|---|---|---|
| `--color-danger` | `#FB7185` (`--accent-rose`) | **Overdue** renewal, send failed, import rejected |
| `--color-warning` | `#FBBF24` (`--accent-amber`) | **Due in 30 days**, gone quiet, import flagged, estimated date |
| `--color-info` | `#22D3EE` (`--accent-cyan`) | **31–90 days**, "likely opened" |
| `--color-success` | `#34D399` (emerald-400, already used in the MVP) | Replied, sent, certified, paid |
| `--color-neutral` | `#6D7C9C` (`--ink-muted`) | Later, on hold, closed, archived |

Rules:
- Meaning is **never shown by colour alone**; always pair it with a word or icon ("Overdue", "Estimated").
- Badges use the colour at ~12–15% opacity as background with the full colour as text.
- The MVP has ~490 hardcoded hex classes (e.g. `text-[#e9eefb]`). **All of them must become tokens in Phase 0**, otherwise the light theme can't work. Dark mode must look exactly as it does today after the conversion.
- The MVP's gradients (indigo → violet/cyan) stay where they already are (e.g. the Drishti face); no new gradients.

### Typography

- Font: **Inter** (the MVP's font), falling back to the system font.
- Numbers in tables and on the dashboard use `tabular-nums`, so columns line up.

| Role | Size | Weight |
|---|---|---|
| Page title | 20px (`text-xl`) | 600 |
| Section / card title | 16px (`text-base`) | 600 |
| Body, table cells | 14px (`text-sm`) | 400 |
| Labels, badges, timestamps | 12px (`text-xs`) | 500 |
| Dashboard big numbers | 28px (`text-3xl`) | 600 |

### Spacing, shape, depth

- **8px rhythm:** use Tailwind steps 1, 2, 3, 4, 6, 8 (4–32px). No odd one-off values.
- **Compact density:** table rows 40px, inputs and buttons 36px (44px tap targets on phone).
- **Corners:** subtle, `rounded-md` (6px) for inputs, buttons and cards; `rounded-full` only for badges and avatars.
- **Depth:** flat. Borders separate things; `shadow-sm` only on dropdowns, dialogs and the dragged pipeline card.
- **Motion:** subtle only. 150–200ms colour and opacity transitions. No bouncing, no page transitions. Respect `prefers-reduced-motion`.
- **Theme:** dark (the MVP) **and** light, switchable by the user — see §2a.

---

## 2a. Light and dark themes

Users choose **Light**, **Dark** or **System** (follows the device setting). **Default: Dark for now; it switches to System after the client approves the light theme** (see `DECISIONS.md`, 02-Oct-2026).

**Where the switch lives:** a sun/moon icon in the top bar (one click toggles Light ↔ Dark), and a three-way choice (Light / Dark / System) in the user menu → Preferences.

**How it works:**
- One set of token *names*; two sets of *values*. Dark values are the MVP's (§2). Light values are below.
- The theme is set with `data-theme="light"` or `data-theme="dark"` on `<html>`. Tailwind v4 dark variant: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));`
- The choice is saved to the user's profile (so it follows them to another device) and cached in the browser, so the page loads in the right theme with **no white flash** (a tiny script in `index.html` sets `data-theme` before React starts).
- Components never mention a theme; they only use tokens. If something needs `dark:` in a component, the token is missing — add it instead.

**Light theme values**

| Token | Light value |
|---|---|
| `--color-primary` | `#4F46E5` (indigo-600 — darker than dark mode's, for contrast on white) |
| `--color-primary-strong` | `#4338CA` (indigo-700) |
| `--color-primary-soft` | `#7C3AED` (violet-600). The MVP uses it as text and gradient ends, so indigo-50 would be invisible (DECISIONS.md, 02-Oct-2026) |
| `--color-bg` | `#F8FAFC` (slate-50) |
| `--color-surface` | `#FFFFFF` |
| `--color-raised` | `#F1F5F9` (slate-100) |
| `--color-overlay` | `#FFFFFF` + `shadow-lg` |
| `--color-border` | `#E2E8F0` (slate-200) |
| `--color-text` | `#0F172A` (slate-900) |
| `--color-text-secondary` | `#334155` (slate-700) |
| `--color-muted` | `#64748B` (slate-500) |
| `--color-danger` | `#DC2626` (red-600) |
| `--color-warning` | `#B45309` (amber-700 — amber-500 is unreadable on white) |
| `--color-info` | `#0E7490` (cyan-700) |
| `--color-success` | `#047857` (emerald-700) |
| `--color-neutral` | `#64748B` (slate-500) |

**Theme rules:**
- Every screen is checked in **both** themes (contrast, badges, charts, focus rings).
- Charts take their colours from tokens, so they switch with the theme.
- Gradients (e.g. the Drishti face) get a light variant or a solid fallback.
- Emails Drishti sends are **not** themed; they follow the recipient's mail app.

## 3. Core components (all states required)

Every interactive component has **default, hover, focus-visible, active, disabled, loading** states. Focus is always visible (a 2px ring in the primary colour).

| Component | Notes |
|---|---|
| **Button** | Primary (one per view), Secondary (outlined), Ghost, Danger. Sizes sm/md. The loading state shows a spinner and keeps its width. |
| **Input, Select, Date picker, Textarea** | Label above, help text below, error text in danger colour. Dates entered and shown as `dd-MMM-yyyy`. |
| **Badge** | Status (her 10 statuses, grouped colours), renewal bucket, email state (Draft / Sent / Likely opened / Replied / Failed). |
| **Table** | Sticky header, sortable columns, row hover, right-aligned numbers, empty state. On phone it becomes a stacked card list. |
| **Card** | Surface + border + padding 16px. Used on the dashboard, the pipeline board and the Today view. |
| **Pipeline card** | Client · certification · owner avatar · ₹ value (hidden for Marketing) · "12 days since contact" · next follow-up date. Draggable, with a keyboard alternative ("Move to…" menu). |
| **Filter bar** | Always visible above lists: owner, certification, status/bucket, search. Active filters show as removable chips. |
| **Drawer / side panel** | Client quick view and draft editing, without leaving the list. |
| **Dialog** | Only for confirmations (send, archive, apply a Drishti proposal). The action is named in the button ("Send from Mahesh's mailbox"), not "OK". |
| **Toast** | Success/failure after an action, with Undo where possible. |
| **Proposal card (Drishti)** | Shows the change as before → after, plus Apply and Dismiss buttons. Never applied without a click. |
| **Empty, loading, error states** | Every list and panel has all three. Loading = skeleton rows, not spinners over blank pages. |

---

## 4. Layout and screens

**Desktop:** a left sidebar (Today, Dashboard, Renewal Radar, Pipeline, Delivery, Clients, Import, Settings) and a top bar (global search, Drishti chat button, user menu). Content max-width 1440px.

**Phone (below 768px):** the sidebar becomes a menu drawer, with a bottom bar for the 4 daily screens (Today, Radar, Pipeline, Search). Tables become cards. The pipeline shows one status column at a time, switched with tabs.

| Screen | Layout priority |
|---|---|
| **Today** | Drafts waiting, grouped by owner; each shows the recipient, why it was drafted, and Edit / Send / Skip |
| **Renewal Radar** | Overdue section pinned at the top in danger colour; then 30 days, 31–90, Later. "Estimated" badge on guessed dates |
| **Pipeline** | Columns: Lead, Proposal, On Hold. The "gone quiet" and "no owner" markers are visible on the card |
| **Delivery** | Simple table: client, certification, stage, owner, next audit/review date |
| **Client detail** | Header (company, contact, owner) → engagements list → timeline (notes, emails with opened/replied, changes) |
| **Import** | Stepper: Upload → Map columns → Preview (accepted / flagged / rejected tabs with reasons) → Confirm |
| **Dashboard** | 4 big numbers on top (overdue renewals, due in 30 days, pipeline value, quiet leads), then charts. Every number is clickable |

---

## 5. Formats and wording

- **Dates:** `12-Mar-2026`. **Times:** `10:30 AM IST`. Relative time where helpful ("3 days ago"), with the exact date on hover.
- **Money:** `₹1,00,000` (Indian grouping). Hidden entirely, not blurred, for roles without access.
- **Email tracking wording:** "Likely opened" (never just "Read"), with a small info icon that explains why it's approximate.
- **Voice:** short, plain and specific. "Send from Mahesh's mailbox", not "Submit". "3 rows need an email address", not "Validation errors occurred".
- **Never** show technical errors to users. Show what happened and what to do next; the details go to error tracking.

---

## 6. Keyboard shortcuts (tech-savvy users)

| Key | Action |
|---|---|
| `/` | Focus search |
| `g` then `t` / `r` / `p` / `c` | Go to Today / Radar / Pipeline / Clients |
| `n` | New lead |
| `j` / `k` | Next / previous row in a list |
| `e` | Edit the selected draft |
| `?` | Show all shortcuts |

Shortcuts never send an email by themselves; Send always needs a click or an explicit confirm.

---

## 7. Accessibility (target: WCAG 2.2 AA)

- Text contrast at least 4.5:1 (3:1 for large text and UI outlines). Check meaning colours on their soft backgrounds.
- Full keyboard use, including the pipeline (with the "Move to…" menu) and dialogs (focus trapped, Esc closes).
- Real `<button>`, `<label>`, `<table>` elements; icons have accessible names.
- Colour is never the only signal.

---

## 8. Checklist before any screen is "done"

- [ ] Uses only tokens; no hardcoded colours or odd spacing
- [ ] Hover, focus, disabled, loading, empty and error states all exist
- [ ] Works at 1440px, 1024px and **375px**
- [ ] Dates, ₹ and IST formats are correct
- [ ] Role-hidden data (contract value) is not rendered at all for Marketing
- [ ] Keyboard-only walkthrough works
- [ ] Looks like the rest of the MVP
- [ ] Checked in **both** Light and Dark themes

---

## 9. Phase 0 tasks for this guide

1. Expose the MVP's existing CSS variables through Tailwind `@theme` with the token names above (no visual change).
2. Check text contrast of `--ink-muted` and the meaning colours on the dark surfaces; adjust only if below WCAG AA.
3. Record the token mapping in `docs/DECISIONS.md`.
