-- pgTAP tests for supabase/migrations/20261006120000_status_views.sql (Phase 1, step 9).
-- Everything runs in one transaction that is rolled back at the end, so the test users and
-- every row disappear. Test users and clients are fake (@example.test, Client IDs TST-C2nn).
--
-- "Acting as" a user = switch to the API's database role and set the login claims the API
-- would set for that user's session, as in the step 8 tests.

begin;
create extension if not exists pgtap with schema extensions;

select plan(67);

-- ---------------------------------------------------------------------------
-- Test users (created as the server; the step 5 trigger makes their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('b9000000-0000-4000-8000-000000000001', 'view-owner@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "View Test Owner"}'),
  ('b9000000-0000-4000-8000-000000000011', 'view-consultant@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "View Test Consultant"}'),
  ('b9000000-0000-4000-8000-000000000012', 'view-consultant-values@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "View Test Consultant Values"}'),
  ('b9000000-0000-4000-8000-000000000013', 'view-consultant-inactive@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "View Test Consultant Inactive"}'),
  ('b9000000-0000-4000-8000-000000000021', 'view-marketing@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "View Test Marketing"}'),
  ('b9000000-0000-4000-8000-000000000031', 'view-norole@example.test', 'authenticated', 'authenticated',
   '{}', '{"full_name": "View Test No Role"}');

-- As the server: Consultant Values may see values; the inactive Consultant may too, to prove
-- that being inactive wins. Then the inactive Consultant is deactivated.
update public.profiles set can_see_values = true
  where id in ('b9000000-0000-4000-8000-000000000012', 'b9000000-0000-4000-8000-000000000013');
update public.profiles set active = false
  where id = 'b9000000-0000-4000-8000-000000000013';

-- ---------------------------------------------------------------------------
-- Test data, added as the server. One engagement per status, plus two with no status.
--   K1 lead-only client (Marketing)   E01 Lead              ₹50,000 Not Invoiced
--                                     E02 Proposal          no financials row
--                                     E03 On Hold           financials row, value empty, NA
--   K2 mixed client (Owner)           E04 In Progress       ₹1,50,000 Partially Paid (owner: Consultant)
--                                     E05 Implemented       no financials row
--                                     E06 Audit Completed   ₹1,20,000 Paid
--                                     E07 Lead              no financials row (Marketing)
--   K3 certified client, no lead      E08 Certified         ₹2,00,000 Paid (owner: Consultant Values)
--                                     E09 Renewal Due       no financials row
--                                     E10 Completed         ₹80,000 Overdue
--                                     E11 Closed            ₹60,000 Paid
--                                     E12 (no status)       no financials row
--                                     E13 (no status)       ₹30,000 Not Invoiced
-- Expected: pipeline E01 E02 E03 E07 · delivery E04 E05 E06 · active_clients E08 E09 E10 ·
-- closed E11 · needs_review E12 E13.
-- ---------------------------------------------------------------------------
insert into public.clients (id, client_code, name, created_by) values
  ('d9000000-0000-4000-8000-000000000201', 'TST-C201', 'Test View Lead Client', 'b9000000-0000-4000-8000-000000000021'),
  ('d9000000-0000-4000-8000-000000000202', 'TST-C202', 'Test View Mixed Client', 'b9000000-0000-4000-8000-000000000001'),
  ('d9000000-0000-4000-8000-000000000203', 'TST-C203', 'Test View Certified Client', 'b9000000-0000-4000-8000-000000000001');

insert into public.engagements (id, client_id, status, created_by, owner_id) values
  ('e9000000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000201', 'Lead',
   'b9000000-0000-4000-8000-000000000021', null),
  ('e9000000-0000-4000-8000-000000000002', 'd9000000-0000-4000-8000-000000000201', 'Proposal',
   'b9000000-0000-4000-8000-000000000021', null),
  ('e9000000-0000-4000-8000-000000000003', 'd9000000-0000-4000-8000-000000000201', 'On Hold',
   'b9000000-0000-4000-8000-000000000021', null),
  ('e9000000-0000-4000-8000-000000000004', 'd9000000-0000-4000-8000-000000000202', 'In Progress',
   'b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000011'),
  ('e9000000-0000-4000-8000-000000000005', 'd9000000-0000-4000-8000-000000000202', 'Implemented',
   'b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000011'),
  ('e9000000-0000-4000-8000-000000000006', 'd9000000-0000-4000-8000-000000000202', 'Audit Completed',
   'b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000013'),
  ('e9000000-0000-4000-8000-000000000007', 'd9000000-0000-4000-8000-000000000202', 'Lead',
   'b9000000-0000-4000-8000-000000000021', null),
  ('e9000000-0000-4000-8000-000000000008', 'd9000000-0000-4000-8000-000000000203', 'Certified',
   'b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000012'),
  ('e9000000-0000-4000-8000-000000000009', 'd9000000-0000-4000-8000-000000000203', 'Renewal Due',
   'b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000012'),
  ('e9000000-0000-4000-8000-000000000010', 'd9000000-0000-4000-8000-000000000203', 'Completed',
   'b9000000-0000-4000-8000-000000000001', null),
  ('e9000000-0000-4000-8000-000000000011', 'd9000000-0000-4000-8000-000000000203', 'Closed',
   'b9000000-0000-4000-8000-000000000001', null),
  ('e9000000-0000-4000-8000-000000000012', 'd9000000-0000-4000-8000-000000000203', null,
   'b9000000-0000-4000-8000-000000000001', null),
  ('e9000000-0000-4000-8000-000000000013', 'd9000000-0000-4000-8000-000000000203', null,
   'b9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000011');

insert into public.engagement_financials (engagement_id, contract_value, payment_status) values
  ('e9000000-0000-4000-8000-000000000001', 50000.00, 'Not Invoiced'),
  ('e9000000-0000-4000-8000-000000000003', null, 'NA'),
  ('e9000000-0000-4000-8000-000000000004', 150000.00, 'Partially Paid'),
  ('e9000000-0000-4000-8000-000000000006', 120000.00, 'Paid'),
  ('e9000000-0000-4000-8000-000000000008', 200000.00, 'Paid'),
  ('e9000000-0000-4000-8000-000000000010', 80000.00, 'Overdue'),
  ('e9000000-0000-4000-8000-000000000011', 60000.00, 'Paid'),
  ('e9000000-0000-4000-8000-000000000013', 30000.00, 'Not Invoiced');

-- ---------------------------------------------------------------------------
-- 1-26: the views exist, run as the caller, have the agreed columns, and are read-only
-- ---------------------------------------------------------------------------
select has_view('public', 'pipeline', 'pipeline view exists');
select has_view('public', 'delivery', 'delivery view exists');
select has_view('public', 'active_clients', 'active_clients view exists');
select has_view('public', 'closed', 'closed view exists');
select has_view('public', 'needs_review', 'needs_review view exists');

select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.pipeline'::regclass),
  'pipeline runs as the logged-in user (security_invoker = true)'
);
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.delivery'::regclass),
  'delivery runs as the logged-in user (security_invoker = true)'
);
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.active_clients'::regclass),
  'active_clients runs as the logged-in user (security_invoker = true)'
);
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.closed'::regclass),
  'closed runs as the logged-in user (security_invoker = true)'
);
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.needs_review'::regclass),
  'needs_review runs as the logged-in user (security_invoker = true)'
);
select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any(c.reloptions), false)),
  array['team_members'],
  'team_members is the only public view that does not run as the logged-in user'
);

