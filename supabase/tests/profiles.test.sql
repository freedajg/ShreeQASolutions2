-- pgTAP tests for supabase/migrations/20261003161427_profiles_roles.sql (Phase 1, step 5).
-- Everything here runs in one transaction that is rolled back at the end: the test users,
-- the pgTAP extension and every change disappear, so nothing test-related reaches the
-- database. Test users are fake (@example.test).
--
-- "Acting as" a user = switch to the API's database role and set the login claims the API
-- would set for that user's session.

begin;
create extension if not exists pgtap with schema extensions;

select plan(38);

-- ---------------------------------------------------------------------------
-- Test users (created as the server, so the new-login trigger makes their profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'owner1@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "Test Owner 1"}'),
  ('a0000000-0000-4000-8000-000000000002', 'owner2@example.test', 'authenticated', 'authenticated',
   '{"role": "owner"}', '{"full_name": "Test Owner 2"}'),
  ('a0000000-0000-4000-8000-000000000011', 'consultant1@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Test Consultant 1"}'),
  ('a0000000-0000-4000-8000-000000000012', 'consultant2@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Test Consultant 2"}'),
  ('a0000000-0000-4000-8000-000000000013', 'consultant-inactive@example.test', 'authenticated', 'authenticated',
   '{"role": "consultant"}', '{"full_name": "Test Consultant Inactive"}'),
  ('a0000000-0000-4000-8000-000000000021', 'marketing1@example.test', 'authenticated', 'authenticated',
   '{"role": "marketing"}', '{"full_name": "Test Marketing 1"}'),
  -- Claims "owner" only in the user-editable metadata: must get no role.
  ('a0000000-0000-4000-8000-000000000031', 'norole@example.test', 'authenticated', 'authenticated',
   '{}', '{"full_name": "Test No Role", "role": "owner"}');

