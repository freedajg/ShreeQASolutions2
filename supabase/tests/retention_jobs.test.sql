-- pgTAP tests for 20261124100700_retention_subscriptions_usage.sql: who can read the new
-- server-only tables, the Owner-only retention call, and what retention removes and keeps.
-- One transaction, rolled back. Fake users and rows (@example.test).

begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('d1000000-0000-4000-8000-000000000001', 'r-owner@example.test', 'authenticated', 'authenticated', '{"role": "owner"}', '{"full_name": "R Owner"}'),
  ('d1000000-0000-4000-8000-000000000011', 'r-cons@example.test', 'authenticated', 'authenticated', '{"role": "consultant"}', '{"full_name": "R Consultant"}'),
  ('d1000000-0000-4000-8000-000000000021', 'r-mkt@example.test', 'authenticated', 'authenticated', '{"role": "marketing"}', '{"full_name": "R Marketing"}');

-- A lost lead closed 5 years ago, and an active client with the same kind of data.
insert into public.clients (id, name, email, phone, contact_person) values
  ('d2000000-0000-4000-8000-000000000001', 'R Lost Co', 'lost@example.test', '+91 1', 'Lost Person'),
  ('d2000000-0000-4000-8000-000000000002', 'R Active Co', 'active@example.test', '+91 2', 'Active Person');
insert into public.engagements (id, client_id, certification_type, status) values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'CMMI', 'Closed'),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'ISO 27001', 'Certified');
-- touch_updated_at resets updated_at on update, so set it with the trigger off for this fixture
alter table public.engagements disable trigger touch_updated_at;
update public.engagements set updated_at = now() - interval '5 years'
  where id = 'd3000000-0000-4000-8000-000000000001';
alter table public.engagements enable trigger touch_updated_at;

insert into public.assistant_usage (profile_id, questions) values
  ('d1000000-0000-4000-8000-000000000011', 3), ('d1000000-0000-4000-8000-000000000021', 7);

-- ---------------------------------------------------------------------------
-- 1-4: server-only tables
-- ---------------------------------------------------------------------------
select table_privs_are('public', 'server_jobs', 'authenticated', array[]::text[], 'Signed-in users have no access to server_jobs');
select table_privs_are('public', 'server_jobs', 'anon', array[]::text[], 'anon has no access to server_jobs');
select table_privs_are('public', 'mailbox_subscriptions', 'authenticated', array[]::text[], 'Signed-in users have no access to mailbox_subscriptions');
select table_privs_are('public', 'assistant_usage', 'authenticated', array['SELECT'], 'Signed-in users may only read assistant_usage');

-- ---------------------------------------------------------------------------
-- 5-7: each person reads only their own usage
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal1"}';
select is((select count(*)::int from public.assistant_usage), 1, 'A Consultant reads only their own usage row');
select is((select questions from public.assistant_usage), 3, '... with their own count');
select throws_ok($$insert into public.assistant_usage (profile_id, questions) values ('d1000000-0000-4000-8000-000000000011', 0)$$,
  '42501', null::text, 'Nobody can write their own usage count');
reset role;

-- ---------------------------------------------------------------------------
-- 8-10: retention can be run by Owners only
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal1"}';
select throws_ok('select public.run_retention()', '42501', null::text, 'A Consultant can''t run retention');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "d1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal1"}';
select throws_ok('select public.run_retention()', '42501', null::text, 'An Owner without MFA can''t run retention');
reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok('select public.run_retention()', '42501', null::text, 'anon can''t run retention');
reset role;
set local request.jwt.claims to '';

-- ---------------------------------------------------------------------------
-- 11-16: what retention removes and keeps (as the server, like the monthly job)
-- ---------------------------------------------------------------------------
do $$ begin perform app.run_retention(app.today_ist()); end $$;
select is((select email from public.clients where id = 'd2000000-0000-4000-8000-000000000001'), null,
  'A lead lost longer ago than the setting loses its email');
select is((select contact_person from public.clients where id = 'd2000000-0000-4000-8000-000000000001'), null,
  '... and its contact person');
select is((select name from public.clients where id = 'd2000000-0000-4000-8000-000000000001'), 'R Lost Co',
  '... but keeps the company name');
select is((select email from public.clients where id = 'd2000000-0000-4000-8000-000000000002'), 'active@example.test',
  'An active client keeps its contact details');
select ok(exists (select 1 from public.activity_log where kind = 'retention_run'), 'Every run is logged');
select ok(exists (select 1 from cron.job where jobname = 'drishti-monthly-retention'), 'The monthly job is scheduled');

select * from finish();
rollback;
