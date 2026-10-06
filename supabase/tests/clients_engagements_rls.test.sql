-- pgTAP tests for supabase/migrations/20261006100000_clients_engagements_rls.sql (Phase 1, step 8).
-- Everything runs in one transaction that is rolled back at the end, so the test users and
-- every row disappear. Test users and clients are fake (@example.test, Client IDs TST-C1nn).
--
-- "Acting as" a user = switch to the API's database role and set the login claims the API
-- would set for that user's session. pg_temp.changed() runs an update as the current role
-- and returns how many rows it changed: row-level security hides a refused row (0 changed)
-- rather than raising an error. pg_temp.returned_id() runs an insert ... returning id as the
-- current role (as supabase-js .insert().select() does) and returns the id, or null if the
-- insert was refused or returned nothing.

begin;
create extension if not exists pgtap with schema extensions;

select plan(114);

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

create function pg_temp.returned_id(sql text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  execute sql into v_id;
  return v_id;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Test users (created as the server; the step 5 trigger makes their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('b8000000-0000-4000-8000-000000000001', 'rls-owner@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "RLS Test Owner"}'),
  ('b8000000-0000-4000-8000-000000000002', 'rls-owner-inactive@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "RLS Test Owner Inactive"}'),
  ('b8000000-0000-4000-8000-000000000011', 'rls-consultant@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "RLS Test Consultant"}'),
  ('b8000000-0000-4000-8000-000000000012', 'rls-consultant-values@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "RLS Test Consultant Values"}'),
  ('b8000000-0000-4000-8000-000000000013', 'rls-consultant-inactive@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "RLS Test Consultant Inactive"}'),
  ('b8000000-0000-4000-8000-000000000021', 'rls-marketing@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "RLS Test Marketing"}'),
  ('b8000000-0000-4000-8000-000000000022', 'rls-marketing2@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "RLS Test Marketing 2"}'),
  ('b8000000-0000-4000-8000-000000000031', 'rls-norole@example.test', 'authenticated', 'authenticated',
   '{}', '{"full_name": "RLS Test No Role"}');

-- As the server: Consultant Values may see values; the inactive Consultant may too, to prove
-- that being inactive wins. The inactive Owner and Consultant are deactivated.
update public.profiles set can_see_values = true
  where id in ('b8000000-0000-4000-8000-000000000012', 'b8000000-0000-4000-8000-000000000013');
update public.profiles set active = false
  where id in ('b8000000-0000-4000-8000-000000000002', 'b8000000-0000-4000-8000-000000000013');

-- ---------------------------------------------------------------------------
-- Test data, added as the server (no login, so created_by is kept as given)
--   K1 lead-only client (Marketing)       E1 Lead (Marketing, owner Consultant)
--                                         E2 On Hold (Marketing, no owner)
--   K2 delivery client (Owner)            E3 In Progress (owner Consultant)
--                                         E4 Certified (owner Consultant Values)
--                                         E7 Lead (Marketing, no owner)
--                                         E8 In Progress (owner inactive Consultant)
--   K3 mixed client (Owner)               E5 Proposal (Marketing 2, owner Consultant Values)
--                                         E6 Renewal Due (owner Consultant Values)
--   K4 new client, no engagements (Marketing)
--   K5 new client, no engagements (Consultant)
-- Financials on E1, E3, E4, E6.
-- ---------------------------------------------------------------------------
insert into public.clients (id, client_code, name, created_by) values
  ('d8000000-0000-4000-8000-000000000101', 'TST-C101', 'Test Lead Client', 'b8000000-0000-4000-8000-000000000021'),
  ('d8000000-0000-4000-8000-000000000102', 'TST-C102', 'Test Delivery Client', 'b8000000-0000-4000-8000-000000000001'),
  ('d8000000-0000-4000-8000-000000000103', 'TST-C103', 'Test Mixed Client', 'b8000000-0000-4000-8000-000000000001'),
  ('d8000000-0000-4000-8000-000000000104', 'TST-C104', 'Test New Client M', 'b8000000-0000-4000-8000-000000000021'),
  ('d8000000-0000-4000-8000-000000000105', 'TST-C105', 'Test New Client C', 'b8000000-0000-4000-8000-000000000011');

insert into public.engagements (id, client_id, status, created_by, owner_id) values
  ('e8000000-0000-4000-8000-000000000001', 'd8000000-0000-4000-8000-000000000101', 'Lead',
   'b8000000-0000-4000-8000-000000000021', 'b8000000-0000-4000-8000-000000000011'),
  ('e8000000-0000-4000-8000-000000000002', 'd8000000-0000-4000-8000-000000000101', 'On Hold',
   'b8000000-0000-4000-8000-000000000021', null),
  ('e8000000-0000-4000-8000-000000000003', 'd8000000-0000-4000-8000-000000000102', 'In Progress',
   'b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000011'),
  ('e8000000-0000-4000-8000-000000000004', 'd8000000-0000-4000-8000-000000000102', 'Certified',
   'b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000012'),
  ('e8000000-0000-4000-8000-000000000005', 'd8000000-0000-4000-8000-000000000103', 'Proposal',
   'b8000000-0000-4000-8000-000000000022', 'b8000000-0000-4000-8000-000000000012'),
  ('e8000000-0000-4000-8000-000000000006', 'd8000000-0000-4000-8000-000000000103', 'Renewal Due',
   'b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000012'),
  ('e8000000-0000-4000-8000-000000000007', 'd8000000-0000-4000-8000-000000000102', 'Lead',
   'b8000000-0000-4000-8000-000000000021', null),
  ('e8000000-0000-4000-8000-000000000008', 'd8000000-0000-4000-8000-000000000102', 'In Progress',
   'b8000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000013');

insert into public.engagement_financials (engagement_id, contract_value, payment_status) values
  ('e8000000-0000-4000-8000-000000000001', 50000.00, 'Not Invoiced'),
  ('e8000000-0000-4000-8000-000000000003', 150000.00, 'Partially Paid'),
  ('e8000000-0000-4000-8000-000000000004', 200000.00, 'Paid'),
  ('e8000000-0000-4000-8000-000000000006', 75000.00, 'Paid');

-- ---------------------------------------------------------------------------
-- 1-9: the policies and grants that exist (no delete grant, nothing for anon)
-- ---------------------------------------------------------------------------
select policies_are('public', 'clients', array[
  'clients: owners and consultants read all',
  'clients: marketing reads lead clients',
  'clients: role-holders add',
  'clients: owners change all',
  'clients: consultants change clients of their engagements',
  'clients: marketing changes its lead-only clients'
], 'clients has exactly the step 8 policies');
select policies_are('public', 'engagements', array[
  'engagements: owners and consultants read all',
  'engagements: marketing reads leads',
  'engagements: owners add',
  'engagements: consultants add',
  'engagements: marketing adds leads',
  'engagements: owners change all',
  'engagements: consultants change their own',
  'engagements: marketing changes its own leads'
], 'engagements has exactly the step 8 policies');
select policies_are('public', 'engagement_financials', array[
  'engagement_financials: values-access read',
  'engagement_financials: owners add',
  'engagement_financials: consultants add for own',
  'engagement_financials: owners change all',
  'engagement_financials: consultants change own'
], 'engagement_financials has exactly the step 8 policies');

select table_privs_are('public', 'clients', 'anon', array[]::text[], 'anon has no access to clients');
select table_privs_are('public', 'engagements', 'anon', array[]::text[], 'anon has no access to engagements');
select table_privs_are('public', 'engagement_financials', 'anon', array[]::text[],
  'anon has no access to engagement_financials');

-- Insert and update are granted per column, so the only table-wide right is select:
-- no delete, truncate, references or triggers.
select table_privs_are('public', 'clients', 'authenticated', array['SELECT'],
  'Logged-in users cannot delete clients');
select table_privs_are('public', 'engagements', 'authenticated', array['SELECT'],
  'Logged-in users cannot delete engagements');
select table_privs_are('public', 'engagement_financials', 'authenticated', array['SELECT'],
  'Logged-in users cannot delete engagement_financials');

-- ---------------------------------------------------------------------------
-- 10-13: anon (not logged in) gets nothing
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select 1 from public.clients', '42501', null::text, 'anon cannot read clients');
select throws_ok('select 1 from public.engagements', '42501', null::text, 'anon cannot read engagements');
select throws_ok('select 1 from public.engagement_financials', '42501', null::text,
  'anon cannot read engagement_financials');
select throws_ok($$insert into public.clients (name) values ('Test Anon Client')$$, '42501', null::text,
  'anon cannot add a client');

reset role;

-- ---------------------------------------------------------------------------
-- 14-35: reading, per role (before any test changes the data)
-- ---------------------------------------------------------------------------

-- 14-16: Owner reads everything
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is((select count(*)::int from public.clients where client_code like 'TST-C1%'), 5,
  'An Owner reads every client');
select is((select count(*)::int from public.engagements where id::text like 'e8000000-%'), 8,
  'An Owner reads every engagement');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 4,
  'An Owner reads every contract value and payment status');

reset role;

-- 17-19: Consultant (default) reads all clients and engagements, no financials
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000011", "role": "authenticated"}';

select is((select count(*)::int from public.clients where client_code like 'TST-C1%'), 5,
  'A Consultant reads every client');
select is((select count(*)::int from public.engagements where id::text like 'e8000000-%'), 8,
  'A Consultant reads every engagement');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 0,
  'A Consultant without values access reads no contract value, not even on their own engagements');

