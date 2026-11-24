-- pgTAP tests for the 24-Nov-2026 migrations: renewals, notes, tags, settings, imports, email,
-- the reminder engine, workroom, invoices, outreach, web leads and MFA for Owners.
-- One transaction, rolled back at the end. Test users and rows are fake (@example.test).

begin;
create extension if not exists pgtap with schema extensions;

select plan(46);

-- ---------------------------------------------------------------------------
-- Fixtures (as the server)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('e1000000-0000-4000-8000-000000000001', 'x-owner@example.test', 'authenticated', 'authenticated', '{"role": "owner"}', '{"full_name": "X Owner"}'),
  ('e1000000-0000-4000-8000-000000000011', 'x-cons@example.test', 'authenticated', 'authenticated', '{"role": "consultant"}', '{"full_name": "X Consultant"}'),
  ('e1000000-0000-4000-8000-000000000012', 'x-cons2@example.test', 'authenticated', 'authenticated', '{"role": "consultant"}', '{"full_name": "X Consultant Two"}'),
  ('e1000000-0000-4000-8000-000000000021', 'x-mkt@example.test', 'authenticated', 'authenticated', '{"role": "marketing"}', '{"full_name": "X Marketing"}');

insert into public.clients (id, name, email, contact_person) values
  ('e2000000-0000-4000-8000-000000000001', 'X Lead Co', 'cto@example.test', 'Dr. Asha Rao'),
  ('e2000000-0000-4000-8000-000000000002', 'X Delivery Co', 'ops@example.test', 'Ravi K'),
  ('e2000000-0000-4000-8000-000000000003', 'X Certified Co', 'qa@example.test', 'Meera S');

insert into public.engagements (id, client_id, certification_type, status, owner_id, initial_engagement_date, last_contacted_on, completion_date, created_by) values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'CMMI', 'Lead', 'e1000000-0000-4000-8000-000000000011', '2026-08-01', '2026-09-01', null, 'e1000000-0000-4000-8000-000000000021'),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000002', 'ISO 27001', 'In Progress', 'e1000000-0000-4000-8000-000000000011', '2026-06-01', '2026-06-01', null, null),
  ('e3000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000003', 'ISO 27001', 'Certified', 'e1000000-0000-4000-8000-000000000012', '2025-01-01', null, '2025-07-29', null);

insert into public.engagement_financials (engagement_id, contract_value, payment_status) values
  ('e3000000-0000-4000-8000-000000000003', 250000, 'Paid');

insert into public.invoices (invoice_no, engagement_id, due_on, amount) values
  ('X/TEST/1', 'e3000000-0000-4000-8000-000000000003', '2026-10-01', 100000);

-- ---------------------------------------------------------------------------
-- 1-7: renewal rule (PRD FR-4), reference date 29-Sep-2026
-- ---------------------------------------------------------------------------
select is((select bucket from app.renewal_info('ISO 27001', null, null, null, '2025-07-29', '2026-09-29')),
  'Overdue', 'ISO 27001 certified 14 months ago, no dates: Overdue');
select is((select is_estimated from app.renewal_info('ISO 27001', null, null, null, '2025-07-29', '2026-09-29')),
  true, '... and labelled estimated');
select is((select bucket from app.renewal_info('CMMI', null, null, null, '2023-11-29', '2026-09-29')),
  '31–90 days', 'CMMI appraised 2 years 10 months ago: 31–90 days');
select is((select due_date from app.renewal_info('ISO 27001', '2026-01-09', '2026-05-01', '2027-01-01', null, '2026-09-29')),
  '2026-01-09'::date, 'Surveillance / Renewal Due Date wins over every other date');
select is((select event_kind from app.renewal_info('CMMI', null, null, '2026-11-14', null, '2026-09-29')),
  'Recertification', 'Valid To alone is a recertification');
select is((select bucket from app.renewal_info('DPDP', null, null, null, '2025-01-01', '2026-09-29')),
  'No date', 'DPDP has no cycle: no date, stays off the Radar');
select is((select bucket from app.renewal_info('SOC 2', null, '2026-10-15', null, null, '2026-09-29')),
  'Due in 30 days', 'Next Audit 16 days away: Due in 30 days');

