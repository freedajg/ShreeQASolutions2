-- pgTAP tests for 20261124100800_security_review_fixes.sql, plus the per-role checks for tables
-- that had none (security review M5): client_tags, mailbox_connections, email_batches,
-- email_link_clicks, whatsapp_messages, voice_calls. One transaction, rolled back.

begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'v-owner@example.test', 'authenticated', 'authenticated', '{"role": "owner"}', '{"full_name": "V Owner"}'),
  ('c1000000-0000-4000-8000-000000000011', 'v-cons@example.test', 'authenticated', 'authenticated', '{"role": "consultant"}', '{"full_name": "V Consultant"}'),
  ('c1000000-0000-4000-8000-000000000012', 'v-cons2@example.test', 'authenticated', 'authenticated', '{"role": "consultant"}', '{"full_name": "V Consultant Two"}'),
  ('c1000000-0000-4000-8000-000000000021', 'v-mkt@example.test', 'authenticated', 'authenticated', '{"role": "marketing"}', '{"full_name": "V Marketing"}');

insert into public.clients (id, name, email) values
  ('c2000000-0000-4000-8000-000000000001', 'V Lead Co', 'lead@example.test'),
  ('c2000000-0000-4000-8000-000000000002', 'V Delivery Co', 'delivery@example.test');
insert into public.engagements (id, client_id, certification_type, status, owner_id, created_by) values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'CMMI', 'Lead', 'c1000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000021'),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'ISO 27001', 'In Progress', 'c1000000-0000-4000-8000-000000000011', null);
insert into public.tags (id, name) values ('c4000000-0000-4000-8000-000000000001', 'V tag');
insert into public.client_tags (client_id, tag_id) values
  ('c2000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001');
insert into public.email_threads (id, engagement_id, client_id, owner_id, subject) values
  ('c5000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000011', 'T');
insert into public.email_messages (id, thread_id, engagement_id, client_id, direction, from_email, to_email, subject, body, provider) values
  ('c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'outbound', 'v-cons@example.test', 'lead@example.test', 'T', 'B', 'test');
insert into public.email_link_clicks (message_id, url) values ('c6000000-0000-4000-8000-000000000001', 'https://example.test');
insert into public.mailbox_connections (profile_id, mailbox_address, refresh_token) values
  ('c1000000-0000-4000-8000-000000000011', 'v-cons@example.test', 'encrypted');
insert into public.whatsapp_messages (client_id, engagement_id, body) values
  ('c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Hello');
insert into public.voice_calls (client_id, engagement_id, outcome) values
  ('c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'No Answer');

-- ---------------------------------------------------------------------------
-- 1-3: mailbox tokens are server only
-- ---------------------------------------------------------------------------
select table_privs_are('public', 'mailbox_connections', 'authenticated', array[]::text[], 'Signed-in users have no access to mailbox tokens');
select table_privs_are('public', 'mailbox_connections', 'anon', array[]::text[], 'anon has no access to mailbox tokens');
select table_privs_are('public', 'email_link_clicks', 'anon', array[]::text[], 'anon has no access to link clicks');

-- ---------------------------------------------------------------------------
-- 4-10: Marketing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "c1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.client_tags where client_id = 'c2000000-0000-4000-8000-000000000002'), 0,
  'Marketing can''t see the tags of a client with no lead');
select is((select count(*)::int from public.whatsapp_messages), 0, 'Marketing reads no WhatsApp messages');
select is((select count(*)::int from public.voice_calls), 0, 'Marketing reads no calls');
select is((select count(*)::int from public.email_batches), 0, 'Marketing reads no email batches');
select is((select count(*)::int from public.email_link_clicks), 0, 'Marketing reads no link clicks');
select throws_ok($$insert into public.email_batches (subject_template, body_template) values ('S', 'B')$$,
  '42501', null::text, 'Marketing can''t start a bulk email');
select throws_ok($$insert into public.voice_calls (client_id, engagement_id, outcome) values ('c2000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'No Answer')$$,
  '42501', null::text, 'Marketing can''t log calls');
reset role;

-- ---------------------------------------------------------------------------
-- 11-16: Consultants
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "c1000000-0000-4000-8000-000000000012", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.whatsapp_messages), 0, 'A Consultant reads no WhatsApp messages of others'' engagements');
select is((select count(*)::int from public.voice_calls), 0, 'A Consultant reads no calls of others'' engagements');
select is((select count(*)::int from public.email_link_clicks), 0, 'Consultants never read link clicks');
select is((select count(*)::int from public.client_tags where client_id = 'c2000000-0000-4000-8000-000000000002'), 1,
  'A Consultant reads client tags');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "c1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.whatsapp_messages), 1, 'The owning Consultant reads their WhatsApp messages');