reset role;

-- 20-22: Consultant with values access
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000012", "role": "authenticated"}';

select is((select count(*)::int from public.clients where client_code like 'TST-C1%'), 5,
  'A Consultant with values access reads every client');
select is((select count(*)::int from public.engagements where id::text like 'e8000000-%'), 8,
  'A Consultant with values access reads every engagement');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 4,
  'A Consultant with values access reads every contract value and payment status');

reset role;

-- 23-26: Marketing reads leads only (On Hold included) and the clients behind them
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000021", "role": "authenticated"}';

select set_eq(
  $$select id from public.engagements where id::text like 'e8000000-%'$$,
  array['e8000000-0000-4000-8000-000000000001', 'e8000000-0000-4000-8000-000000000002',
        'e8000000-0000-4000-8000-000000000005', 'e8000000-0000-4000-8000-000000000007']::uuid[],
  'Marketing reads only Lead, Proposal and On Hold engagements, whoever created them'
);
select is(
  (select status from public.engagements where id = 'e8000000-0000-4000-8000-000000000002'),
  'On Hold',
  'Marketing reads an On Hold lead (paused group counts as a lead)'
);
select set_eq(
  $$select id from public.clients where client_code like 'TST-C1%'$$,
  array['d8000000-0000-4000-8000-000000000101', 'd8000000-0000-4000-8000-000000000102',
        'd8000000-0000-4000-8000-000000000103', 'd8000000-0000-4000-8000-000000000104']::uuid[],
  'Marketing reads clients with a lead, and its own new client; not a colleague''s new client'
);
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 0,
  'Marketing reads no contract value or payment status, not even on its own leads');