-- ---------------------------------------------------------------------------
-- 8-10: anon gets nothing
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok('select count(*) from public.email_drafts', '42501', null::text, 'anon can''t read email_drafts');
select throws_ok('select count(*) from public.engagement_notes', '42501', null::text, 'anon can''t read notes');
select throws_ok('select count(*) from public.v_renewals', '42501', null::text, 'anon can''t read v_renewals');
reset role;

-- ---------------------------------------------------------------------------
-- 11-13: MFA for Owners: aal1 = no role, no data, no values
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.engagements where id::text like 'e3%'), 0, 'An Owner without MFA reads no engagement');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e3%'), 0, '... and no contract value');
select is((select count(*)::int from public.profiles where id = 'e1000000-0000-4000-8000-000000000001'), 1, '... but can read their own profile (to be sent to MFA set-up)');
reset role;

-- ---------------------------------------------------------------------------
-- 14-20: Owner (aal2)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select is((select count(*)::int from public.engagements where id::text like 'e3%'), 3, 'An Owner with MFA reads every engagement');
select is((select count(*)::int from public.invoices where invoice_no = 'X/TEST/1'), 1, 'An Owner reads invoices');
select lives_ok($$insert into public.engagement_notes (engagement_id, summary) values ('e3000000-0000-4000-8000-000000000003', 'Owner note')$$,
  'An Owner adds a note');
select lives_ok($$insert into public.email_drafts (engagement_id, kind, subject, body) values ('e3000000-0000-4000-8000-000000000003', 'manual', 'S', 'B')$$,
  'An Owner drafts an email on any engagement');
select is((select owner_id from public.email_drafts where engagement_id = 'e3000000-0000-4000-8000-000000000003' and kind = 'manual'),
  'e1000000-0000-4000-8000-000000000012'::uuid, 'The draft''s sender is the Relationship Owner, not the person drafting');
select throws_ok($$update public.email_drafts set status = 'sent' where engagement_id = 'e3000000-0000-4000-8000-000000000003'$$,
  '42501', null::text, 'Nobody can mark a draft sent from the browser');
select lives_ok($$update public.app_settings set follow_up_interval_days = 15 where id = 1$$, 'An Owner changes settings');
reset role;

-- ---------------------------------------------------------------------------
-- 21-30: Consultant (no values access) owns the lead and the delivery engagement
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.invoices where invoice_no = 'X/TEST/1'), 0, 'A Consultant without values access reads no invoice');
select lives_ok($$insert into public.engagement_notes (engagement_id, summary) values ('e3000000-0000-4000-8000-000000000003', 'Note on someone else''s engagement')$$,
  'A Consultant adds a note on any engagement (FR-9 "notes on any")');
select lives_ok($$insert into public.email_drafts (engagement_id, kind, subject, body) values ('e3000000-0000-4000-8000-000000000001', 'manual', 'S', 'B')$$,
  'A Consultant drafts on their own lead');
select throws_ok($$insert into public.email_drafts (engagement_id, kind, subject, body) values ('e3000000-0000-4000-8000-000000000003', 'bulk', 'S', 'B')$$,
  '42501', null::text, 'A Consultant can''t draft on another person''s engagement');
select is((select count(*)::int from public.email_drafts where engagement_id = 'e3000000-0000-4000-8000-000000000003'), 0,
  'A Consultant can''t read drafts of engagements they don''t own');
select is_empty($$update public.app_settings set max_follow_ups = 9 where id = 1 returning 1$$,
  'A Consultant can''t change settings (no row matches)');
select throws_ok('select * from public.run_reminder_engine(''2026-09-29'')', '42501', null::text,
  'Only an Owner runs the reminder engine');
select lives_ok($$insert into public.tags (name) values ('X test tag')$$, 'A Consultant adds a tag');
select lives_ok($$insert into public.delivery_items (engagement_id, kind, label, state) values ('e3000000-0000-4000-8000-000000000002', 'checklist', 'Clause 1', 'open')$$,
  'A Consultant adds workroom items on their own engagement');
