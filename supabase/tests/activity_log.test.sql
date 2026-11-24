-- pgTAP tests for supabase/migrations/20261011120000_activity_log.sql (Phase 1, step 14).
-- Everything runs in one transaction that is rolled back at the end, so the test users and
-- every row disappear. Test users and clients are fake (@example.test, Client ID TST-C201).
--
-- "Acting as" a user = switch to the API's database role and set the login claims the API
-- would set, as in clients_engagements_rls.test.sql. "As the server" = reset role (the table
-- owner) with no login claims. Results are always read back as the server, so they don't
-- depend on the caller's read rules.
--
-- No test depends on another: every change is made on an engagement used by that test only.
-- Status codes used are only those in 20261003180745_lookups.sql (Lead, Proposal, In
-- Progress, Implemented, Audit Completed, Certified, Renewal Due, On Hold, Closed), plus the
-- deliberately invalid 'Won' and 'lead'.

begin;
create extension if not exists pgtap with schema extensions;

select plan(126);

-- Runs an update as the current role and returns how many rows it changed.
create function pg_temp.changed(sql text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- How many log rows an engagement has (call as the server).
create function pg_temp.log_count(p_engagement uuid)
returns integer
language sql
as $$
  select count(*)::int from public.activity_log where kind = 'status_change' and engagement_id = p_engagement
$$;

-- An engagement's log rows as text, oldest first: actor|source|from|to;... ('-' = empty).
create function pg_temp.log_rows(p_engagement uuid)
returns text
language sql
as $$
  select string_agg(
    format('%s|%s|%s|%s', coalesce(actor_id::text, '-'), source, coalesce(from_status, '-'),
      coalesce(to_status, '-')),
    ';' order by id)
  from public.activity_log where kind = 'status_change' and engagement_id = p_engagement
$$;

-- An engagement's status and log count, e.g. 'Certified|0' (call as the server).
create function pg_temp.state(p_engagement uuid)
returns text
language sql
as $$
  select coalesce(e.status, '-') || '|' || pg_temp.log_count(e.id)
  from public.engagements e where e.id = p_engagement
$$;

-- ---------------------------------------------------------------------------
-- Test users (created as the server; the step 5 trigger makes their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('f1000000-0000-4000-8000-000000000001', 'log-owner1@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "Log Test Owner 1"}'),
  ('f1000000-0000-4000-8000-000000000002', 'log-owner2@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "Log Test Owner 2"}'),
  ('f1000000-0000-4000-8000-000000000011', 'log-consultant1@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Log Test Consultant 1"}'),
  ('f1000000-0000-4000-8000-000000000012', 'log-consultant2@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Log Test Consultant 2"}'),
  ('f1000000-0000-4000-8000-000000000013', 'log-consultant-inactive@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Log Test Consultant Inactive"}'),
  ('f1000000-0000-4000-8000-000000000021', 'log-marketing@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "Log Test Marketing"}'),
  ('f1000000-0000-4000-8000-000000000031', 'log-norole@example.test', 'authenticated', 'authenticated',
   '{}', '{"full_name": "Log Test No Role"}');

update public.profiles set can_see_values = true where id = 'f1000000-0000-4000-8000-000000000012';
update public.profiles set active = false where id = 'f1000000-0000-4000-8000-000000000013';

-- ---------------------------------------------------------------------------
-- Test data, added as the server (no login, so created_by is kept as given). One client;
-- one engagement per test. o1 = Owner 1, c1/c2 = Consultants, ci = inactive Consultant,
-- m = Marketing.
--   C1-C6  01-06  allowed changes through the function
--   D1-D9  11-19  refused changes through the function
--   E1-E4  21-24  invalid input and the same status
--   F1-F8  31-38  direct updates
--   G7-G10 47-50  history for the read tests (rows added below)
--   S1     51     the service role's insert
-- ---------------------------------------------------------------------------
insert into public.clients (id, client_code, name, created_by) values
  ('f2000000-0000-4000-8000-000000000001', 'TST-C201', 'Test Log Client', 'f1000000-0000-4000-8000-000000000001');

insert into public.engagements (id, client_id, status, created_by, owner_id) values
  -- C: allowed
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Certified',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001', 'In Progress',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000011'),
  ('f3000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000001', 'Renewal Due',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000005', 'f2000000-0000-4000-8000-000000000001', 'Proposal',
   'f1000000-0000-4000-8000-000000000021', null),
  ('f3000000-0000-4000-8000-000000000006', 'f2000000-0000-4000-8000-000000000001', null,
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000011'),
  -- D: refused
  ('f3000000-0000-4000-8000-000000000011', 'f2000000-0000-4000-8000-000000000001', 'Certified',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000012', 'f2000000-0000-4000-8000-000000000001', 'In Progress',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000011'),
  ('f3000000-0000-4000-8000-000000000013', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000014', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000021', 'f1000000-0000-4000-8000-000000000011'),
  ('f3000000-0000-4000-8000-000000000015', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000016', 'f2000000-0000-4000-8000-000000000001', 'In Progress',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000011'),
  ('f3000000-0000-4000-8000-000000000017', 'f2000000-0000-4000-8000-000000000001', 'In Progress',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000013'),
  ('f3000000-0000-4000-8000-000000000018', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000019', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  -- E: invalid input, same status
  ('f3000000-0000-4000-8000-000000000021', 'f2000000-0000-4000-8000-000000000001', 'Proposal',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000022', 'f2000000-0000-4000-8000-000000000001', 'Proposal',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000023', 'f2000000-0000-4000-8000-000000000001', 'Proposal',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000024', 'f2000000-0000-4000-8000-000000000001', 'Proposal',
   'f1000000-0000-4000-8000-000000000001', null),
  -- F: direct updates
  ('f3000000-0000-4000-8000-000000000031', 'f2000000-0000-4000-8000-000000000001', 'Certified',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000032', 'f2000000-0000-4000-8000-000000000001', 'Certified',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000033', 'f2000000-0000-4000-8000-000000000001', 'Certified',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000034', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000035', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000036', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  ('f3000000-0000-4000-8000-000000000037', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000021', null),
  ('f3000000-0000-4000-8000-000000000038', 'f2000000-0000-4000-8000-000000000001', 'In Progress',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000011'),
  -- G: history for the read tests
  ('f3000000-0000-4000-8000-000000000047', 'f2000000-0000-4000-8000-000000000001', 'On Hold',
   'f1000000-0000-4000-8000-000000000021', null),
  ('f3000000-0000-4000-8000-000000000048', 'f2000000-0000-4000-8000-000000000001', 'Proposal',
   'f1000000-0000-4000-8000-000000000021', null),
  ('f3000000-0000-4000-8000-000000000049', 'f2000000-0000-4000-8000-000000000001', 'Certified',
   'f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000012'),
  ('f3000000-0000-4000-8000-000000000050', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null),
  -- S1: the service role's insert
  ('f3000000-0000-4000-8000-000000000051', 'f2000000-0000-4000-8000-000000000001', 'Lead',
   'f1000000-0000-4000-8000-000000000001', null);

-- ---------------------------------------------------------------------------
-- 1-22: shape, grants, triggers and functions
-- ---------------------------------------------------------------------------
select has_table('public', 'activity_log', 'activity_log exists');
select ok((select relrowsecurity from pg_class where oid = 'public.activity_log'::regclass),
  'Row-level security is on for activity_log');
select columns_are('public', 'activity_log', array[
  'id', 'created_at', 'actor_id', 'source', 'kind', 'engagement_id', 'from_status', 'to_status',
  'client_id', 'meta'
], 'activity_log has who, when, source, kind, engagement, client, from, to and server-written meta; no value column');
select col_is_pk('public', 'activity_log', 'id', 'activity_log.id is the primary key');
select fk_ok('public', 'activity_log', 'actor_id', 'public', 'profiles', 'id',
  'activity_log.actor_id is a team member');
select fk_ok('public', 'activity_log', 'engagement_id', 'public', 'engagements', 'id',
  'activity_log.engagement_id is an engagement');
select fk_ok('public', 'activity_log', 'from_status', 'public', 'statuses', 'code',
  'activity_log.from_status is a status');
select fk_ok('public', 'activity_log', 'to_status', 'public', 'statuses', 'code',
  'activity_log.to_status is a status');
select policies_are('public', 'activity_log', array[
  'activity_log: owners and consultants read all',
  'activity_log: marketing reads lead history',
  'activity_log: owners and consultants read client history',
  'activity_log: owners read firm-wide rows'
], 'activity_log has read policies only');

select table_privs_are('public', 'activity_log', 'anon', array[]::text[],
  'anon has no access to activity_log');
select table_privs_are('public', 'activity_log', 'authenticated', array['SELECT'],
  'Logged-in users can only read activity_log');
select table_privs_are('public', 'activity_log', 'service_role', array['SELECT', 'INSERT'],
  'The service role can only read and add to activity_log');

select has_trigger('public', 'activity_log', 'insert_only',
  'activity_log has the update/delete guard');
select has_trigger('public', 'activity_log', 'insert_only_truncate',
  'activity_log has the truncate guard');
select has_trigger('public', 'engagements', 'log_status_change',
  'engagements logs status changes');

select ok(
  not (select prosecdef from pg_proc where oid = 'public.change_engagement_status(uuid, text)'::regprocedure),
  'change_engagement_status runs as the caller (security invoker), so the step 8 rules apply'
);
select ok(
  (select prosecdef from pg_proc where oid = 'app.log_status_change()'::regprocedure),
  'log_status_change runs as its owner (security definer), so callers need no insert right'
);
select ok(
  (select coalesce(proconfig && array['search_path=""', 'search_path='], false)
   from pg_proc where oid = 'public.change_engagement_status(uuid, text)'::regprocedure),
  'change_engagement_status has an empty search_path'
);
select ok(
  (select coalesce(proconfig && array['search_path=""', 'search_path='], false)
   from pg_proc where oid = 'app.log_status_change()'::regprocedure),
  'log_status_change has an empty search_path'
);
select ok(
  (select coalesce(proconfig && array['search_path=""', 'search_path='], false)
   from pg_proc where oid = 'app.activity_log_insert_only()'::regprocedure),
  'activity_log_insert_only has an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.change_engagement_status(uuid, text)', 'execute'),
  'anon cannot call change_engagement_status'
);
select ok(
  has_function_privilege('authenticated', 'public.change_engagement_status(uuid, text)', 'execute'),
  'Logged-in users can call change_engagement_status'
);

-- ---------------------------------------------------------------------------
-- 23-28: the row checks (as the server, which may insert)
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    ('f1000000-0000-4000-8000-000000000001', 'system', 'status_change',
     'f3000000-0000-4000-8000-000000000047', 'Lead', 'Proposal')$$,
  '23514', null::text,
  'A system entry cannot name a person'
);
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    (null, 'manual', 'status_change', 'f3000000-0000-4000-8000-000000000047', 'Lead', 'Proposal')$$,
  '23514', null::text,
  'A manual entry must name the person'
);
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    (null, 'system', 'status_change', 'f3000000-0000-4000-8000-000000000047', 'Lead', 'Lead')$$,
  '23514', null::text,
  'A status change must change the status'
);
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    (null, 'system', 'status_change', null, 'Lead', 'Proposal')$$,
  '23514', null::text,
  'A status change must name its engagement'
);
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id) values
    (null, 'system', 'note', 'f3000000-0000-4000-8000-000000000047')$$,
  '23514', null::text,
  'An unknown kind is refused'
);
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    (null, 'import', 'status_change', 'f3000000-0000-4000-8000-000000000047', 'Lead', 'Proposal')$$,
  '23514', null::text,
  'The source must be manual, drishti or system'
);