reset role;

-- 27-29: a user without a role reads nothing
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000031", "role": "authenticated"}';

select is((select count(*)::int from public.clients where client_code like 'TST-C1%'), 0,
  'A user without a role reads no client');
select is((select count(*)::int from public.engagements where id::text like 'e8000000-%'), 0,
  'A user without a role reads no engagement');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 0,
  'A user without a role reads no contract value');

reset role;

-- 30-32: an inactive Consultant (with values access switched on) reads nothing
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000013", "role": "authenticated"}';

select is((select count(*)::int from public.clients where client_code like 'TST-C1%'), 0,
  'An inactive Consultant reads no client');
select is((select count(*)::int from public.engagements where id::text like 'e8000000-%'), 0,
  'An inactive Consultant reads no engagement, not even one they own');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 0,
  'An inactive Consultant with values access reads no contract value');

reset role;

-- 33-35: an inactive Owner reads nothing
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is((select count(*)::int from public.clients where client_code like 'TST-C1%'), 0,
  'An inactive Owner reads no client');
select is((select count(*)::int from public.engagements where id::text like 'e8000000-%'), 0,
  'An inactive Owner reads no engagement');
select is((select count(*)::int from public.engagement_financials where engagement_id::text like 'e8000000-%'), 0,
  'An inactive Owner reads no contract value');

reset role;