select columns_are('public', 'pipeline', array[
  'id', 'client_id', 'certification_type', 'standard_framework', 'scope', 'status',
  'status_group', 'status_sort_order', 'initial_engagement_date', 'completion_date',
  'certificate_number', 'valid_from', 'valid_to', 'certification_body', 'surveillance_due_date',
  'last_audit_date', 'next_audit_date', 'owner_id', 'lead_source', 'remarks',
  'last_contacted_on', 'next_follow_up_on', 'date_is_estimated', 'created_by', 'archived_at',
  'created_at', 'updated_at',
  'client_code', 'client_name', 'client_industry', 'client_address', 'client_city',
  'client_state_country', 'client_contact_person', 'client_designation', 'client_email',
  'client_phone', 'client_website', 'client_priority', 'client_do_not_contact',
  'client_archived_at',
  'contract_value', 'payment_status'
], 'pipeline has exactly the agreed columns');
select is(
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.delivery'::regclass and a.attnum > 0),
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.pipeline'::regclass and a.attnum > 0),
  'delivery has the same columns, in the same order and of the same types, as pipeline'
);
select is(
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.active_clients'::regclass and a.attnum > 0),
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.pipeline'::regclass and a.attnum > 0),
  'active_clients has the same columns, in the same order and of the same types, as pipeline'
);
select is(
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.closed'::regclass and a.attnum > 0),
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.pipeline'::regclass and a.attnum > 0),
  'closed has the same columns, in the same order and of the same types, as pipeline'
);
select is(
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.needs_review'::regclass and a.attnum > 0),
  (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum)
     from pg_attribute a where a.attrelid = 'public.pipeline'::regclass and a.attnum > 0),
  'needs_review has the same columns, in the same order and of the same types, as pipeline'
);

