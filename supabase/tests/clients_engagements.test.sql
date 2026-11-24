-- pgTAP tests for supabase/migrations/20261004151000_clients_engagements.sql (Phase 1, step 7).
-- Everything runs in one transaction that is rolled back at the end, so the test users and
-- every row disappear. Test users and clients are fake (@example.test).
--
-- Step 7 builds the tables only. These tests prove the shape (every Excel column has one
-- home, every dropdown points at its lookup) and that anon can't reach the tables. The
-- per-role reading and editing rules, and their tests, are in step 8
-- (clients_engagements_rls.test.sql); the step 7 "no role can read yet" checks were removed
-- then (06-Oct-2026).

begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- ---------------------------------------------------------------------------
-- Test users (created as the server; the step 5 trigger makes their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('c0000000-0000-4000-8000-000000000001', 'clients-owner@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "Clients Test Owner"}'),
  ('c0000000-0000-4000-8000-000000000011', 'clients-consultant@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Clients Test Consultant"}'),
  ('c0000000-0000-4000-8000-000000000021', 'clients-marketing@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "Clients Test Marketing"}'),
  ('c0000000-0000-4000-8000-000000000031', 'clients-norole@example.test', 'authenticated', 'authenticated',
   '{}', '{"full_name": "Clients Test No Role"}');

-- ---------------------------------------------------------------------------
-- 1-3: row-level security is on
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.clients'::regclass),
  'Row-level security is on for clients');
select ok((select relrowsecurity from pg_class where oid = 'public.engagements'::regclass),
  'Row-level security is on for engagements');
select ok((select relrowsecurity from pg_class where oid = 'public.engagement_financials'::regclass),
  'Row-level security is on for engagement_financials');

-- ---------------------------------------------------------------------------
-- 4-6: exact columns (each Excel column has exactly one home; PRD §6.2)
-- ---------------------------------------------------------------------------
select columns_are('public', 'clients', array[
  'id', 'client_code', 'name', 'industry', 'address', 'city', 'state_country', 'contact_person',
  'designation', 'email', 'phone', 'website', 'priority', 'do_not_contact',
  'created_by', 'archived_at', 'created_at', 'updated_at'
], 'clients has Excel A-K, AC plus do-not-contact, created by, archived and timestamps');
select columns_are('public', 'engagements', array[
  'id', 'client_id', 'certification_type', 'standard_framework', 'scope', 'status',
  'initial_engagement_date', 'completion_date', 'certificate_number', 'valid_from', 'valid_to',
  'certification_body', 'surveillance_due_date', 'last_audit_date', 'next_audit_date', 'owner_id',
  'lead_source', 'remarks', 'last_contacted_on', 'next_follow_up_on', 'date_is_estimated',
  'created_by', 'archived_at', 'created_at', 'updated_at',
  'closed_reason', 'follow_up_count', 'replied_at'
], 'engagements has Excel L-X, AA, AB, AD plus follow-up, estimate, closed reason, replied, created by, archived and timestamps');
select columns_are('public', 'engagement_financials', array[
  'engagement_id', 'contract_value', 'payment_status', 'created_at', 'updated_at'
], 'engagement_financials has Excel Y and Z only');

-- ---------------------------------------------------------------------------
-- 7-9: primary keys
-- ---------------------------------------------------------------------------
select col_is_pk('public', 'clients', 'id', 'clients.id is the primary key');
select col_is_pk('public', 'engagements', 'id', 'engagements.id is the primary key');
select col_is_pk('public', 'engagement_financials', 'engagement_id',
  'engagement_financials has one row per engagement');

-- ---------------------------------------------------------------------------
-- 10-19: links to clients, profiles and the step 6 lookups
-- ---------------------------------------------------------------------------
select fk_ok('public', 'clients', 'priority', 'public', 'priorities', 'code',
  'clients.priority is a priority');
select fk_ok('public', 'clients', 'created_by', 'public', 'profiles', 'id',
  'clients.created_by is a team member');
select fk_ok('public', 'engagements', 'client_id', 'public', 'clients', 'id',
  'engagements.client_id is a client');
select fk_ok('public', 'engagements', 'certification_type', 'public', 'certification_types', 'code',
  'engagements.certification_type is a certification type');
select fk_ok('public', 'engagements', 'status', 'public', 'statuses', 'code',
  'engagements.status is a status');
select fk_ok('public', 'engagements', 'owner_id', 'public', 'profiles', 'id',
  'engagements.owner_id is a team member');
select fk_ok('public', 'engagements', 'lead_source', 'public', 'lead_sources', 'code',
  'engagements.lead_source is a lead source');
select fk_ok('public', 'engagements', 'created_by', 'public', 'profiles', 'id',
  'engagements.created_by is a team member');
select fk_ok('public', 'engagement_financials', 'engagement_id', 'public', 'engagements', 'id',
  'engagement_financials.engagement_id is an engagement');