-- ---------------------------------------------------------------------------
-- 36-46: Owner changes everything; nobody deletes
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$insert into public.clients (client_code, name) values ('TST-C106', 'Test Owner Client')$$,
  'An Owner adds a client'
);
select is(
  (select created_by from public.clients where client_code = 'TST-C106'),
  'b8000000-0000-4000-8000-000000000001'::uuid,
  'The Owner''s new client records the Owner as its creator'
);
select lives_ok(
  $$insert into public.engagements (client_id, status, owner_id, scope) values
    ('d8000000-0000-4000-8000-000000000102', 'Implemented', 'b8000000-0000-4000-8000-000000000012',
     'Owner added')$$,
  'An Owner adds an engagement of any status, owned by anyone'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'Owner edit'
    where id = 'e8000000-0000-4000-8000-000000000004'$$),
  1,
  'An Owner edits an engagement owned by someone else'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000101'$$),
  1,
  'An Owner edits a client created by someone else'
);
select is(
  pg_temp.changed($$update public.engagements set
      owner_id = 'b8000000-0000-4000-8000-000000000011',
      client_id = (select id from public.clients where client_code = 'TST-C106'),
      created_by = 'b8000000-0000-4000-8000-000000000012'
    where scope = 'Owner added'$$),
  1,
  'An Owner changes an engagement''s owner, client and creator'
);
select lives_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value, payment_status) values
    ('e8000000-0000-4000-8000-000000000002', 10000.00, 'Not Invoiced')$$,
  'An Owner adds a contract value'
);
select is(
  pg_temp.changed($$update public.engagement_financials set contract_value = 210000.00
    where engagement_id = 'e8000000-0000-4000-8000-000000000004'$$),
  1,
  'An Owner edits a contract value'
);
select throws_ok(
  $$delete from public.clients where id = 'd8000000-0000-4000-8000-000000000105'$$,
  '42501', null::text,
  'An Owner cannot delete a client (archive instead)'
);
select throws_ok(
  $$delete from public.engagements where id = 'e8000000-0000-4000-8000-000000000004'$$,
  '42501', null::text,
  'An Owner cannot delete an engagement'
);
select throws_ok(
  $$delete from public.engagement_financials where engagement_id = 'e8000000-0000-4000-8000-000000000004'$$,
  '42501', null::text,
  'An Owner cannot delete a contract value'
);

reset role;

-- ---------------------------------------------------------------------------
-- 47-66: Consultant (default) edits only what they own
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000011", "role": "authenticated"}';

select lives_ok(
  $$insert into public.clients (client_code, name) values ('TST-C107', 'Test Consultant Client')$$,
  'A Consultant adds a client'
);
select is(
  (select created_by from public.clients where client_code = 'TST-C107'),
  'b8000000-0000-4000-8000-000000000011'::uuid,
  'The Consultant''s new client records the Consultant as its creator'
);
select isnt(
  pg_temp.returned_id($$insert into public.clients (client_code, name) values
    ('TST-C111', 'Test Consultant Returning Client') returning id$$),
  null::uuid,
  'A Consultant adds a client with insert ... returning and gets the new row back'
);
select throws_ok(
  $$insert into public.clients (name, created_by) values
    ('Test Claimed Client', 'b8000000-0000-4000-8000-000000000001')$$,
  '42501', null::text,
  'A Consultant cannot name someone else as a client''s creator'
);
select lives_ok(
  $$insert into public.engagements (client_id, status, owner_id, scope) values
    ('d8000000-0000-4000-8000-000000000102', 'Lead', 'b8000000-0000-4000-8000-000000000011', 'C1 added')$$,
  'A Consultant adds an engagement they own'
);
select throws_ok(
  $$insert into public.engagements (client_id, status, owner_id) values
    ('d8000000-0000-4000-8000-000000000102', 'Lead', 'b8000000-0000-4000-8000-000000000012')$$,
  '42501', null::text,
  'A Consultant cannot add an engagement owned by someone else'
);
select is(
  pg_temp.changed($$update public.engagements set status = 'Implemented', scope = 'C1 edit'
    where id = 'e8000000-0000-4000-8000-000000000003'$$),
  1,
  'A Consultant edits an engagement they own, including its status'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'C1 edit'
    where id = 'e8000000-0000-4000-8000-000000000004'$$),
  0,
  'A Consultant cannot edit an engagement someone else owns'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'C1 edit'
    where id = 'e8000000-0000-4000-8000-000000000002'$$),
  0,
  'A Consultant cannot edit an engagement nobody owns'
);
select throws_ok(
  $$update public.engagements set owner_id = 'b8000000-0000-4000-8000-000000000012'
    where id = 'e8000000-0000-4000-8000-000000000003'$$,
  '42501', null::text,
  'A Consultant cannot hand their engagement to someone else'
);
select throws_ok(
  $$update public.engagements set client_id = 'd8000000-0000-4000-8000-000000000101'
    where id = 'e8000000-0000-4000-8000-000000000003'$$,
  '42501', null::text,
  'A Consultant cannot move their engagement to another client'
);
select throws_ok(
  $$update public.engagements set created_by = 'b8000000-0000-4000-8000-000000000011'
    where id = 'e8000000-0000-4000-8000-000000000003'$$,
  '42501', null::text,
  'A Consultant cannot change who created their engagement'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000102'$$),
  1,
  'A Consultant edits the client of an engagement they own'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000105'$$),
  1,
  'A Consultant edits a client they added that has no engagements yet'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000103'$$),
  0,
  'A Consultant cannot edit a client where they own no engagement'
);
select throws_ok(
  $$update public.clients set created_by = 'b8000000-0000-4000-8000-000000000011'
    where id = 'd8000000-0000-4000-8000-000000000102'$$,
  '42501', null::text,
  'A Consultant cannot change who created a client'
);
select throws_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value) values
    ((select id from public.engagements where scope = 'C1 added'), 1000.00)$$,
  '42501', null::text,
  'A Consultant without values access cannot add a contract value, even on their own engagement'
);
select is(
  pg_temp.changed($$update public.engagement_financials set contract_value = 1.00
    where engagement_id = 'e8000000-0000-4000-8000-000000000003'$$),
  0,
  'A Consultant without values access cannot change a contract value, even on their own engagement'
);
select throws_ok(
  $$delete from public.engagements where id = 'e8000000-0000-4000-8000-000000000003'$$,
  '42501', null::text,
  'A Consultant cannot delete their own engagement'
);
select throws_ok(
  $$delete from public.clients where id = 'd8000000-0000-4000-8000-000000000105'$$,
  '42501', null::text,
  'A Consultant cannot delete their own client'
);