-- ---------------------------------------------------------------------------
-- History for the read tests, added as the server:
--   G7  (On Hold, Marketing's): o1 Proposal -> In Progress, o1 In Progress -> On Hold
--   G8  (Proposal, Marketing's): m Lead -> Proposal
--   G9  (Certified):             c2 Audit Completed -> Certified
--   G10 (Lead):                  system, no status -> Lead
-- ---------------------------------------------------------------------------
insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
  ('f1000000-0000-4000-8000-000000000001', 'manual', 'status_change',
   'f3000000-0000-4000-8000-000000000047', 'Proposal', 'In Progress'),
  ('f1000000-0000-4000-8000-000000000001', 'manual', 'status_change',
   'f3000000-0000-4000-8000-000000000047', 'In Progress', 'On Hold'),
  ('f1000000-0000-4000-8000-000000000021', 'manual', 'status_change',
   'f3000000-0000-4000-8000-000000000048', 'Lead', 'Proposal'),
  ('f1000000-0000-4000-8000-000000000012', 'manual', 'status_change',
   'f3000000-0000-4000-8000-000000000049', 'Audit Completed', 'Certified'),
  (null, 'system', 'status_change',
   'f3000000-0000-4000-8000-000000000050', null, 'Lead');

-- 29-31
select is(
  (select count(*)::int from public.activity_log where kind = 'status_change' and engagement_id in (
    'f3000000-0000-4000-8000-000000000047', 'f3000000-0000-4000-8000-000000000048',
    'f3000000-0000-4000-8000-000000000049', 'f3000000-0000-4000-8000-000000000050')),
  5,
  'The five history rows for the read tests are in place'
);
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id in (
     'f3000000-0000-4000-8000-000000000047', 'f3000000-0000-4000-8000-000000000048',
     'f3000000-0000-4000-8000-000000000049', 'f3000000-0000-4000-8000-000000000050')
     and (source = 'system') <> (actor_id is null)),
  0,
  'Every history row obeys the rule: system entries have no person, manual entries have one'
);
select is(
  pg_temp.log_rows('f3000000-0000-4000-8000-000000000050'),
  '-|system|-|Lead',
  'The system history row has no person and no from status'
);

