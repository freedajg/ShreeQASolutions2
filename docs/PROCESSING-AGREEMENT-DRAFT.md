# Data processing agreement — DRAFT for review

**Status: draft by the developer, not legal advice.** SQAS and, if they wish, their lawyer must review and change it before anyone signs. Checked against the DPDP Act 2023 at a general level only; the DPDP Rules' current deadlines must be confirmed when signing.

## Parties
- **Data Fiduciary:** Shree QA Solutions ("SQAS").
- **Data Processor:** Freeda ("the Processor"), who built and supports Drishti.

## 1. What is processed and why
Business contact details of SQAS's clients and prospects (names, job titles, work emails, phone numbers, company details), certification and engagement records, meeting notes, and emails sent and received through Drishti. Purpose: running SQAS's client, renewal and sales work in Drishti. Nothing else.

## 2. Where
In SQAS's own Supabase project in Mumbai, India. Emails stay in SQAS's Microsoft 365. If the Drishti AI assistant is switched on, the records needed to answer a question are sent to Google (Gemini) — **only after SQAS's written approval (Questionnaire Q19)**, on a plan whose terms say the data is not used for training.

## 3. The Processor will
- Process the data only on SQAS's written instructions and only for the purpose above.
- Never use real client data for development or testing, and never paste it into AI tools.
- Keep access to the minimum needed for support; use MFA; never share passwords.
- Tell SQAS's incident contacts (Pramila and Mahesh) **the same day** about any suspected breach, and help SQAS meet its duties to the Data Protection Board and to affected people (SECURITY.md §A11).
- Help SQAS answer requests from people about their data (access, correction, erasure).
- At the end of the engagement, hand over everything and delete any copies the Processor holds, and confirm this in writing.

## 4. SQAS will
- Own all accounts (Supabase, Microsoft 365, Cloudflare, Google Cloud, GitHub) and the data.
- Decide the retention rules (Settings → Privacy) and the "do not contact" requests.

## 5. Retention (proposed; SQAS confirms)
Active clients: while a client. Closed or lost leads: contact details removed after 3 years. Email content: 2 years after the engagement closes. Open tracking: 12 months. Activity log: permanent. Drishti applies these monthly and logs each run.

## 6. Sub-processors
Supabase (database, hosting, India region), Microsoft (email, SQAS's own tenant), Cloudflare (website hosting), Google (Gemini, only if approved). The Processor tells SQAS before adding another.

Signed for SQAS: ____________ Date: ________  Signed by the Processor: ____________ Date: ________
