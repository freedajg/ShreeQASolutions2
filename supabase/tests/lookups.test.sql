-- pgTAP tests for supabase/migrations/20261003180745_lookups.sql (Phase 1, step 6).
-- Everything runs in one transaction that is rolled back at the end, so the test users and
-- every change disappear. Test users are fake (@example.test).
--
-- "Acting as" a user = switch to the API's database role and set the login claims the API
-- would set for that user's session.

begin;
create extension if not exists pgtap with schema extensions;

select plan(34);

-- ---------------------------------------------------------------------------
-- Test users (created as the server; the step 5 trigger makes their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('b0000000-0000-4000-8000-000000000001', 'lookups-owner@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "Lookups Test Owner"}'),
  ('b0000000-0000-4000-8000-000000000011', 'lookups-consultant@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Lookups Test Consultant"}'),
  ('b0000000-0000-4000-8000-000000000013', 'lookups-consultant-inactive@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Lookups Test Consultant Inactive"}'),
  ('b0000000-0000-4000-8000-000000000021', 'lookups-marketing@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "Lookups Test Marketing"}'),
  ('b0000000-0000-4000-8000-000000000031', 'lookups-norole@example.test', 'authenticated', 'authenticated',
   '{}', '{"full_name": "Lookups Test No Role"}');

update public.profiles set active = false where id = 'b0000000-0000-4000-8000-000000000013';

-- ---------------------------------------------------------------------------
-- 1-12: contents, checked as the server
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.certification_types), 16, 'There are 16 certification types');
select is((select count(*)::int from public.statuses), 10, 'There are 10 statuses');
select is((select count(*)::int from public.payment_statuses), 5, 'There are 5 payment statuses');
select is((select count(*)::int from public.priorities), 3, 'There are 3 priorities');
select is((select count(*)::int from public.lead_sources), 7, 'There are 7 lead sources');

select set_eq(
  'select code from public.certification_types',
  array['ISO 9001', 'ISO 20000-1', 'ISO 27001', 'ISO 22301', 'ISO 27701', 'ISO 42001', 'ISO 13485',
        'CMMI', 'CMMC', 'SOC 1', 'SOC 2', 'GDPR', 'DPDP', 'HIPAA', 'VAPT', 'Other'],
  'Certification types match the Excel list exactly'
);
select set_eq(
  'select code from public.statuses',
  array['Lead', 'Proposal', 'In Progress', 'Implemented', 'Audit Completed', 'Certified',
        'Renewal Due', 'Completed', 'On Hold', 'Closed'],
  'Statuses match the Excel list exactly'
);
select set_eq(
  'select code from public.payment_statuses',
  array['Not Invoiced', 'Partially Paid', 'Paid', 'Overdue', 'NA'],
  'Payment statuses match the Excel list exactly'
);
select set_eq(
  'select code from public.priorities',
  array['High', 'Medium', 'Low'],
  'Priorities match the Excel list exactly'
);
select set_eq(
  'select code from public.lead_sources',
  array['Referral', 'Website', 'LinkedIn', 'Existing Client', 'Partner', 'Event', 'Other'],
  'Lead sources match the Excel list exactly'
);

select set_eq(
  'select code, status_group::text from public.statuses',
  $$values
    ('Lead', 'pipeline'), ('Proposal', 'pipeline'),
    ('In Progress', 'delivery'), ('Implemented', 'delivery'), ('Audit Completed', 'delivery'),
    ('Certified', 'active'), ('Renewal Due', 'active'), ('Completed', 'active'),
    ('On Hold', 'paused'), ('Closed', 'ended')$$,
  'Each status is in its PRD §6.4 group'
);
select set_eq(
  'select code, surveillance_months, recert_months from public.certification_types',
  $$values
    ('ISO 9001', 12, 36), ('ISO 20000-1', 12, 36), ('ISO 27001', 12, 36), ('ISO 22301', 12, 36),
    ('ISO 27701', 12, 36), ('ISO 42001', 12, 36), ('ISO 13485', 12, 36),
    ('CMMI', null::integer, 36), ('CMMC', null::integer, 36),
    ('SOC 1', null::integer, 12), ('SOC 2', null::integer, 12), ('VAPT', null::integer, null::integer), -- no fixed cycle (20261124100600_vapt_no_cycle.sql)
    ('GDPR', null::integer, null::integer), ('DPDP', null::integer, null::integer),
    ('HIPAA', null::integer, null::integer), ('Other', null::integer, null::integer)$$,
  'Default renewal cycles match PRD FR-4'
);