-- ---------------------------------------------------------------------------
-- 32-51: no logged-in user can add, change, remove or empty log rows
-- ---------------------------------------------------------------------------

-- 32-35: Owner 1
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    ('f1000000-0000-4000-8000-000000000001', 'manual', 'status_change',
     'f3000000-0000-4000-8000-000000000048', 'Proposal', 'Lead')$$,
  '42501', null::text, 'An Owner cannot add a log row directly');
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'An Owner cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'An Owner cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text, 'An Owner cannot empty the log');
reset role;

-- 36-39: Owner 2
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    ('f1000000-0000-4000-8000-000000000002', 'manual', 'status_change',
     'f3000000-0000-4000-8000-000000000048', 'Proposal', 'Lead')$$,
  '42501', null::text, 'The second Owner cannot add a log row directly');
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'The second Owner cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'The second Owner cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text, 'The second Owner cannot empty the log');
reset role;

-- 40-43: Consultant 1
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    ('f1000000-0000-4000-8000-000000000011', 'manual', 'status_change',
     'f3000000-0000-4000-8000-000000000048', 'Proposal', 'Lead')$$,
  '42501', null::text, 'A Consultant cannot add a log row directly');
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'A Consultant cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'A Consultant cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text, 'A Consultant cannot empty the log');
reset role;