select table_privs_are('public', 'pipeline', 'anon', array[]::text[], 'anon has no access to pipeline');
select table_privs_are('public', 'delivery', 'anon', array[]::text[], 'anon has no access to delivery');
select table_privs_are('public', 'active_clients', 'anon', array[]::text[],
  'anon has no access to active_clients');
select table_privs_are('public', 'closed', 'anon', array[]::text[], 'anon has no access to closed');
select table_privs_are('public', 'needs_review', 'anon', array[]::text[],
  'anon has no access to needs_review');

select table_privs_are('public', 'pipeline', 'authenticated', array['SELECT'],
  'Logged-in users can only read pipeline');
select table_privs_are('public', 'delivery', 'authenticated', array['SELECT'],
  'Logged-in users can only read delivery');
select table_privs_are('public', 'active_clients', 'authenticated', array['SELECT'],
  'Logged-in users can only read active_clients');
select table_privs_are('public', 'closed', 'authenticated', array['SELECT'],
  'Logged-in users can only read closed');
select table_privs_are('public', 'needs_review', 'authenticated', array['SELECT'],
  'Logged-in users can only read needs_review');

-- ---------------------------------------------------------------------------
-- 27-31: anon (not logged in) gets nothing
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select 1 from public.pipeline', '42501', null::text, 'anon cannot read pipeline');
select throws_ok('select 1 from public.delivery', '42501', null::text, 'anon cannot read delivery');
select throws_ok('select 1 from public.active_clients', '42501', null::text, 'anon cannot read active_clients');
select throws_ok('select 1 from public.closed', '42501', null::text, 'anon cannot read closed');
select throws_ok('select 1 from public.needs_review', '42501', null::text, 'anon cannot read needs_review');

reset role;

