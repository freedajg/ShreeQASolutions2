# Drishti CRM — Product Requirements Document (PRD)

**Client:** Shree QA Solutions (SQAS) — CMMI, ISO and GRC compliance consulting
**Prepared by:** Freeda · **Mentor:** Animesh · **Date:** 29 September 2026 · **Version:** 1.2 (draft for review)

**Sources:** discovery call with Pramila (29 Aug 2026), the SQAS client database Excel template (`SQAS_Client_Database.xlsx`), the follow-up question sheet, and the Drishti implementation plan (29 Sep 2026).

> **What this document is.** The PRD says *what* Drishti must do and *why*, for whom, and how we will know it works. It deliberately does not choose technology — that is the Tech Stack document. Where this PRD and the implementation plan disagree, the PRD wins on *what*, the plan wins on *how*.

---

## 1. Summary

SQAS is a four-to-six-person consultancy that certifies IT companies for CMMI, ISO and similar standards. Everything runs from one Excel sheet that Pramila and Mahesh review every weekend. Two things leak money:

1. **Renewals.** CMMI renews every 3 years, ISO has yearly surveillance audits. After 4–5 years of trading, some renewals are already overdue inside the spreadsheet, and nobody is reminded.
2. **Leads that go quiet.** Mahesh takes the first call, someone else follows up later, and the prospect treats them as a stranger ("we already spoke to some other guy"). Follow-ups are manual, irregular, and she cannot tell if anyone read them.

**Drishti** replaces the Excel sheet with a shared, logged-in CRM that (a) shows every renewal due or overdue from real dates, (b) shows the sales pipeline and who owns each lead, and (c) drafts follow-up emails that go out **from the person who held the original meeting, in the same email thread**, only after a human presses Send — with a signal when the email was opened.

---

## 2. Problem statements (in the client's words)

| # | Problem | Evidence from the call | Why it matters |
|---|---|---|---|
| P1 | Renewals are tracked by memory | "The renewal will be for every three years." "Using only Excel." | Each missed renewal is a lost 3-year (CMMI) or yearly (ISO) contract from an existing, happy client — the cheapest revenue they have. |
| P2 | Follow-up comes from a "stranger" | "If I am following up, they feel it is altogether a strange person talking to them." | A generic automated email would make this worse. Continuity of person and thread is the actual fix. |
| P3 | No pipeline visibility | "We do not have proper pipeline management." Weekend reviews to "remember" what is happening. | Leads from digital marketing are lost after the Zoom presentation; no one knows what stage each lead is at. |
| P4 | No read receipts | "We cannot get the tokens for all the emails." | They cannot tell ignored from unread, so they don't know whether to chase or wait. |
| P5 | Excel will not scale | Shared among 3–4 people, growing, data "bound to be lost." | One source of truth that the whole team can see and edit safely. |

**Not a problem we are solving in v1:** getting client line managers to sit down and do documentation (the most time-consuming part of delivery). It was named on the call but is a people problem; confirm with Pramila that v1 focuses on sales and renewals.

---

## 3. Goals and success metrics

**Goals for v1**

- G1. No renewal is ever missed: every certified engagement has a known next due date and a reminder.
- G2. Every open lead has an owner, a stage and a next follow-up date.
- G3. Follow-ups keep continuity: same sender, same thread, meeting context included.
- G4. The weekend Excel review is replaced by a dashboard anyone can open in a minute.
- G5. The team trusts the data: nothing invented on import, every change logged.

**How we measure it (3 months after launch)**

