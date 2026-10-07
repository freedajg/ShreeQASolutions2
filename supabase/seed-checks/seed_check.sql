-- Post-load checks for the DUMMY seed (Phase 1, step 10). Run: bun run db:seed-check
-- Read-only: everything runs in a transaction that is rolled back at the end.
-- Deliberately outside supabase/tests/, so `bun run db:test` never depends on seed data.
-- Each block raises an exception on the first mismatch; success prints "SEED CHECK OK".
-- Expected values come from test-data/SQAS_Client_Database_DUMMY.xlsx and its Test Notes sheet
-- (see supabase/seed-report.md). Seed ids: users 5eed0001-…, clients 5eed0002-…,
-- engagements 5eed0003-… ending in the Excel row number.

begin;

-- ---------------------------------------------------------------------------
-- As the server: counts, users and the flagged rows
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  select count(*) into n from public.clients where id::text like '5eed0002-%';
  if n <> 21 then raise exception 'Expected 21 clients, found %', n; end if;

  select count(*) into n from public.engagements where id::text like '5eed0003-%';
  if n <> 23 then raise exception 'Expected 23 engagements, found %', n; end if;

  select count(*) into n from public.engagement_financials where engagement_id::text like '5eed0003-%';
  if n <> 23 then raise exception 'Expected 23 financials rows, found %', n; end if;

  -- Five demo profiles with the right roles; values access only on Demo Consultant 2.
  if exists (
    select 1
    from (values
      ('5eed0001-0000-4000-8000-000000000001'::uuid, 'owner'::public.app_role, false, 'demo.owner1@example.com'),
      ('5eed0001-0000-4000-8000-000000000002'::uuid, 'owner'::public.app_role, false, 'demo.owner2@example.com'),
      ('5eed0001-0000-4000-8000-000000000011'::uuid, 'consultant'::public.app_role, false, 'demo.consultant1@example.com'),
      ('5eed0001-0000-4000-8000-000000000012'::uuid, 'consultant'::public.app_role, true, 'demo.consultant2@example.com'),
      ('5eed0001-0000-4000-8000-000000000021'::uuid, 'marketing'::public.app_role, false, 'demo.marketing1@example.com')
    ) as v(id, role, can_see_values, email)
    left join public.profiles p on p.id = v.id
    where p.id is null or p.role is distinct from v.role or p.email <> v.email
      or p.can_see_values is distinct from v.can_see_values or not p.active
  ) then
    raise exception 'A demo profile is missing or has the wrong role, email or values access';
  end if;

  select count(*) into n from public.profiles where id::text like '5eed0001-%';
  if n <> 5 then raise exception 'Expected 5 demo profiles, found %', n; end if;

  -- Nothing seeded has a creator: the seed runs as the server.
  if exists (select 1 from public.clients where id::text like '5eed0002-%' and created_by is not null)
    or exists (select 1 from public.engagements where id::text like '5eed0003-%' and created_by is not null)
  then
    raise exception 'A seeded row has created_by set';
  end if;

  -- One client per Client ID; C001 and C002 have two engagements each.
  select count(*) into n from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C001';
  if n <> 2 then raise exception 'SQAS-C001: expected 2 engagements, found %', n; end if;
  select count(*) into n from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C002';
  if n <> 2 then raise exception 'SQAS-C002: expected 2 engagements, found %', n; end if;

  -- Row 5: priority conflict keeps the first row's value.
  if (select priority from public.clients where client_code = 'SQAS-C002') is distinct from 'High' then
    raise exception 'SQAS-C002: priority should be High (first row)';
  end if;

  -- Row 10: missing email stays empty.
  if (select email from public.clients where client_code = 'SQAS-C007') is not null then
    raise exception 'SQAS-C007: email should be empty';
  end if;

  -- Row 11: PCI-DSS is not in the list, so the service is empty.
  if (select certification_type from public.engagements
      where id = '5eed0003-0000-4000-8000-000000000011') is not null then
    raise exception 'Row 11 (SQAS-C008): certification_type should be empty';
  end if;

  -- Row 12: no owner.
  if (select owner_id from public.engagements
      where id = '5eed0003-0000-4000-8000-000000000012') is not null then
    raise exception 'Row 12 (SQAS-C009): owner should be empty';
  end if;

  -- Row 18: the possible duplicate is seeded as its own client, next to SQAS-C005.
  select count(*) into n from public.clients
    where client_code in ('SQAS-C005', 'SQAS-C015') and email = 'kavya.shah@arjunfin.example.com';
  if n <> 2 then raise exception 'SQAS-C005 and SQAS-C015 should both exist, found %', n; end if;

  -- Row 19: "Certifed" is left empty.
  if (select status from public.engagements
      where id = '5eed0003-0000-4000-8000-000000000019') is not null then
    raise exception 'Row 19 (SQAS-C016): status should be empty';
  end if;

  -- Row 20: "31/02/2027" and "4.5 L" are left empty; the payment status is kept.
  if (select valid_to from public.engagements
      where id = '5eed0003-0000-4000-8000-000000000020') is not null then
    raise exception 'Row 20 (SQAS-C017): valid_to should be empty';
  end if;
  if exists (
    select 1 from public.engagement_financials
    where engagement_id = '5eed0003-0000-4000-8000-000000000020'
      and (contract_value is not null or payment_status is distinct from 'Paid')
  ) or not exists (
    select 1 from public.engagement_financials
    where engagement_id = '5eed0003-0000-4000-8000-000000000020'
  ) then
    raise exception 'Row 20 (SQAS-C017): contract value should be empty, payment Paid';
  end if;

  -- A spot check of a good row: row 2 (C001 CMMI).
  if not exists (
    select 1 from public.engagements e
    join public.engagement_financials f on f.engagement_id = e.id
    where e.id = '5eed0003-0000-4000-8000-000000000002'
      and e.status = 'Certified' and e.certification_type = 'CMMI'
      and e.valid_to = '2026-11-14' and e.owner_id = '5eed0001-0000-4000-8000-000000000001'
      and f.contract_value = 850000 and f.payment_status = 'Paid'
  ) then
    raise exception 'Row 2 (SQAS-C001 CMMI) was not seeded as expected';
  end if;

  -- Not a failure: passwords are set later, locally, with bun run seed:passwords.
  select count(*) into n from auth.users
    where id::text like '5eed0001-%' and coalesce(encrypted_password, '') <> '';
  raise notice 'Demo users with a password set: % of 5', n;