-- 44-47: Consultant 2 (values access)
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000012", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    ('f1000000-0000-4000-8000-000000000012', 'manual', 'status_change',
     'f3000000-0000-4000-8000-000000000048', 'Proposal', 'Lead')$$,
  '42501', null::text, 'A Consultant with values access cannot add a log row directly');
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'A Consultant with values access cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'A Consultant with values access cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text,
  'A Consultant with values access cannot empty the log');
reset role;

-- 48-51: Marketing
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    ('f1000000-0000-4000-8000-000000000021', 'manual', 'status_change',
     'f3000000-0000-4000-8000-000000000048', 'Proposal', 'Lead')$$,
  '42501', null::text, 'Marketing cannot add a log row directly');
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000048'$$,
  '42501', null::text, 'Marketing cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000048'$$,
  '42501', null::text, 'Marketing cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text, 'Marketing cannot empty the log');
reset role;

-- ---------------------------------------------------------------------------
-- 52-55: anon gets nothing
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok($$select 1 from public.activity_log$$, '42501', null::text, 'anon cannot read the log');
select throws_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    (null, 'system', 'status_change', 'f3000000-0000-4000-8000-000000000048', 'Proposal', 'Lead')$$,
  '42501', null::text, 'anon cannot add a log row');
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'anon cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'anon cannot delete a log row');
reset role;