reset role;

-- ---------------------------------------------------------------------------
-- 67-73: Consultant with values access: financials of their own engagements only
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000012", "role": "authenticated"}';

select lives_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value, payment_status) values
    ('e8000000-0000-4000-8000-000000000005', 90000.00, 'Not Invoiced')$$,
  'A Consultant with values access adds a contract value on an engagement they own'
);
select is(
  pg_temp.changed($$update public.engagement_financials set payment_status = 'Overdue'
    where engagement_id = 'e8000000-0000-4000-8000-000000000004'$$),
  1,
  'A Consultant with values access edits the contract value of an engagement they own'
);
select is(
  pg_temp.changed($$update public.engagement_financials set contract_value = 1.00
    where engagement_id = 'e8000000-0000-4000-8000-000000000003'$$),
  0,
  'A Consultant with values access cannot edit the contract value of someone else''s engagement'
);
select throws_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value) values
    ((select id from public.engagements where scope = 'C1 added'), 1000.00)$$,
  '42501', null::text,
  'A Consultant with values access cannot add a contract value on someone else''s engagement'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'C2 edit'
    where id = 'e8000000-0000-4000-8000-000000000006'$$),
  1,
  'A Consultant with values access edits an engagement they own'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'C2 edit'
    where id = 'e8000000-0000-4000-8000-000000000003'$$),
  0,
  'A Consultant with values access cannot edit an engagement someone else owns'
);
select throws_ok(
  $$delete from public.engagement_financials where engagement_id = 'e8000000-0000-4000-8000-000000000004'$$,
  '42501', null::text,
  'A Consultant with values access cannot delete a contract value'
);

reset role;

-- ---------------------------------------------------------------------------
-- 74-101: Marketing adds and edits only its own leads, and they must stay leads
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000021", "role": "authenticated"}';