-- 1-2: the new-login trigger
select is(
  (select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'owner'::public.app_role,
  'A login with app_metadata role "owner" gets the Owner role'
);
select ok(
  (select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000031') is null,
  'A login whose user-editable metadata claims "owner" gets no role'
);

-- Set-up as the server: Consultant 2 may see values; Owner 2 and the inactive Consultant
-- are deactivated; any other Owner already in the database is deactivated too (only inside
-- this rolled-back transaction), so Owner 1 is the only active Owner.
update public.profiles set can_see_values = true where id = 'a0000000-0000-4000-8000-000000000012';
update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000013';
update public.profiles set active = false
  where role = 'owner' and active and id <> 'a0000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- 3-4: not logged in
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select 1 from public.profiles', '42501', null::text,
  'anon cannot read profiles');
select throws_ok('select 1 from public.team_members', '42501', null::text,
  'anon cannot read the team list');

reset role;

-- ---------------------------------------------------------------------------
-- 5-18: Consultant 1
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000011", "role": "authenticated", "aal": "aal2"}';

select is(
  (select can_see_values from public.profiles where id = 'a0000000-0000-4000-8000-000000000011'),
  false,
  'A Consultant reads their own full profile, including can_see_values'
);
-- Added test (a)
select is(
  (select count(*)::int from public.profiles where id = 'a0000000-0000-4000-8000-000000000012'),
  0,
  'A Consultant cannot read a colleague''s full profile row, so not their can_see_values'
);
select columns_are(
  'public', 'team_members',
  array['id', 'full_name', 'email', 'role', 'booking_link', 'active'],
  'The team list has only the six safe columns (no can_see_values, mailbox_connected or theme_preference)'
);
select is(
  (select count(*)::int from public.team_members where email like '%@example.test'),
  7,
  'A Consultant sees every colleague in the team list'
);
select lives_ok(
  $$update public.profiles set full_name = 'Renamed Consultant 1'
    where id = 'a0000000-0000-4000-8000-000000000011'$$,
  'A user can change their own name'
);
select is(
  (select full_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000011'),
  'Renamed Consultant 1',
  'The new name is saved'
);
-- Added: booking link must be https://
select throws_ok(
  $$update public.profiles set booking_link = 'javascript:alert(1)'
    where id = 'a0000000-0000-4000-8000-000000000011'$$,
  '23514', null::text,
  'A user cannot save a booking link starting with javascript:'
);
select lives_ok(
  $$update public.profiles set booking_link = 'https://example.test/book-consultant-1'
    where id = 'a0000000-0000-4000-8000-000000000011'$$,
  'A user can save a booking link starting with https://'
);
select throws_ok(
  $$update public.profiles set role = 'owner' where id = 'a0000000-0000-4000-8000-000000000011'$$,
  '42501', null::text,
  'A user cannot change their own role'
);
select throws_ok(
  $$update public.profiles set can_see_values = true where id = 'a0000000-0000-4000-8000-000000000011'$$,
  '42501', null::text,
  'A user cannot switch on their own can_see_values'
);
select throws_ok(
  $$update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000011'$$,
  '42501', null::text,
  'A user cannot change their own active status'
);
select throws_ok(
  $$update public.profiles set email = 'changed@example.test' where id = 'a0000000-0000-4000-8000-000000000011'$$,
  '42501', null::text,
  'Email cannot be changed through the API'
);
select throws_ok(
  $$delete from public.profiles where id = 'a0000000-0000-4000-8000-000000000011'$$,
  '42501', null::text,
  'Nobody can delete a profile through the API'
);
select throws_ok(
  $$insert into public.profiles (id, email) values ('a0000000-0000-4000-8000-000000000099', 'new@example.test')$$,
  '42501', null::text,
  'Nobody can create a profile through the API'
);

-- Tries to rename a colleague. Row-level security hides the row, so nothing changes
-- (checked as test 34).
update public.profiles set full_name = 'Renamed by a colleague'
  where id = 'a0000000-0000-4000-8000-000000000012';

reset role;

-- ---------------------------------------------------------------------------
-- 19-20: Marketing
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000021", "role": "authenticated", "aal": "aal2"}';

select is(
  (select count(*)::int from public.team_members where email like '%@example.test'),
  7,
  'Marketing sees the team list'
);
select is(
  (select count(*)::int from public.profiles where email like '%@example.test'),
  1,
  'Marketing reads only its own full profile row'
);

reset role;

-- ---------------------------------------------------------------------------
-- 21-22: a user without a role
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000031", "role": "authenticated", "aal": "aal2"}';

select is(
  (select count(*)::int from public.profiles where email like '%@example.test'),
  1,
  'A user without a role sees only their own profile'
);
select is(
  (select count(*)::int from public.team_members where email like '%@example.test'),
  0,
  'A user without a role sees no team list'
);

reset role;

-- ---------------------------------------------------------------------------
-- 23-25: an inactive Consultant (added test c)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000013", "role": "authenticated", "aal": "aal2"}';

select is(
  (select count(*)::int from public.profiles where email like '%@example.test'),
  0,
  'An inactive Consultant reads no profiles, not even their own'
);
select is(
  (select count(*)::int from public.team_members where email like '%@example.test'),
  0,
  'An inactive Consultant sees no team list'
);
select ok(
  app.current_app_role() is null and not app.can_see_values(),
  'An inactive Consultant has no role and no values access'
);

reset role;

-- ---------------------------------------------------------------------------
-- 26: an inactive Owner
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2"}';

select ok(not app.is_owner(), 'An inactive Owner is not treated as an Owner');

-- Tries to change Consultant 1's role: the row is hidden, so nothing changes (test 35).
update public.profiles set role = 'marketing' where id = 'a0000000-0000-4000-8000-000000000011';

reset role;

-- ---------------------------------------------------------------------------
-- 27-33: the active Owner (the only one)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';

select is(
  (select count(*)::int from public.profiles where email like '%@example.test'),
  7,
  'An active Owner reads all profiles'
);
select lives_ok(
  $$update public.profiles set can_see_values = true where id = 'a0000000-0000-4000-8000-000000000011'$$,
  'An Owner can switch on can_see_values for a Consultant'
);
select is(
  (select can_see_values from public.profiles where id = 'a0000000-0000-4000-8000-000000000011'),
  true,
  'The values switch is saved'
);
select lives_ok(
  $$update public.profiles set role = 'consultant' where id = 'a0000000-0000-4000-8000-000000000031'$$,
  'An Owner can assign a role to a new user'
);
select is(
  (select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000031'),
  'consultant'::public.app_role,
  'The assigned role is saved'
);
-- Added test (b)
select throws_ok(
  $$update public.profiles set role = 'consultant' where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'The last active Owner cannot remove their own Owner role'
);
select throws_ok(
  $$update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'The last active Owner cannot deactivate themselves'
);

reset role;

-- ---------------------------------------------------------------------------
-- 34-36: checked as the server
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '';

select is(
  (select full_name from public.profiles where id = 'a0000000-0000-4000-8000-000000000012'),
  'Test Consultant 2',
  'A Consultant could not rename a colleague'
);
select is(
  (select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000011'),
  'consultant'::public.app_role,
  'An inactive Owner could not change anyone''s role'
);
select throws_ok(
  $$update public.profiles set active = false where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501', null::text,
  'Not even the server can deactivate the last active Owner'
);

-- ---------------------------------------------------------------------------
-- 37-38: with a second active Owner, an Owner may step down (the guard isn't too strict)
-- ---------------------------------------------------------------------------
update public.profiles set active = true where id = 'a0000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2"}';

select lives_ok(
  $$update public.profiles set role = 'consultant' where id = 'a0000000-0000-4000-8000-000000000001'$$,
  'With another active Owner, an Owner can step down'
);

reset role;
set local request.jwt.claims to '';

select is(
  (select role from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'consultant'::public.app_role,
  'The step-down is saved'
);

select * from finish();
rollback;