-- ---------------------------------------------------------------------------
-- 56-59: the service role adds rows but can't change, remove or empty them
-- ---------------------------------------------------------------------------
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'The service role cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'The service role cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text, 'The service role cannot empty the log');
select lives_ok(
  $$insert into public.activity_log (actor_id, source, kind, engagement_id, from_status, to_status) values
    (null, 'system', 'status_change', 'f3000000-0000-4000-8000-000000000051', null, 'Lead')$$,
  'The service role can add a log row (future imports)');
reset role;
set local request.jwt.claims to '';

-- ---------------------------------------------------------------------------
-- 60-63: even the table owner (as used by migrations) is refused by the triggers
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.activity_log set to_status = 'Lead' where engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'The table owner cannot change a log row');
select throws_ok(
  $$delete from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'$$,
  '42501', null::text, 'The table owner cannot delete a log row');
select throws_ok($$truncate public.activity_log$$, '42501', null::text, 'The table owner cannot empty the log');
select is(
  pg_temp.log_rows('f3000000-0000-4000-8000-000000000047'),
  'f1000000-0000-4000-8000-000000000001|manual|Proposal|In Progress;'
    || 'f1000000-0000-4000-8000-000000000001|manual|In Progress|On Hold',
  'The log rows are unchanged after every attempt'
);

-- ---------------------------------------------------------------------------
-- 64-76: allowed changes through change_engagement_status write exactly one correct row
-- ---------------------------------------------------------------------------

-- 64-66 C1: Owner 1 moves someone else's engagement, Certified -> Renewal Due
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select lives_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000001', 'Renewal Due')$$,
  'An Owner changes the status of an engagement someone else owns');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000001'),
  'f1000000-0000-4000-8000-000000000001|manual|Certified|Renewal Due',
  'Exactly one log row: the Owner, manual, Certified to Renewal Due');
select is(
  (select created_at from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000001'),
  now(),
  'The log row records when the change was made');

-- 67-68 C2: Owner 2 moves a lead Owner 1 created, Lead -> Proposal
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2"}';
select lives_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000002', 'Proposal')$$,
  'The second Owner changes the status of a lead the first Owner created');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000002'),
  'f1000000-0000-4000-8000-000000000002|manual|Lead|Proposal',
  'Exactly one log row: the second Owner, Lead to Proposal');

-- 69-70 C3: Consultant 1 moves their own engagement, In Progress -> Implemented
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';
select lives_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000003', 'Implemented')$$,
  'A Consultant changes the status of an engagement they own');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000003'),
  'f1000000-0000-4000-8000-000000000011|manual|In Progress|Implemented',
  'Exactly one log row: the Consultant, In Progress to Implemented');

-- 71-72 C4: Consultant 2 moves their own engagement, Renewal Due -> Certified
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000012", "role": "authenticated", "aal": "aal2"}';
select lives_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000004', 'Certified')$$,
  'A Consultant with values access changes the status of an engagement they own');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000004'),
  'f1000000-0000-4000-8000-000000000012|manual|Renewal Due|Certified',
  'Exactly one log row: the Consultant with values access, Renewal Due to Certified');

-- 73-74 C5: Marketing moves its own lead, Proposal -> On Hold
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select lives_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000005', 'On Hold')$$,
  'Marketing moves its own lead from Proposal to On Hold');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000005'),
  'f1000000-0000-4000-8000-000000000021|manual|Proposal|On Hold',
  'Exactly one log row: Marketing, Proposal to On Hold');

-- 75-76 C6: Owner 1 gives an engagement with no status its first status
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select lives_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000006', 'Lead')$$,
  'An Owner gives an engagement with no status a status');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000006'),
  'f1000000-0000-4000-8000-000000000001|manual|-|Lead',
  'Exactly one log row, with an empty from status');

-- ---------------------------------------------------------------------------
-- 77-95: refused changes raise an error, change nothing and write no log row
-- ---------------------------------------------------------------------------

-- 77-78 D1: Consultant 1, someone else's engagement
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000011', 'Renewal Due')$$,
  '42501', null::text, 'A Consultant cannot change the status of an engagement someone else owns');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000011'), 'Certified|0',
  'Status unchanged, no log row');