-- ---------------------------------------------------------------------------
-- 13-17: not logged in
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select 1 from public.certification_types', '42501', null::text, 'anon cannot read certification types');
select throws_ok('select 1 from public.statuses', '42501', null::text, 'anon cannot read statuses');
select throws_ok('select 1 from public.payment_statuses', '42501', null::text, 'anon cannot read payment statuses');
select throws_ok('select 1 from public.priorities', '42501', null::text, 'anon cannot read priorities');
select throws_ok('select 1 from public.lead_sources', '42501', null::text, 'anon cannot read lead sources');

reset role;

-- ---------------------------------------------------------------------------
-- 18-19: Consultant
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';

select is(
  (select (select count(*) from public.certification_types) + (select count(*) from public.statuses)
        + (select count(*) from public.payment_statuses) + (select count(*) from public.priorities)
        + (select count(*) from public.lead_sources))::int,
  41,
  'A Consultant can read all five lists (16 + 10 + 5 + 3 + 7)'
);
select throws_ok(
  $$insert into public.lead_sources (code, sort_order) values ('Webinar', 8)$$,
  '42501', null::text,
  'A Consultant cannot add a value to a list'
);

-- Tries to change a cycle. Row-level security hides the row for updates, so nothing
-- changes (checked as test 32).
update public.certification_types set recert_months = 24 where code = 'CMMI';

reset role;

-- ---------------------------------------------------------------------------
-- 20-21: Marketing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';

select is(
  (select (select count(*) from public.certification_types) + (select count(*) from public.statuses)
        + (select count(*) from public.payment_statuses) + (select count(*) from public.priorities)
        + (select count(*) from public.lead_sources))::int,
  41,
  'Marketing can read all five lists'
);
select throws_ok(
  $$insert into public.priorities (code, sort_order) values ('Urgent', 4)$$,
  '42501', null::text,
  'Marketing cannot add a value to a list'
);

reset role;

-- ---------------------------------------------------------------------------
-- 22: a user without a role; 23: an inactive Consultant
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000031", "role": "authenticated", "aal": "aal2"}';

select is(
  (select (select count(*) from public.certification_types) + (select count(*) from public.statuses)
        + (select count(*) from public.payment_statuses) + (select count(*) from public.priorities)
        + (select count(*) from public.lead_sources))::int,
  0,
  'A user without a role reads none of the lists'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000013", "role": "authenticated", "aal": "aal2"}';

select is(
  (select (select count(*) from public.certification_types) + (select count(*) from public.statuses)
        + (select count(*) from public.payment_statuses) + (select count(*) from public.priorities)
        + (select count(*) from public.lead_sources))::int,
  0,
  'An inactive Consultant reads none of the lists'
);

reset role;

-- ---------------------------------------------------------------------------
-- 24-31: Owner
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';

select lives_ok(
  $$insert into public.lead_sources (code, sort_order) values ('Webinar', 8)$$,
  'An Owner can add a lead source'
);
select lives_ok(
  $$update public.certification_types set surveillance_months = 6 where code = 'ISO 9001'$$,
  'An Owner can change a default cycle'
);
select lives_ok(
  $$update public.payment_statuses set active = false where code = 'NA'$$,
  'An Owner can retire a value (active = false)'
);
select throws_ok(
  $$update public.lead_sources set code = 'Web site' where code = 'Website'$$,
  '42501', null::text,
  'Not even an Owner can rename a code (engagements point at it)'
);
select throws_ok(
  $$update public.statuses set status_group = 'pipeline' where code = 'In Progress'$$,
  '42501', null::text,
  'Not even an Owner can change a status or its group'
);
select throws_ok(
  $$insert into public.statuses (code, status_group) values ('Won', 'active')$$,
  '42501', null::text,
  'Not even an Owner can add a status'
);
select throws_ok(
  $$delete from public.lead_sources where code = 'Event'$$,
  '42501', null::text,
  'Not even an Owner can delete a value'
);
select throws_ok(
  $$update public.certification_types set recert_months = 0 where code = 'CMMI'$$,
  '23514', null::text,
  'A cycle must be between 1 and 120 months'
);

reset role;

-- ---------------------------------------------------------------------------
-- 32-34: checked as the server
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '';

select is(
  (select recert_months from public.certification_types where code = 'CMMI'),
  36,
  'A Consultant could not change a cycle'
);
select ok(
  exists (select 1 from public.lead_sources where code = 'Webinar' and active)
  and (select surveillance_months from public.certification_types where code = 'ISO 9001') = 6
  and not (select active from public.payment_statuses where code = 'NA'),
  'The Owner''s changes are saved (new lead source, changed cycle, retired value)'
);
select is(
  (select status_group::text from public.statuses where code = 'In Progress'),
  'delivery',
  'Statuses are unchanged ("In Progress" is still delivery)'
);

select * from finish();
rollback;