select lives_ok($$insert into public.email_batches (subject_template, body_template) values ('S', 'B')$$,
  'A Consultant can start a bulk email');
reset role;

-- ---------------------------------------------------------------------------
-- 17-19: M1 sales follow-ups only on Lead/Proposal; L8 recipient can't be set from the browser
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "c1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal1"}';
select throws_ok($$insert into public.email_drafts (engagement_id, kind, subject, body) values ('c3000000-0000-4000-8000-000000000002', 'follow_up', 'S', 'B')$$,
  '42501', null::text, 'A delivery engagement can''t get a sales follow-up draft');
select lives_ok($$insert into public.email_drafts (engagement_id, kind, subject, body) values ('c3000000-0000-4000-8000-000000000001', 'follow_up', 'S', 'B')$$,
  'A Lead can get a follow-up draft');
select throws_ok($$update public.email_drafts set to_email = 'attacker@example.test' where engagement_id = 'c3000000-0000-4000-8000-000000000001'$$,
  '42501', null::text, 'Nobody can change a draft''s recipient');
reset role;
set local request.jwt.claims to '';

-- ---------------------------------------------------------------------------
-- 20-21: H1 a change of owner stops open drafts
-- ---------------------------------------------------------------------------
update public.engagements set owner_id = 'c1000000-0000-4000-8000-000000000012'
  where id = 'c3000000-0000-4000-8000-000000000001';
select is((select status from public.email_drafts where engagement_id = 'c3000000-0000-4000-8000-000000000001'), 'skipped',
  'A new Relationship Owner stops the old owner''s draft');
select is((select owner_id from public.email_drafts where engagement_id = 'c3000000-0000-4000-8000-000000000001'),
  'c1000000-0000-4000-8000-000000000011'::uuid, '... and the stopped draft keeps its old sender (it can''t be sent)');

-- ---------------------------------------------------------------------------
-- 22-24: H2 imported notes are never dated today and never move Last Contacted
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "c1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select lives_ok($$select public.commit_import('v.xlsx',
  '[{"client": {"client_code": "V-IMP-1", "name": "V Imported"}, "engagement": {"status": "Lead", "remarks": "Met at an event"}, "financials": null}]'::jsonb,
  '{"total": 1, "accepted": 1}'::jsonb, '[]'::jsonb)$$, 'An Owner imports a row with remarks and no dates');
reset role;
set local request.jwt.claims to '';
select is((select n.held_on from public.engagement_notes n join public.engagements e on e.id = n.engagement_id
  join public.clients c on c.id = e.client_id where c.client_code = 'V-IMP-1'), null::date,
  'The imported note has no made-up date');
select is((select e.last_contacted_on from public.engagements e join public.clients c on c.id = e.client_id
  where c.client_code = 'V-IMP-1'), null::date, 'Import never sets Last Contacted');

-- ---------------------------------------------------------------------------
-- 25-26: M3 no date parameter for retention; L6 the cap is atomic and server only
-- ---------------------------------------------------------------------------
select hasnt_function('public', 'run_retention', array['date'], 'run_retention no longer takes a date');
select function_privs_are('public', 'bump_assistant_usage', array['uuid', 'integer'], 'authenticated', array[]::text[],
  'Signed-in users can''t change their own assistant count');

select * from finish();
rollback;