-- 79-80 D2: Consultant 2, someone else's engagement
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000012", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000012', 'Implemented')$$,
  '42501', null::text, 'A Consultant with values access cannot change someone else''s engagement');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000012'), 'In Progress|0',
  'Status unchanged, no log row');

-- 81-82 D3: Consultant 1, an engagement nobody owns
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000013', 'Proposal')$$,
  '42501', null::text, 'A Consultant cannot change the status of an engagement nobody owns');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000013'), 'Lead|0',
  'Status unchanged, no log row');

-- 83-84 D4: Marketing, its own lead out of the pipeline
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000014', 'In Progress')$$,
  '42501', null::text, 'Marketing cannot move its own lead out of the pipeline');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000014'), 'Lead|0',
  'Status unchanged, no log row');

-- 85-86 D5: Marketing, a lead someone else created
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000015', 'Proposal')$$,
  '42501', null::text, 'Marketing cannot change the status of a lead someone else created');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000015'), 'Lead|0',
  'Status unchanged, no log row');

-- 87-88 D6: Marketing, a delivery engagement it can't read
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000016', 'Implemented')$$,
  '42501', 'Engagement not found, or you can''t change its status',
  'Marketing cannot change a delivery engagement, and gets the same message as for a missing one');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000016'), 'In Progress|0',
  'Status unchanged, no log row');

-- 89-90 D7: an inactive Consultant, their own engagement
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000013", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000017', 'Implemented')$$,
  '42501', null::text, 'An inactive Consultant cannot change the status of an engagement they own');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000017'), 'In Progress|0',
  'Status unchanged, no log row');

-- 91-92 D8: a user without a role
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000031", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000018', 'Proposal')$$,
  '42501', null::text, 'A user without a role cannot change a status');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000018'), 'Lead|0',
  'Status unchanged, no log row');

-- 93-94 D9: anon
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000019', 'Proposal')$$,
  '42501', null::text, 'anon cannot change a status');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000019'), 'Lead|0',
  'Status unchanged, no log row');

-- 95 D10: an engagement that doesn't exist
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000099', 'Proposal')$$,
  '42501', 'Engagement not found, or you can''t change its status',
  'An unknown engagement gets the same message as one the caller may not change');
reset role;

-- ---------------------------------------------------------------------------
-- 96-103: invalid statuses and the same status are refused, with no log row
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000021', 'Won')$$,
  '22023', 'Unknown status', 'A status that doesn''t exist is refused');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000021'), 'Proposal|0',
  'Status unchanged, no log row');

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000022', 'lead')$$,
  '22023', 'Unknown status', 'A status in the wrong case is refused (codes are exact)');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000022'), 'Proposal|0',
  'Status unchanged, no log row');

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000023', null)$$,
  '22023', 'Unknown status', 'An empty status is refused');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000023'), 'Proposal|0',
  'Status unchanged, no log row');

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$select public.change_engagement_status('f3000000-0000-4000-8000-000000000024', 'Proposal')$$,
  '22023', 'The engagement already has that status', 'Moving to the same status is refused');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000024'), 'Proposal|0',
  'Status unchanged, no log row');

-- ---------------------------------------------------------------------------
-- 104-117: direct updates are logged exactly once, and only when the status changes
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';

-- 104-107: F1-F4 as Owner 1; their log checks are 108-111
-- F1: Certified -> Closed
select is(
  pg_temp.changed($$update public.engagements set status = 'Closed'
    where id = 'f3000000-0000-4000-8000-000000000031'$$),
  1, 'An Owner changes a status with a direct update');
-- F2: another field only
select is(
  pg_temp.changed($$update public.engagements set scope = 'Log test'
    where id = 'f3000000-0000-4000-8000-000000000032'$$),
  1, 'An Owner edits another field');
-- F3: the same status, saved with another field
select is(
  pg_temp.changed($$update public.engagements set status = status, scope = 'Log test'
    where id = 'f3000000-0000-4000-8000-000000000033'$$),
  1, 'An Owner saves the same status with another field');
-- F4: two leads in one update
select is(
  pg_temp.changed($$update public.engagements set status = 'Proposal'
    where id in ('f3000000-0000-4000-8000-000000000034', 'f3000000-0000-4000-8000-000000000035')$$),
  2, 'An Owner moves two leads in one update');