| Metric | Target | Baseline to collect before launch |
|---|---|---|
| Renewals that pass their due date without a reminder having been drafted | 0 | Count of overdue renewals found on first import |
| Open leads with no activity for more than the agreed interval (7 or 15 days) | 0 | Count on first import |
| Leads with an owner and a stage | 100% | — |
| Lead → client conversion rate | Improve on baseline | Ask: leads per month and conversions today |
| Hours spent on weekend review | Reduced (Pramila's own estimate) | Ask at kickoff |
| Weekly active users among the team | All owners, every week | — |

---

## 4. Users and roles

| Persona | Who | What they need from Drishti |
|---|---|---|
| **Owner / Admin** | Pramila (co-founder, ex-Deloitte technical delivery manager, 20+ yrs IT; built her own chatbot) | See everything; import data; approve and send follow-ups; manage team and settings. She will inspect the product technically — it must hold up to review. |
| **Owner / Admin** | Mahesh (co-founder, CMMI Lead Appraiser) | Takes most first calls; follow-ups must go out under his name from his mailbox; quick answers ("what's happening with X?"). |
| **Consultant** | Teenu Puri (Lead Appraiser), Sarath Chandra (Lead Auditor) — listed on the website, **to confirm** | See their clients and engagements, log visits and notes, update delivery status. |
| **Marketing** | Digital marketing person (external or part-time) | Add new leads; see lead counts by source. Must not see contract values. **Login to confirm.** |

Role permissions are listed in §7 (FR-9).

---

## 5. Scope

### In v1

1. Team login with roles
2. Client & engagement database that mirrors the 30-column Excel exactly
3. Excel import with a gap report (no invented data)
4. Renewal Radar
5. Sales pipeline board
6. Dashboard
7. Follow-up drafts in the owner's voice, human-approved, sent from the owner's Outlook in the same thread
8. Open tracking ("likely opened") and reply detection
9. Daily reminder engine (renewal and follow-up drafts + morning summary email)
10. Drishti assistant inside the web app (answers questions, proposes changes)
11. Activity history, archive instead of delete, Excel export

### Not in v1 (phase 2, quoted separately)

- WhatsApp assistant and WhatsApp reminders — **SQAS has no WhatsApp Business account yet**; phase 2 must include setting one up (Meta business verification, a dedicated number, approved message templates) before any WhatsApp feature can work
- AI voice calling and automatic meeting booking via calendar
- Invoicing (Tally / Zoho — awaiting answer)
- Website lead-capture form (quick add once lead sources are confirmed)
- Tools for delivery work (site-visit checklists, gap-analysis tracking, document collection)
- Mobile app (v1 is a responsive web app that works on a phone browser)

---

## 6. The data: built around her Excel

The Excel template (`SQAS_Client_Database.xlsx`) is the contract for the data model. It has two sheets and is currently **empty (headers only)** — we have the structure but not the real data yet.

### 6.1 The core rule from her own sheet

> *"Use one row per client engagement/certification when a client has multiple standards or separate engagements."*

So Drishti has two things: a **Client** (the company, stored once) and **Engagements** (each certification or service for that client, many per client). A lead that is won is not moved to another table — its engagement just changes status. One company can be a certified client for ISO 27001 and a fresh lead for CMMI at the same time.

### 6.2 Column mapping (all 30 columns keep a home)

| Excel col | Field | Belongs to | Notes |
|---|---|---|---|
| A | Client ID | Client | Keep her IDs as they are on import; generate new ones in the same style for new clients. Rows sharing a Client ID are one client. |
| B | Client Name | Client | Required |
| C | Industry / Sector | Client | |
| D | Address | Client | |
| E | City | Client | |
| F | State / Country | Client | |
| G | Contact Person | Client | |
| H | Designation | Client | |
| I | Email | Client | Required to send follow-ups; flag if missing |
| J | Phone | Client | |
| K | Website | Client | |
| L | Service / Certification | Engagement | Dropdown (16 values, §6.3) |
| M | Standard / Framework | Engagement | Free text, e.g. "CMMI-DEV v2.0 ML3", "ISO/IEC 27001:2022" |
| N | Scope of Certification / Service | Engagement | |
| O | Certification / Service Status | Engagement | Dropdown (10 values, §6.4) |
| P | Initial Engagement Date | Engagement | Date, shown as dd-mmm-yyyy |
| Q | Certification / Completion Date | Engagement | Date |
| R | Certificate / Report No. | Engagement | |
| S | Certificate Valid From | Engagement | Date |
| T | Certificate Valid To | Engagement | Date — drives renewal |
| U | Certification Body / External LA | Engagement | e.g. the certifying body, or the Lead Appraiser for CMMI |
| V | Surveillance / Renewal Due Date | Engagement | Date — drives renewal (takes priority) |
| W | Last Audit / Review Date | Engagement | Date |
| X | Next Audit / Review Date | Engagement | Date — drives reminders for surveillance audits |
| Y | Contract Value | Engagement | Rupees; hidden from Marketing |
| Z | Payment Status | Engagement | Dropdown (§6.3) |
| AA | Relationship Owner | Engagement | A team member; the person follow-ups are sent from |
| AB | Lead Source | Client | Dropdown (§6.3) |
| AC | Client Rating / Priority | Client | High / Medium / Low |
| AD | Remarks | Engagement | Free text; imported as the first note in history |

The Excel date columns use `dd-mmm-yyyy` (e.g. 12-Mar-2024). Drishti shows dates the same way so the team recognises them.

### 6.3 Her dropdown lists (become editable lists in Settings)

- **Service / Certification (16):** ISO 9001, ISO 20000-1, ISO 27001, ISO 22301, ISO 27701, ISO 42001, ISO 13485, CMMI, CMMC, SOC 1, SOC 2, GDPR, DPDP, HIPAA, VAPT, Other
- **Payment Status:** Not Invoiced, Partially Paid, Paid, Overdue, NA
- **Client Rating / Priority:** High, Medium, Low
- **Lead Source:** Referral, Website, LinkedIn, Existing Client, Partner, Event, Other

### 6.4 Status lifecycle (her 10 statuses, grouped)

| Group | Statuses | Where it appears |
|---|---|---|
| **Sales pipeline** | Lead, Proposal | Pipeline board, follow-up engine |
| **Delivery (won, work under way)** | In Progress, Implemented, Audit Completed | Delivery list; no sales follow-ups |
| **Active client** | Certified, Renewal Due, Completed | Clients list, Renewal Radar |
| **Paused** | On Hold | Pipeline board (separate column); follow-ups paused |
| **Ended** | Closed | Hidden by default; searchable |

> **Correction to the implementation plan:** the plan's `leads` view includes In Progress, Implemented and Audit Completed. Those are won engagements in delivery, not leads — sending them sales follow-ups would be wrong. Fix when we review the plan.

> **Open:** does "Closed" mean *lost lead*, *relationship ended*, or both? If both, we should add a "Closed reason" (Lost to competitor / No budget / Not interested / Relationship ended / Other).

### 6.5 New data the Excel does not have (needed for follow-ups)

Her sheet tracks certifications, not conversations. To fix P2 and P4, Drishti adds:

- **Meeting notes / activity log** per engagement: date, who held it (e.g. Mahesh), short summary, next step
- **Last contacted date** and **next follow-up date** (computed)
- **Email history** per engagement: sent, opened (likely), replied
- **Do-not-contact** flag per client
- **Estimated date** flag (see renewal rules)

---

## 7. Functional requirements

Priority: **Must** = v1 cannot ship without it. **Should** = v1 unless time runs out. **Could** = nice to have.

### FR-1 Login and team (Must)

- Each team member has their own login. Invite-only; no public sign-up.
- Admin can invite, change role, and deactivate a member (deactivated members keep their history).
- Each member has a profile: name, role, email, booking link, whether their Outlook is connected.

**Acceptance:** a user who was not invited cannot create an account. A deactivated user cannot log in, and their past emails and notes still show their name.

### FR-2 Clients and engagements (Must)

- Create, view, edit and archive clients and engagements with every field in §6.2.
- A client page shows all its engagements, contact details, activity history and emails.
- Search by client name, contact, city, certification, owner.
- Nothing is hard-deleted; archive hides it and can be undone by an Admin.

**Acceptance:** a client with ISO 27001 (Certified) and CMMI (Lead) shows one client page with two engagements, and appears both on the Radar and on the Pipeline board.

### FR-3 Excel import (Must)

- Import her exact 30-column template directly; other layouts go through a column-mapping screen.
- Preview before saving: rows accepted, rows flagged, duplicates, rejected rows — each with the reason.
- **Never invent data.** Missing email, phone, owner or date stays empty and is flagged. (The MVP invented `contact@company.in` and today's date — this must go, because a fake date can hide an overdue renewal.)
- Unknown dropdown values (e.g. a status spelled differently) are flagged, not guessed.
- Rows with the same Client ID are grouped into one client with several engagements.
- Every import is recorded (who, when, counts) and can be reviewed later.

**Acceptance:** her template filled with 20 test rows — including missing emails, a misspelt status, a duplicate and a CMMI certified 4 years ago — imports with an accurate flag report, and the old CMMI appears as overdue on the Radar.

### FR-4 Renewal Radar (Must — highest value)

- Lists every engagement in the "Active client" group with its next due date, grouped: **Overdue**, **Due in 30 days**, **31–90 days**, **Later**.
- Overdue is always at the top and shown separately (not mixed with upcoming).
- Shows **two kinds of events** where relevant: surveillance audits (Next Audit / Review Date, or Surveillance / Renewal Due Date) and recertification (Certificate Valid To).
- Filters: owner, certification type, priority.
- From any row: open the client, draft a renewal email, log a note.

**Renewal date rule (in order):**
1. Surveillance / Renewal Due Date, if filled
2. Next Audit / Review Date, if filled
3. Certificate Valid To, if filled
4. Otherwise **estimate** from Certification / Completion Date plus the default cycle for that certification type, and label it "Estimated — please check"

**Default cycles (editable in Settings; to confirm with Pramila):**

| Type | Default cycle |
|---|---|
| CMMI | 3-year appraisal validity |
| ISO (all) | Annual surveillance audit; 3-year recertification |
| SOC 1 / SOC 2 | Annual report |
| VAPT | Annual |
| CMMC | 3 years |
| GDPR, DPDP, HIPAA, Other | No automatic cycle unless a date is entered |

**Acceptance:** with seed data, an ISO 27001 client certified 14 months ago with no surveillance date shows as "Overdue — estimated"; a CMMI appraisal 2 years 10 months ago shows under "31–90 days".

### FR-5 Sales pipeline (Must)

- Board with a column for each pipeline status (Lead, Proposal, On Hold); dragging a card changes status and is logged.
- Moving a card to In Progress marks it as won and it leaves the board.
- Each card shows: client, certification, owner, value (hidden for Marketing), days since last contact, next follow-up date.
- Every lead must have an owner. Leads with no owner are highlighted.
- Filters: owner, source, certification.

**Acceptance:** a lead with no activity for longer than the follow-up interval is visibly marked "gone quiet".

### FR-6 Dashboard (Must)

- Pipeline value by stage and by owner
- Renewals: overdue, due in 30 / 60 / 90 days
- Leads this month by source (so the marketing person can be held to numbers)
- Quiet leads count and drafts waiting for review
- Every number clicks through to the list behind it.

### FR-7 Follow-up drafts and sending (Must — the core of P2)

**The rule that matters:** every email goes out **from the Relationship Owner's own Outlook mailbox**, as a reply in the **same thread** the client already has, **only after a person presses Send**.

- Drafts are written in first person as the owner, using the meeting notes (e.g. "When we spoke on 12 Sep about your CMMI Level 3 plans…").
- Draft style: under ~110 words, no clichés, one clear ask, two suggested times in IST or the owner's booking link.
- The reviewer can edit, send, skip, or reschedule a draft.
- If Pramila clicks Send on Mahesh's lead, it still goes from **Mahesh's** mailbox. If Mahesh has not connected Outlook, Drishti asks him to connect instead of sending from someone else.
- First email to a new contact starts a thread; all later ones reply in that thread.
- A draft is marked Sent only when delivery is confirmed; failures stay in the queue with a clear reason.

**Acceptance:** a follow-up approved by Pramila on a lead owned by (test) Mahesh arrives in the client's inbox from Mahesh, in the same thread as his first email.

### FR-8 Opens and replies (Must)

- Each sent email shows **"likely opened"** with a time, and the UI explains it is approximate (some mail apps block tracking, others open everything automatically).
- Link clicks are recorded but not shown unless Pramila asks for them.
- When the client replies in the thread, the engagement is marked **Replied**, the follow-up sequence stops, and the owner is notified.

### FR-9 Roles and permissions (Must)

Enforced by the system itself, not just hidden on screen.

| | Owner/Admin | Consultant | Marketing |
|---|---|---|---|
| See all clients & engagements | ✅ | ✅ | Leads only |
| See contract value & payment status | ✅ | ❌ by default (Admin can switch on per person) | ❌ |
| Edit engagements | All | Ones they own; notes on any | Leads they created |
| Add leads | ✅ | ✅ | ✅ |
| Send email | From own mailbox; can approve others' drafts | Own leads only | ❌ |
| Import, settings, team | ✅ | ❌ | ❌ |

**Acceptance:** a Marketing user cannot read contract values even by calling the system directly (not only through the screens).

### FR-10 Daily reminder engine (Must)

Runs every morning (IST):

- Creates **renewal drafts** at the agreed windows before each due date (default 90 and 30 days; she mentioned 2–3 months).
- Creates **follow-up drafts** for leads with no contact for the agreed interval (7 or 15 days), up to the agreed maximum number.
- **Stop rules:** client replied; maximum reached; status changed out of the pipeline; On Hold; do-not-contact.
- A **"Today" view** groups waiting drafts by owner.
- A short **morning summary email** to each owner: drafts waiting, renewals due, leads gone quiet.

**Acceptance:** moving the test clock forward creates exactly the expected drafts; a reply stops the sequence the next morning at the latest.

### FR-11 Drishti assistant (Should)

- Chat panel inside the app: "Which renewals are overdue?", "What's happening with BrightPath?", "I met Acme today, they want a proposal by Friday — update it."
- Answers only from data the user is allowed to see.
- **Never changes data by itself.** Changes appear as a proposal card; a person clicks Apply, and it is logged as "via Drishti".
- If the AI is unavailable, the common questions (overdue renewals, quiet leads) still work.

### FR-13 Light and dark themes (Should)

- Each user can choose **Light**, **Dark** or **System** (follows the device). Default: System.
- A one-click toggle in the top bar, and a three-way choice in the user menu.
- The choice is remembered per user, across devices, with no flash of the wrong theme on load.
- Both themes meet the same readability standard (WCAG AA contrast).

**Acceptance:** switching themes changes every screen instantly; logging in on another device opens in the same theme.

### FR-12 Activity history and export (Must)

- Every change, note, import, email, and applied proposal is logged: who, when, from where (manual / Drishti / system).
- One-click Excel export in her original 30-column layout, so she always has her own copy.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| **Security** | No secret key ever reaches the browser. Permissions enforced in the database. Invite-only. Pramila will inspect it — assume a technical reviewer. |
| **Privacy (DPDP Act 2023)** | SQAS is the data fiduciary; Freeda is the processor. Data stored in India. Do-not-contact flag. Delete a person's personal data on request. Real client data never used in development or pasted into AI tools. AI provider must not train on her data. |
| **Email trust** | Nothing is ever sent automatically in v1. Sending needs the client's Microsoft 365 admin approval (Outlook is her email). |
| **Reliability** | Daily backups. A missed reply notification is caught by a daily re-check. |
| **Performance** | First page loads in under 3 seconds on a 4G phone. Works at 10,000 engagements without slowing. |
| **Usability** | Works on laptop and phone browser. Dates in dd-mmm-yyyy, times in IST, money in ₹ with Indian grouping (₹1,00,000). |
| **Auditability** | Full change history; archive instead of delete. |
| **Login security** | MFA (authenticator app) **required** for Owner/Admin accounts; optional for others. |
| **Data retention** *(proposed, confirm with Pramila)* | Active/certified clients: while a client · Closed/lost leads: 3 years, then contact details removed (company + numbers kept) · Email content: 2 years after the engagement closes (dates kept) · Open-tracking records: 12 months · Activity log: permanent · Invoices/payments: per their accountant. All editable settings; applied by a monthly cleanup job. |
| **Running cost** | Kept low and predictable; AI usage capped per user per day with a monthly spend alert. |
| **Ownership** | At handover, everything runs on SQAS's own accounts and domain; the code repository is transferred to them. |

---

## 9. Key user journeys

1. **Monday morning (Pramila):** opens Drishti → Today view shows 3 renewal drafts and 5 follow-ups → edits one, sends four, skips one → Radar shows one CMMI overdue → assigns it to Mahesh.
2. **After a first call (Mahesh):** adds the lead, logs "Zoom with CTO, wants ML3 by March, send proposal" → 7 days later a draft appears in his voice → Pramila approves it → it goes from Mahesh's mailbox in his thread → Drishti shows "likely opened" next day → client replies → sequence stops, Mahesh is notified.
3. **First day (Admin):** imports the real Excel → reviews the flag report (12 missing emails, 4 estimated dates) → fixes what she can → Radar reveals renewals overdue from past years.
4. **Marketing person:** adds three leads from LinkedIn → sees this month's lead count by source → cannot see any rupee values.

---

## 10. Assumptions

- Company email is **Microsoft 365 / Outlook** on shreeqasolutions.com. **Mahesh owns the Microsoft 365 account**, so he is the person who approves Drishti's access to the team's mailboxes (a one-time admin consent). Still to confirm: was it bought from Microsoft directly or through GoDaddy (GoDaddy can block that approval)?
- SQAS does **not** have a WhatsApp Business account; nothing in v1 depends on WhatsApp.
- The team is 4–6 people; the system must work fine up to ~20 users.
- Pramila and Mahesh review drafts; full automation is not wanted in v1 (to confirm — this is the biggest build-changing answer).
- An MVP named **Drishti** already exists and its screens are kept; only the engine behind it changes.
- Build cost ₹1,00,000 one-time plus support — agreed. Running costs (hosting, email, AI) are separate and to be agreed.

---

## 11. Open questions (blocking items marked ⚠)

| # | Question | Blocks |
|---|---|---|
| ⚠1 | Microsoft 365 bought from Microsoft or GoDaddy? *(Admin answered: Mahesh owns the account.)* Book 30 min with Mahesh at the email checkpoint to grant consent. | Email sending (FR-7) |
| ⚠2 | Is "draft → human presses Send" the right approach, or do they want fully automatic? | FR-7, FR-10 |
| ⚠3 | A few real, anonymised Excel rows | Import (FR-3); tests |
| 4 | Final team list and roles; does the marketing person get a login? | FR-1, FR-9 |
| 5 | ~~Should Consultants see contract values?~~ **Decided:** hidden by default; per-person setting | FR-9 |
| 6 | Follow-up interval (7 or 15 days) and maximum number of follow-ups | FR-10 |
| 7 | Renewal reminder windows (90/30 days?) and the cycle for each certification type | FR-4, FR-10 |
| 8 | Overdue renewals from past years: show separately (proposed) or mixed in? | FR-4 |
| 9 | What does "Closed" mean — lost, ended, or both? Want a closed reason? | §6.4 |
| 10 | If a lead's owner changes mid-conversation, do follow-ups switch sender or stay with the original meeting holder? | FR-7 |
| 11 | Two or three real past emails from Mahesh and Pramila for tone | FR-7 draft quality |
| 12 | Opens only, or clicks too? | FR-8 |
| 13 | Leads per month and conversions today (baseline) | §3 metrics |
| 14 | Invoicing wanted? Tally or Zoho? | Phase 2 |
| 16 | For phase 2: which phone number should become the WhatsApp Business number, and who owns the Meta Business account? | Phase 2 WhatsApp |
| 15 | Who pays running costs; what "lifetime support" covers | Handover |

---

## 12. Release criteria (v1 is done when)

- [ ] Her real Excel is imported on her own accounts, with the flag report reviewed with her
- [ ] Renewal Radar shows every certified engagement with a due date (real or marked estimated)
- [ ] Every open lead has an owner, stage and next follow-up date
- [ ] One real follow-up has been sent from an owner's mailbox, in thread, shown as opened, and a reply stopped the sequence
- [ ] Each role has been tested and sees only what it should
- [ ] No secret key is visible in the browser
- [ ] The team has had a walkthrough and a one-page user guide

---

## Change log

- **1.3 (29 Sep 2026):** Added FR-13 light/dark themes.
- **1.2 (29 Sep 2026):** Consultants don't see contract values by default; MFA required for Owners; retention rules proposed; hosting on Cloudflare Pages.
- **1.1 (29 Sep 2026):** Mahesh confirmed as Microsoft 365 owner/admin; no WhatsApp Business account (phase 2 dependency added); dummy test data added (`SQAS_Client_Database_DUMMY.xlsx`).
- **1.0 (29 Sep 2026):** First draft.

## 13. Glossary

- **Engagement** — one certification or service for one client (one row in her Excel).
- **Relationship Owner** — the team member responsible for the engagement; follow-ups go out from their mailbox.
- **Surveillance audit** — the yearly check an ISO-certified company must pass between 3-yearly recertifications.
- **CMMI appraisal** — the assessment by a Lead Appraiser (Mahesh is one); results are valid for 3 years.
- **Draft** — a follow-up email prepared by Drishti that waits for a person to review and send.
- **Likely opened** — the email's tracking image loaded; approximate, not proof.