select fk_ok('public', 'engagement_financials', 'payment_status', 'public', 'payment_statuses', 'code',
  'engagement_financials.payment_status is a payment status');

-- ---------------------------------------------------------------------------
-- 20-38: what the tables accept, checked as the server
-- ---------------------------------------------------------------------------
-- The login claims are set so auth.uid() returns the Owner, to check the created_by default.
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';

select lives_ok(
  $$insert into public.clients (id, client_code, name, email, priority) values
    ('d0000000-0000-4000-8000-000000000001', 'TST-C001', 'Test Client One',
     'contact@client-one.example.test', 'High')$$,
  'A client can be added'
);
select is(
  (select created_by from public.clients where id = 'd0000000-0000-4000-8000-000000000001'),
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'created_by defaults to the logged-in user'
);

set local request.jwt.claims to '';

select lives_ok(
  $$insert into public.engagements (id, client_id, certification_type, status, owner_id, lead_source,
      completion_date, valid_from, valid_to, updated_at) values
    ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'ISO 27001',
     'Certified', 'c0000000-0000-4000-8000-000000000011', 'Referral', '2025-03-12', '2025-03-12',
     '2028-03-11', '2000-01-01 00:00:00+00')$$,
  'An engagement can be added for the client'
);
select lives_ok(
  $$insert into public.engagements (client_id, certification_type, status, lead_source) values
    ('d0000000-0000-4000-8000-000000000001', 'CMMI', 'Lead', 'LinkedIn')$$,
  'Two engagements of the same client can have different lead sources'
);
select lives_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value, payment_status) values
    ('e0000000-0000-4000-8000-000000000001', 150000.00, 'Paid')$$,
  'Its contract value and payment status can be added'
);
select throws_ok(
  $$insert into public.engagements (client_id, status) values
    ('d0000000-0000-4000-8000-000000000001', 'Certifed')$$,
  '23503', null::text,
  'A misspelt status is refused'
);
select throws_ok(
  $$insert into public.engagements (client_id, certification_type) values
    ('d0000000-0000-4000-8000-000000000001', 'ISO 27002')$$,
  '23503', null::text,
  'An unknown certification type is refused'
);
select throws_ok(
  $$update public.engagement_financials set payment_status = 'Unpaid'
    where engagement_id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23503', null::text,
  'An unknown payment status is refused'
);
select throws_ok(
  $$insert into public.engagements (client_id, lead_source) values
    ('d0000000-0000-4000-8000-000000000001', 'Google')$$,
  '23503', null::text,
  'An unknown lead source is refused'
);
select throws_ok(
  $$update public.engagement_financials set contract_value = -1
    where engagement_id = 'e0000000-0000-4000-8000-000000000001'$$,
  '23514', null::text,
  'A negative contract value is refused'
);
select throws_ok(
  $$insert into public.clients (name) values ('   ')$$,
  '23514', null::text,
  'A client needs a name'
);
select throws_ok(
  $$insert into public.clients (name, email) values ('Test Client Three', 'not-an-email')$$,
  '23514', null::text,
  'A malformed email is refused'
);
select throws_ok(
  $$insert into public.engagements (status) values ('Lead')$$,
  '23502', null::text,
  'An engagement needs a client'
);
select throws_ok(
  $$insert into public.engagements (client_id, owner_id) values
    ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000099')$$,
  '23503', null::text,
  'The relationship owner must be a team member'
);
select throws_ok(
  $$insert into public.clients (client_code, name) values ('TST-C001', 'Test Client Four')$$,
  '23505', null::text,
  'Two clients cannot share a Client ID'
);
select throws_ok(
  $$insert into public.engagement_financials (engagement_id, contract_value) values
    ('e0000000-0000-4000-8000-000000000001', 1.00)$$,
  '23505', null::text,
  'An engagement has at most one financials row'
);
select throws_ok(
  $$delete from public.clients where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '23503', null::text,
  'A client with engagements cannot be deleted'
);
select lives_ok(
  $$insert into public.engagements (client_id) values ('d0000000-0000-4000-8000-000000000001')$$,
  'Every Excel field of an engagement may be empty (bad imported values are left empty and flagged)'
);

update public.engagements set scope = 'Test scope' where id = 'e0000000-0000-4000-8000-000000000001';
select ok(
  (select updated_at > '2000-01-01 00:00:00+00' from public.engagements
   where id = 'e0000000-0000-4000-8000-000000000001'),
  'updated_at changes when a row is edited'
);

-- ---------------------------------------------------------------------------
-- 39-41: anon can't reach the tables (per-role rules: step 8 tests)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select 1 from public.clients', '42501', null::text, 'anon cannot read clients');
select throws_ok('select 1 from public.engagements', '42501', null::text, 'anon cannot read engagements');
select throws_ok('select 1 from public.engagement_financials', '42501', null::text,
  'anon cannot read engagement_financials');

reset role;

select * from finish();
rollback;