reset role;

-- 108-111
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000031'),
  'f1000000-0000-4000-8000-000000000001|manual|Certified|Closed',
  'A direct status update writes exactly one log row');
select is(pg_temp.state('f3000000-0000-4000-8000-000000000032'), 'Certified|0',
  'Editing another field writes no log row');
select is(pg_temp.state('f3000000-0000-4000-8000-000000000033'), 'Certified|0',
  'Saving the same status writes no log row');
select is(
  pg_temp.log_rows('f3000000-0000-4000-8000-000000000034') || ';'
    || pg_temp.log_rows('f3000000-0000-4000-8000-000000000035'),
  'f1000000-0000-4000-8000-000000000001|manual|Lead|Proposal;'
    || 'f1000000-0000-4000-8000-000000000001|manual|Lead|Proposal',
  'A two-row update writes one log row for each engagement');

-- 112-113 F5: server work (no login)
set local request.jwt.claims to '';
select is(
  pg_temp.changed($$update public.engagements set status = 'Proposal'
    where id = 'f3000000-0000-4000-8000-000000000036'$$),
  1, 'Server work changes a status');
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000036'),
  '-|system|Lead|Proposal',
  'Server work is logged as system, with no person');

-- 114-115 F6: Marketing, a direct update out of the pipeline
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$update public.engagements set status = 'In Progress' where id = 'f3000000-0000-4000-8000-000000000037'$$,
  '42501', null::text, 'Marketing cannot move its lead out of the pipeline with a direct update either');
reset role;
select is(pg_temp.state('f3000000-0000-4000-8000-000000000037'), 'Lead|0',
  'Status unchanged, no log row');

-- 116-117 F7: Consultant 1, a direct update on their own engagement
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';
select is(
  pg_temp.changed($$update public.engagements set status = 'Implemented'
    where id = 'f3000000-0000-4000-8000-000000000038'$$),
  1, 'A Consultant changes their own engagement''s status with a direct update');
reset role;
select is(pg_temp.log_rows('f3000000-0000-4000-8000-000000000038'),
  'f1000000-0000-4000-8000-000000000011|manual|In Progress|Implemented',
  'The Consultant''s direct update writes exactly one log row');

-- ---------------------------------------------------------------------------
-- 118-126: who reads which log rows (the G7-G10 history only)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
     and 'f3000000-0000-4000-8000-000000000050'),
  5, 'An Owner reads every log row');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
     and 'f3000000-0000-4000-8000-000000000050'),
  5, 'The second Owner reads every log row');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
     and 'f3000000-0000-4000-8000-000000000050'),
  5, 'A Consultant reads every log row');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000012", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
     and 'f3000000-0000-4000-8000-000000000050'),
  5, 'A Consultant with values access reads every log row');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';
select set_eq(
  $$select engagement_id, from_status, to_status from public.activity_log
    where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
      and 'f3000000-0000-4000-8000-000000000050'$$,
  $$values ('f3000000-0000-4000-8000-000000000048'::uuid, 'Lead'::text, 'Proposal'::text),
           ('f3000000-0000-4000-8000-000000000050'::uuid, null::text, 'Lead'::text)$$,
  'Marketing reads only lead-to-lead moves, on engagements that are leads now'
);
select is(
  (select count(*)::int from public.engagements where id = 'f3000000-0000-4000-8000-000000000047'),
  1, 'Marketing can read the On Hold lead that came back from delivery');
select is(
  (select count(*)::int from public.activity_log where kind = 'status_change' and engagement_id = 'f3000000-0000-4000-8000-000000000047'),
  0, 'but not its delivery history');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000031", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
     and 'f3000000-0000-4000-8000-000000000050'),
  0, 'A user without a role reads no log row');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "f1000000-0000-4000-8000-000000000013", "role": "authenticated", "aal": "aal2"}';
select is(
  (select count(*)::int from public.activity_log
   where kind = 'status_change' and engagement_id::text between 'f3000000-0000-4000-8000-000000000047'
     and 'f3000000-0000-4000-8000-000000000050'),
  0, 'An inactive Consultant reads no log row');
reset role;
set local request.jwt.claims to '';

select * from finish();
rollback;