-- ---------------------------------------------------------------------------
-- 32-38: Owner sees every row of each view, with values; blanks where none are recorded
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select set_eq(
  $$select id from public.pipeline where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002',
        'e9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000007']::uuid[],
  'Owner: pipeline has Lead, Proposal and On Hold, including leads with no financials row'
);
select set_eq(
  $$select id from public.delivery where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000004', 'e9000000-0000-4000-8000-000000000005',
        'e9000000-0000-4000-8000-000000000006']::uuid[],
  'Owner: delivery has In Progress, Implemented and Audit Completed, including one with no financials row'
);
select set_eq(
  $$select id from public.active_clients where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000008', 'e9000000-0000-4000-8000-000000000009',
        'e9000000-0000-4000-8000-000000000010']::uuid[],
  'Owner: active_clients has Certified, Renewal Due and Completed, including one with no financials row'
);
select set_eq(
  $$select id from public.closed where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000011']::uuid[],
  'Owner: closed has the Closed engagement'
);
select set_eq(
  $$select id from public.needs_review where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000012', 'e9000000-0000-4000-8000-000000000013']::uuid[],
  'Owner: needs_review has both engagements with no status, with or without a financials row'
);
select set_eq(
  $$select id, contract_value, payment_status from public.pipeline where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.delivery where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.active_clients where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.closed where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.needs_review where id::text like 'e9000000-%'$$,
  $$values
    ('e9000000-0000-4000-8000-000000000001'::uuid, 50000.00::numeric(12, 2), 'Not Invoiced'::text),
    ('e9000000-0000-4000-8000-000000000002'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000003'::uuid, null, 'NA'),
    ('e9000000-0000-4000-8000-000000000007'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000004'::uuid, 150000.00, 'Partially Paid'),
    ('e9000000-0000-4000-8000-000000000005'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000006'::uuid, 120000.00, 'Paid'),
    ('e9000000-0000-4000-8000-000000000008'::uuid, 200000.00, 'Paid'),
    ('e9000000-0000-4000-8000-000000000009'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000010'::uuid, 80000.00, 'Overdue'),
    ('e9000000-0000-4000-8000-000000000011'::uuid, 60000.00, 'Paid'),
    ('e9000000-0000-4000-8000-000000000012'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000013'::uuid, 30000.00, 'Not Invoiced')$$,
  'Owner: every view shows contract value and payment status, and blanks where no financials row exists'
);
select bag_eq(
  $$select id from public.pipeline where id::text like 'e9000000-%'
    union all select id from public.delivery where id::text like 'e9000000-%'
    union all select id from public.active_clients where id::text like 'e9000000-%'
    union all select id from public.closed where id::text like 'e9000000-%'
    union all select id from public.needs_review where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002',
        'e9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000004',
        'e9000000-0000-4000-8000-000000000005', 'e9000000-0000-4000-8000-000000000006',
        'e9000000-0000-4000-8000-000000000007', 'e9000000-0000-4000-8000-000000000008',
        'e9000000-0000-4000-8000-000000000009', 'e9000000-0000-4000-8000-000000000010',
        'e9000000-0000-4000-8000-000000000011', 'e9000000-0000-4000-8000-000000000012',
        'e9000000-0000-4000-8000-000000000013']::uuid[],
  'Every engagement is in exactly one of the five views (none missing, none twice)'
);

reset role;

-- ---------------------------------------------------------------------------
-- 39-44: Consultant (default) sees every row, never a value, not even on their own engagement
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000011", "role": "authenticated"}';

select set_eq(
  $$select id from public.pipeline where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002',
        'e9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000007']::uuid[],
  'Consultant: pipeline has every lead'
);
select set_eq(
  $$select id from public.delivery where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000004', 'e9000000-0000-4000-8000-000000000005',
        'e9000000-0000-4000-8000-000000000006']::uuid[],
  'Consultant: delivery has every delivery engagement, not only their own'
);
select set_eq(
  $$select id from public.active_clients where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000008', 'e9000000-0000-4000-8000-000000000009',
        'e9000000-0000-4000-8000-000000000010']::uuid[],
  'Consultant: active_clients has every active engagement'
);
select set_eq(
  $$select id from public.closed where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000011']::uuid[],
  'Consultant: closed has the Closed engagement'
);
select set_eq(
  $$select id from public.needs_review where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000012', 'e9000000-0000-4000-8000-000000000013']::uuid[],
  'Consultant: needs_review has both engagements with no status'
);
select is(
  (select count(*)::int from (
     select contract_value, payment_status from public.pipeline where id::text like 'e9000000-%'
     union all select contract_value, payment_status from public.delivery where id::text like 'e9000000-%'
     union all select contract_value, payment_status from public.active_clients where id::text like 'e9000000-%'
     union all select contract_value, payment_status from public.closed where id::text like 'e9000000-%'
     union all select contract_value, payment_status from public.needs_review where id::text like 'e9000000-%'
   ) v
   where v.contract_value is not null or v.payment_status is not null),
  0,
  'Consultant without values access: no contract value or payment status in any view, even on their own engagements'
);

reset role;

-- ---------------------------------------------------------------------------
-- 45-50: Consultant with values access sees every row, with values
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000012", "role": "authenticated"}';

select set_eq(
  $$select id from public.pipeline where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002',
        'e9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000007']::uuid[],
  'Consultant with values access: pipeline has every lead'
);
select set_eq(
  $$select id from public.delivery where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000004', 'e9000000-0000-4000-8000-000000000005',
        'e9000000-0000-4000-8000-000000000006']::uuid[],
  'Consultant with values access: delivery has every delivery engagement'
);
select set_eq(
  $$select id from public.active_clients where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000008', 'e9000000-0000-4000-8000-000000000009',
        'e9000000-0000-4000-8000-000000000010']::uuid[],
  'Consultant with values access: active_clients has every active engagement'
);
select set_eq(
  $$select id from public.closed where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000011']::uuid[],
  'Consultant with values access: closed has the Closed engagement'
);
select set_eq(
  $$select id from public.needs_review where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000012', 'e9000000-0000-4000-8000-000000000013']::uuid[],
  'Consultant with values access: needs_review has both engagements with no status'
);
select set_eq(
  $$select id, contract_value, payment_status from public.pipeline where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.delivery where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.active_clients where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.closed where id::text like 'e9000000-%'
    union all
    select id, contract_value, payment_status from public.needs_review where id::text like 'e9000000-%'$$,
  $$values
    ('e9000000-0000-4000-8000-000000000001'::uuid, 50000.00::numeric(12, 2), 'Not Invoiced'::text),
    ('e9000000-0000-4000-8000-000000000002'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000003'::uuid, null, 'NA'),
    ('e9000000-0000-4000-8000-000000000007'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000004'::uuid, 150000.00, 'Partially Paid'),
    ('e9000000-0000-4000-8000-000000000005'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000006'::uuid, 120000.00, 'Paid'),
    ('e9000000-0000-4000-8000-000000000008'::uuid, 200000.00, 'Paid'),
    ('e9000000-0000-4000-8000-000000000009'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000010'::uuid, 80000.00, 'Overdue'),
    ('e9000000-0000-4000-8000-000000000011'::uuid, 60000.00, 'Paid'),
    ('e9000000-0000-4000-8000-000000000012'::uuid, null, null),
    ('e9000000-0000-4000-8000-000000000013'::uuid, 30000.00, 'Not Invoiced')$$,
  'Consultant with values access: every view shows the values, including on engagements they don''t own'
);

reset role;

-- ---------------------------------------------------------------------------
-- 51-56: Marketing sees pipeline rows only, and never a value
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000021", "role": "authenticated"}';

select set_eq(
  $$select id from public.pipeline where id::text like 'e9000000-%'$$,
  array['e9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000002',
        'e9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000007']::uuid[],
  'Marketing: pipeline has every lead, On Hold included, and the lead of a client with delivery work'
);
select is((select count(*)::int from public.delivery where id::text like 'e9000000-%'), 0,
  'Marketing: delivery is empty');
select is((select count(*)::int from public.active_clients where id::text like 'e9000000-%'), 0,
  'Marketing: active_clients is empty');
select is((select count(*)::int from public.closed where id::text like 'e9000000-%'), 0,
  'Marketing: closed is empty');
select is((select count(*)::int from public.needs_review where id::text like 'e9000000-%'), 0,
  'Marketing: needs_review is empty (an engagement with no status is not a lead)');
select is(
  (select count(*)::int from public.pipeline
    where id::text like 'e9000000-%' and (contract_value is not null or payment_status is not null)),
  0,
  'Marketing: no contract value or payment status in pipeline, not even on its own leads'
);

reset role;

-- ---------------------------------------------------------------------------
-- 57-61: a user without a role sees nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000031", "role": "authenticated"}';

select is((select count(*)::int from public.pipeline where id::text like 'e9000000-%'), 0,
  'A user without a role: pipeline is empty');
select is((select count(*)::int from public.delivery where id::text like 'e9000000-%'), 0,
  'A user without a role: delivery is empty');
select is((select count(*)::int from public.active_clients where id::text like 'e9000000-%'), 0,
  'A user without a role: active_clients is empty');
select is((select count(*)::int from public.closed where id::text like 'e9000000-%'), 0,
  'A user without a role: closed is empty');
select is((select count(*)::int from public.needs_review where id::text like 'e9000000-%'), 0,
  'A user without a role: needs_review is empty');

reset role;

-- ---------------------------------------------------------------------------
-- 62-66: an inactive Consultant (with values access switched on) sees nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000013", "role": "authenticated"}';

select is((select count(*)::int from public.pipeline where id::text like 'e9000000-%'), 0,
  'An inactive Consultant: pipeline is empty');
select is((select count(*)::int from public.delivery where id::text like 'e9000000-%'), 0,
  'An inactive Consultant: delivery is empty, not even the engagement they own');
select is((select count(*)::int from public.active_clients where id::text like 'e9000000-%'), 0,
  'An inactive Consultant: active_clients is empty');
select is((select count(*)::int from public.closed where id::text like 'e9000000-%'), 0,
  'An inactive Consultant: closed is empty');
select is((select count(*)::int from public.needs_review where id::text like 'e9000000-%'), 0,
  'An inactive Consultant: needs_review is empty');

reset role;

-- ---------------------------------------------------------------------------
-- 67: archived rows still appear (DECISIONS 06-Oct-2026: kept in the views, screens filter
-- them; revisit after the demo). Change this test if that decision changes.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '';
update public.engagements set archived_at = now() where id = 'e9000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "b9000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select archived_at is not null from public.pipeline where id = 'e9000000-0000-4000-8000-000000000002'),
  true,
  'An archived engagement still appears in its view, with archived_at set for the screen to filter'
);

reset role;
set local request.jwt.claims to '';

select * from finish();
rollback;