select lives_ok(
  $$insert into public.clients (client_code, name) values ('TST-C108', 'Test Marketing Client')$$,
  'Marketing adds a client'
);
select is(
  (select created_by from public.clients where client_code = 'TST-C108'),
  'b8000000-0000-4000-8000-000000000021'::uuid,
  'Marketing reads its new client straight away, and it records Marketing as the creator'
);
select isnt(
  pg_temp.returned_id($$insert into public.clients (client_code, name) values
    ('TST-C110', 'Test Marketing Returning Client') returning id$$),
  null::uuid,
  'Marketing adds a client with insert ... returning and gets the new row back'
);
select isnt(
  pg_temp.returned_id($$insert into public.engagements (client_id, status, scope) values
    ((select id from public.clients where client_code = 'TST-C110'), 'Lead', 'M1 returning')
    returning id$$),
  null::uuid,
  'Marketing adds a lead for its new client with insert ... returning and gets the new row back'
);
select throws_ok(
  $$insert into public.clients (name, created_by) values
    ('Test Claimed Client', 'b8000000-0000-4000-8000-000000000022')$$,
  '42501', null::text,
  'Marketing cannot name someone else as a client''s creator'
);
select lives_ok(
  $$insert into public.engagements (client_id, status, scope) values
    ((select id from public.clients where client_code = 'TST-C108'), 'Lead', 'M1 added')$$,
  'Marketing adds a lead for its new client'
);
select lives_ok(
  $$insert into public.engagements (client_id, status, scope) values
    ('d8000000-0000-4000-8000-000000000101', 'On Hold', 'M1 on hold')$$,
  'Marketing adds an On Hold lead for a lead client'
);
select throws_ok(
  $$insert into public.engagements (client_id, status) values
    ('d8000000-0000-4000-8000-000000000101', 'In Progress')$$,
  '42501', null::text,
  'Marketing cannot add an engagement that is not a lead'
);
select throws_ok(
  $$insert into public.engagements (client_id, scope) values
    ('d8000000-0000-4000-8000-000000000101', 'No status')$$,
  '42501', null::text,
  'Marketing cannot add an engagement with no status'
);
select throws_ok(
  $$insert into public.engagements (client_id, status) values
    ('d8000000-0000-4000-8000-000000000105', 'Lead')$$,
  '42501', null::text,
  'Marketing cannot add a lead for a client it cannot read'
);
select throws_ok(
  $$insert into public.engagements (client_id, status, owner_id) values
    ('d8000000-0000-4000-8000-000000000101', 'Lead', 'b8000000-0000-4000-8000-000000000011')$$,
  '42501', null::text,
  'Marketing cannot choose an owner when adding a lead'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'M1 edit'
    where id = 'e8000000-0000-4000-8000-000000000001'$$),
  1,
  'Marketing edits a lead it created'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'M1 edit'
    where id = 'e8000000-0000-4000-8000-000000000002'$$),
  1,
  'Marketing edits an On Hold lead it created'
);
select is(
  pg_temp.changed($$update public.engagements set status = 'Proposal'
    where id = 'e8000000-0000-4000-8000-000000000007'$$),
  1,
  'Marketing moves its lead from Lead to Proposal'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'M1 edit'
    where id = 'e8000000-0000-4000-8000-000000000005'$$),
  0,
  'Marketing cannot edit a lead another user created'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'M1 edit'
    where id = 'e8000000-0000-4000-8000-000000000003'$$),
  0,
  'Marketing cannot edit a delivery engagement'
);
select throws_ok(
  $$update public.engagements set status = 'In Progress'
    where id = 'e8000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'Marketing cannot move its lead out of the pipeline'
);
select throws_ok(
  $$update public.engagements set owner_id = 'b8000000-0000-4000-8000-000000000011'
    where id = 'e8000000-0000-4000-8000-000000000002'$$,
  '42501', null::text,
  'Marketing cannot give its lead an owner'
);
select throws_ok(
  $$update public.engagements set created_by = 'b8000000-0000-4000-8000-000000000022'
    where id = 'e8000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'Marketing cannot change who created its lead'
);
select throws_ok(
  $$update public.engagements set client_id = 'd8000000-0000-4000-8000-000000000104'
    where id = 'e8000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'Marketing cannot move its lead to another client'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000101'$$),
  1,
  'Marketing edits a client whose engagements are all leads, one of them its own'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000104'$$),
  1,
  'Marketing edits a client it added that has no engagements yet'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000103'$$),
  0,
  'Marketing cannot edit a client whose only lead another user created'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000102'$$),
  0,
  'Marketing cannot edit a client that has delivery or certified work, even with its own lead there'
);
select throws_ok(
  $$update public.clients set created_by = 'b8000000-0000-4000-8000-000000000022'
    where id = 'd8000000-0000-4000-8000-000000000101'$$,
  '42501', null::text,
  'Marketing cannot change who created a client'
);
select throws_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value) values
    ((select id from public.engagements where scope = 'M1 added'), 1000.00)$$,
  '42501', null::text,
  'Marketing cannot add a contract value, even on its own lead'
);
select is(
  pg_temp.changed($$update public.engagement_financials set contract_value = 1.00
    where engagement_id = 'e8000000-0000-4000-8000-000000000001'$$),
  0,
  'Marketing cannot change a contract value, even on its own lead'
);
select throws_ok(
  $$delete from public.engagements where id = 'e8000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'Marketing cannot delete its own lead'
);