end
$$;

-- ---------------------------------------------------------------------------
-- As Demo Owner 1: every row of each view (9 / 3 / 9 / 1 / 1), with values
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "5eed0001-0000-4000-8000-000000000001", "role": "authenticated"}';

do $$
declare
  n integer;
begin
  select count(*) into n from public.pipeline where id::text like '5eed0003-%';
  if n <> 9 then raise exception 'Owner: pipeline should have 9 rows, found %', n; end if;
  select count(*) into n from public.delivery where id::text like '5eed0003-%';
  if n <> 3 then raise exception 'Owner: delivery should have 3 rows, found %', n; end if;
  select count(*) into n from public.active_clients where id::text like '5eed0003-%';
  if n <> 9 then raise exception 'Owner: active_clients should have 9 rows, found %', n; end if;
  select count(*) into n from public.closed where id::text like '5eed0003-%';
  if n <> 1 then raise exception 'Owner: closed should have 1 row, found %', n; end if;

  if (select array_agg(id order by id) from public.needs_review where id::text like '5eed0003-%')
    is distinct from array['5eed0003-0000-4000-8000-000000000019'::uuid] then
    raise exception 'Owner: needs_review should hold only row 19 (Certifed)';
  end if;

  select count(*) into n from public.engagement_financials where engagement_id::text like '5eed0003-%';
  if n <> 23 then raise exception 'Owner: should read 23 financials rows, found %', n; end if;
end
$$;

reset role;

-- ---------------------------------------------------------------------------
-- As Demo Consultant 1 (no values access): all 23 engagements, no values
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "5eed0001-0000-4000-8000-000000000011", "role": "authenticated"}';

do $$
declare
  n integer;
begin
  select count(*) into n from public.engagements where id::text like '5eed0003-%';
  if n <> 23 then raise exception 'Consultant 1: should read 23 engagements, found %', n; end if;
  select count(*) into n from public.engagement_financials;
  if n <> 0 then raise exception 'Consultant 1: should read no financials, found %', n; end if;
  select count(*) into n from public.pipeline
    where id::text like '5eed0003-%' and (contract_value is not null or payment_status is not null);
  if n <> 0 then raise exception 'Consultant 1: pipeline shows values on % rows', n; end if;
end
$$;

reset role;

-- ---------------------------------------------------------------------------
-- As Demo Consultant 2 (values access): all financials
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "5eed0001-0000-4000-8000-000000000012", "role": "authenticated"}';

do $$
declare
  n integer;
begin
  select count(*) into n from public.engagement_financials where engagement_id::text like '5eed0003-%';
  if n <> 23 then raise exception 'Consultant 2: should read 23 financials rows, found %', n; end if;
end
$$;

reset role;

-- ---------------------------------------------------------------------------
-- As Demo Marketing 1: the 9 pipeline rows only, no other view, no values
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "5eed0001-0000-4000-8000-000000000021", "role": "authenticated"}';

do $$
declare
  n integer;
begin
  select count(*) into n from public.pipeline where id::text like '5eed0003-%';
  if n <> 9 then raise exception 'Marketing: pipeline should have 9 rows, found %', n; end if;
  select (select count(*) from public.delivery) + (select count(*) from public.active_clients)
       + (select count(*) from public.closed) + (select count(*) from public.needs_review)
    into n;
  if n <> 0 then raise exception 'Marketing: should see nothing outside pipeline, found % rows', n; end if;
  select count(*) into n from public.engagements;
  if n <> 9 then raise exception 'Marketing: should read 9 engagements, found %', n; end if;
  select count(*) into n from public.engagement_financials;
  if n <> 0 then raise exception 'Marketing: should read no financials, found %', n; end if;
  select count(*) into n from public.pipeline where contract_value is not null or payment_status is not null;
  if n <> 0 then raise exception 'Marketing: pipeline shows values on % rows', n; end if;
end
$$;

reset role;

do $$ begin raise notice 'SEED CHECK OK'; end $$;

rollback;