select throws_ok($$insert into public.delivery_items (engagement_id, kind, label, state) values ('e3000000-0000-4000-8000-000000000003', 'checklist', 'Clause 1', 'open')$$,
  '42501', null::text, 'A Consultant can''t add workroom items on another person''s engagement');
reset role;

-- ---------------------------------------------------------------------------
-- 31-38: Marketing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.email_drafts), 0, 'Marketing reads no drafts');
select is((select count(*)::int from public.email_messages), 0, 'Marketing reads no emails');
select is((select count(*)::int from public.v_renewals), 0, 'Marketing reads no renewals');
select is((select count(*)::int from public.invoices), 0, 'Marketing reads no invoices');
select throws_ok($$insert into public.email_drafts (engagement_id, kind, subject, body) values ('e3000000-0000-4000-8000-000000000001', 'manual', 'S', 'B')$$,
  '42501', null::text, 'Marketing can''t draft email');
select lives_ok($$insert into public.engagement_notes (engagement_id, summary) values ('e3000000-0000-4000-8000-000000000001', 'Marketing note on its lead')$$,
  'Marketing adds a note on a lead it created');
select throws_ok($$insert into public.tags (name) values ('X mkt tag')$$, '42501', null::text, 'Marketing can''t create tags');
select is((select count(*)::int from public.import_batches), 0, 'Marketing reads no import history');
reset role;
set local request.jwt.claims to ''; -- back to the server (no login) for the checks below

-- ---------------------------------------------------------------------------
-- 39-41: notes are logged and move Last Contacted; source can't be forged
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.activity_log where kind = 'note_added'
  and engagement_id::text like 'e3%'), 3, 'Every note writes one log row');
select is((select distinct source from public.engagement_notes where engagement_id::text like 'e3%'), 'manual',
  'Notes from the browser are manual');
select is((select last_contacted_on from public.engagements where id = 'e3000000-0000-4000-8000-000000000003'),
  app.today_ist(), 'A note moves Last Contacted to its date');

-- ---------------------------------------------------------------------------
-- 42-44: the engine (stop rules) and a reply stops the sequence
-- ---------------------------------------------------------------------------
-- 30 days ahead: the notes above moved the lead's Last Contacted to today.
update public.app_settings set follow_up_interval_days = 7 where id = 1;
do $$ begin perform app.run_reminder_engine(app.today_ist() + 30); end $$;
select is((select count(*)::int from public.email_drafts where engagement_id = 'e3000000-0000-4000-8000-000000000001' and kind = 'follow_up'),
  1, 'A quiet lead gets one follow-up draft');
select is((select count(*)::int from public.email_drafts where engagement_id = 'e3000000-0000-4000-8000-000000000002' and kind = 'follow_up'),
  0, 'A delivery engagement never gets a sales follow-up');

insert into public.email_threads (id, engagement_id, client_id, owner_id, subject) values
  ('e4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000011', 'T');
insert into public.email_messages (thread_id, engagement_id, client_id, direction, from_email, to_email, subject, body, provider) values
  ('e4000000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'inbound', 'cto@example.test', 'x-cons@example.test', 'Re: T', 'Thanks', 'test');
select is((select status from public.email_drafts where engagement_id = 'e3000000-0000-4000-8000-000000000001' and kind = 'follow_up'),
  'skipped', 'A client reply stops the follow-up sequence');

-- ---------------------------------------------------------------------------
-- 45-46: draft greeting skips titles; web lead creates an unowned Website lead
-- ---------------------------------------------------------------------------
select ok((select body from app.draft_text('e3000000-0000-4000-8000-000000000001', 'follow_up', '2026-09-29')) like 'Hi Asha,%',
  'Drafts greet by first name, skipping a title');

set local role authenticated;
set local request.jwt.claims to '{"sub": "e1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal1"}';
select lives_ok($$select public.submit_web_lead('X Web Co', 'Pat', 'pat@example.test', '', 'Pune', 'ISO 27001', 'Wants ISO by Q2')$$,
  'Any role-holder can submit a web lead');
reset role;
set local request.jwt.claims to '';

select * from finish();
rollback;
