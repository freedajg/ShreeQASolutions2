-- Phase 1, step 6: the dropdown lists from the client's Excel (PRD §6.3, §6.4).
-- Keys are the exact Excel spellings (checked against the DUMMY workbook's
-- "Lists & Guidance" sheet on 03-Oct-2026), so an import can map a cell directly and a
-- misspelt value simply doesn't match.
--
-- Access (row-level security + explicit grants; auto_expose_new_tables = false):
--   read     any active user with a role
--   change   Owners only, and only in the four editable lists: add a value, change its
--            cycle / sort order / active flag. A code can't be renamed (engagements point
--            at it) and nothing is deleted: a value is retired with active = false.
--   statuses read-only for everyone: the groups drive business rules (delivery never gets
--            sales follow-ups), so they change only through a new migration.
-- These are reference data the real app needs, so they live in this migration, not the
-- test seed.

-- ---------------------------------------------------------------------------
-- Status groups (PRD §6.4)
-- ---------------------------------------------------------------------------
create type public.status_group as enum ('pipeline', 'delivery', 'active', 'paused', 'ended');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.certification_types (
  code text primary key
    check (code <> '' and code = btrim(code) and char_length(code) <= 50),
  -- Default renewal cycles (PRD FR-4); to confirm with the client at Checkpoint A.
  surveillance_months integer check (surveillance_months between 1 and 120),
  recert_months integer check (recert_months between 1 and 120),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.statuses (
  code text primary key
    check (code <> '' and code = btrim(code) and char_length(code) <= 50),
  status_group public.status_group not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table public.payment_statuses (
  code text primary key
    check (code <> '' and code = btrim(code) and char_length(code) <= 50),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.priorities (
  code text primary key
    check (code <> '' and code = btrim(code) and char_length(code) <= 50),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lead_sources (
  code text primary key
    check (code <> '' and code = btrim(code) and char_length(code) <= 50),
  sort_order integer not null default 0 check (sort_order >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.certification_types enable row level security;
alter table public.statuses enable row level security;
alter table public.payment_statuses enable row level security;
alter table public.priorities enable row level security;
alter table public.lead_sources enable row level security;

-- ---------------------------------------------------------------------------
-- Values (exact Excel spellings, in the Excel's order)
-- ---------------------------------------------------------------------------
-- ISO: yearly surveillance audit + 3-year recertification. CMMI, CMMC: 3 years.
-- SOC 1, SOC 2, VAPT: annual. GDPR, DPDP, HIPAA, Other: no automatic cycle.
insert into public.certification_types (code, surveillance_months, recert_months, sort_order) values
  ('ISO 9001', 12, 36, 1),
  ('ISO 20000-1', 12, 36, 2),
  ('ISO 27001', 12, 36, 3),
  ('ISO 22301', 12, 36, 4),
  ('ISO 27701', 12, 36, 5),
  ('ISO 42001', 12, 36, 6),
  ('ISO 13485', 12, 36, 7),
  ('CMMI', null, 36, 8),
  ('CMMC', null, 36, 9),
  ('SOC 1', null, 12, 10),
  ('SOC 2', null, 12, 11),
  ('GDPR', null, null, 12),
  ('DPDP', null, null, 13),
  ('HIPAA', null, null, 14),
  ('VAPT', null, 12, 15),
  ('Other', null, null, 16);

insert into public.statuses (code, status_group, sort_order) values
  ('Lead', 'pipeline', 1),
  ('Proposal', 'pipeline', 2),
  ('In Progress', 'delivery', 3),
  ('Implemented', 'delivery', 4),
  ('Audit Completed', 'delivery', 5),
  ('Certified', 'active', 6),
  ('Renewal Due', 'active', 7),
  ('Completed', 'active', 8),
  ('On Hold', 'paused', 9),
  ('Closed', 'ended', 10);

insert into public.payment_statuses (code, sort_order) values
  ('Not Invoiced', 1),
  ('Partially Paid', 2),
  ('Paid', 3),
  ('Overdue', 4),
  ('NA', 5);

insert into public.priorities (code, sort_order) values
  ('High', 1),
  ('Medium', 2),
  ('Low', 3);

insert into public.lead_sources (code, sort_order) values
  ('Referral', 1),
  ('Website', 2),
  ('LinkedIn', 3),
  ('Existing Client', 4),
  ('Partner', 5),
  ('Event', 6),
  ('Other', 7);

-- ---------------------------------------------------------------------------
-- Grants. No delete for anyone through the API. The code column is in the insert grant
-- but not the update grant, so a code can never be renamed.
-- ---------------------------------------------------------------------------
revoke all on table public.certification_types, public.statuses, public.payment_statuses,
  public.priorities, public.lead_sources from anon, authenticated;

grant select on table public.certification_types, public.statuses, public.payment_statuses,
  public.priorities, public.lead_sources to authenticated;

grant insert (code, surveillance_months, recert_months, sort_order, active),
  update (surveillance_months, recert_months, sort_order, active)
  on table public.certification_types to authenticated;
grant insert (code, sort_order, active), update (sort_order, active)
  on table public.payment_statuses to authenticated;
grant insert (code, sort_order, active), update (sort_order, active)
  on table public.priorities to authenticated;
grant insert (code, sort_order, active), update (sort_order, active)
  on table public.lead_sources to authenticated;
-- statuses: select only.

grant all on table public.certification_types, public.statuses, public.payment_statuses,
  public.priorities, public.lead_sources to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
create policy "certification_types: role-holders read"
  on public.certification_types for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy "certification_types: owners add"
  on public.certification_types for insert to authenticated
  with check ((select app.is_owner()));
create policy "certification_types: owners change"
  on public.certification_types for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

create policy "statuses: role-holders read"
  on public.statuses for select to authenticated
  using ((select app.current_app_role()) is not null);

create policy "payment_statuses: role-holders read"
  on public.payment_statuses for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy "payment_statuses: owners add"
  on public.payment_statuses for insert to authenticated
  with check ((select app.is_owner()));
create policy "payment_statuses: owners change"
  on public.payment_statuses for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

create policy "priorities: role-holders read"
  on public.priorities for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy "priorities: owners add"
  on public.priorities for insert to authenticated
  with check ((select app.is_owner()));
create policy "priorities: owners change"
  on public.priorities for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

create policy "lead_sources: role-holders read"
  on public.lead_sources for select to authenticated
  using ((select app.current_app_role()) is not null);
create policy "lead_sources: owners add"
  on public.lead_sources for insert to authenticated
  with check ((select app.is_owner()));
create policy "lead_sources: owners change"
  on public.lead_sources for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));