reset role;

-- ---------------------------------------------------------------------------
-- 102-105: a user without a role changes nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000031", "role": "authenticated"}';

select throws_ok(
  $$insert into public.clients (name) values ('Test No Role Client')$$,
  '42501', null::text,
  'A user without a role cannot add a client'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000101'$$),
  0,
  'A user without a role cannot edit a client'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'No role edit'
    where id = 'e8000000-0000-4000-8000-000000000001'$$),
  0,
  'A user without a role cannot edit an engagement'
);
select throws_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value) values
    ('e8000000-0000-4000-8000-000000000007', 1000.00)$$,
  '42501', null::text,
  'A user without a role cannot add a contract value'
);

reset role;

-- ---------------------------------------------------------------------------
-- 106-108: an inactive Consultant (with values access) changes nothing, even what they own
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000013", "role": "authenticated"}';

select throws_ok(
  $$insert into public.clients (name) values ('Test Inactive Client')$$,
  '42501', null::text,
  'An inactive Consultant cannot add a client'
);
select is(
  pg_temp.changed($$update public.engagements set scope = 'Inactive edit'
    where id = 'e8000000-0000-4000-8000-000000000008'$$),
  0,
  'An inactive Consultant cannot edit an engagement they own'
);
select throws_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value) values
    ('e8000000-0000-4000-8000-000000000008', 1000.00)$$,
  '42501', null::text,
  'An inactive Consultant with values access cannot add a contract value on their own engagement'
);

reset role;

-- ---------------------------------------------------------------------------
-- 109-111: an inactive Owner changes nothing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$insert into public.clients (name) values ('Test Inactive Owner Client')$$,
  '42501', null::text,
  'An inactive Owner cannot add a client'
);
select is(
  pg_temp.changed($$update public.clients set city = 'Test City'
    where id = 'd8000000-0000-4000-8000-000000000102'$$),
  0,
  'An inactive Owner cannot edit a client'
);
select is(
  pg_temp.changed($$update public.engagement_financials set contract_value = 1.00
    where engagement_id = 'e8000000-0000-4000-8000-000000000004'$$),
  0,
  'An inactive Owner cannot change a contract value'
);

reset role;

-- ---------------------------------------------------------------------------
-- 112-114: the created_by trigger itself, checked as the server (no grants or row rules)
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '';

select is(
  (select created_by from public.engagements where id = 'e8000000-0000-4000-8000-000000000005'),
  'b8000000-0000-4000-8000-000000000022'::uuid,
  'Server work with no login (seed, import) keeps the created_by it gives'
);

set local request.jwt.claims to '{"sub": "b8000000-0000-4000-8000-000000000021", "role": "authenticated"}';

insert into public.clients (client_code, name, created_by) values
  ('TST-C109', 'Test Trigger Client', 'b8000000-0000-4000-8000-000000000001');
select is(
  (select created_by from public.clients where client_code = 'TST-C109'),
  'b8000000-0000-4000-8000-000000000021'::uuid,
  'With a login, a client''s created_by is replaced by the logged-in user'
);

insert into public.engagements (client_id, status, scope, created_by) values
  ((select id from public.clients where client_code = 'TST-C109'), 'Lead', 'Trigger test',
   'b8000000-0000-4000-8000-000000000001');
select is(
  (select created_by from public.engagements where scope = 'Trigger test'),
  'b8000000-0000-4000-8000-000000000021'::uuid,
  'With a login, an engagement''s created_by is replaced by the logged-in user'
);

set local request.jwt.claims to '';

select * from finish();
rollback;
