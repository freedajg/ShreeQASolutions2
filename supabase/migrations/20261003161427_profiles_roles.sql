-- Phase 1, step 5: team members, roles and the role helpers every later security rule uses.
-- PRD FR-1, FR-9; SECURITY.md A2, A3; docs/PHASE-1-PLAN.md (choices 6 and 7).
--
-- Who may read what (row-level security + explicit grants; auto_expose_new_tables = false):
--   profiles (full rows)   own row while active; Owners read all
--   team_members (view)    id, full_name, email, role, booking_link, active of everyone,
--                          for any active user who has a role
-- A role comes only from server-set data (app_metadata) or from an Owner, never from
-- anything a user can edit about themselves. No role = no data access.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'consultant', 'marketing');

-- ---------------------------------------------------------------------------
-- Private schema for helpers (not in config.toml [api] schemas, so not callable over the API)
-- ---------------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- profiles: one row per login
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict, -- deactivate, never delete
  full_name text not null default '',
  email text not null,
  role public.app_role, -- null = no data access until an Owner assigns a role
  can_see_values boolean not null default false, -- Consultants only; Owners always see values
  booking_link text,
  mailbox_connected boolean not null default false, -- set by the server (Phase 5)
  theme_preference text not null default 'dark' check (theme_preference in ('light', 'dark', 'system')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 200),
  -- https only: blocks javascript: and other schemes when the link is shown as a button
  constraint profiles_booking_link_https check (booking_link is null or booking_link like 'https://%'),
  constraint profiles_booking_link_length check (booking_link is null or char_length(booking_link) <= 500)
);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- Role helpers. security definer: they read profiles regardless of the caller's own
-- row-level security, so policies can call them without recursion. Empty search_path:
-- every name is schema-qualified, so nobody can shadow a table or function.
-- They return nothing for an inactive or role-less user.
-- ---------------------------------------------------------------------------
create function app.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.active
$$;

create function app.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.current_app_role() = 'owner', false)
$$;

-- Owners always; Consultants only when an Owner has switched it on; Marketing never.
create function app.can_see_values()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'owner' or (p.role = 'consultant' and p.can_see_values)
      from public.profiles p
      where p.id = (select auth.uid()) and p.active
    ),
    false
  )
$$;

revoke all on function app.current_app_role() from public;
revoke all on function app.is_owner() from public;
revoke all on function app.can_see_values() from public;
grant execute on function app.current_app_role() to authenticated, service_role;
grant execute on function app.is_owner() to authenticated, service_role;
grant execute on function app.can_see_values() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New login -> profile row. The role is read only from raw_app_meta_data, which only the
-- server (service role) can set; raw_user_meta_data is user-editable, so it can supply the
-- display name but never the role.
-- ---------------------------------------------------------------------------
create function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_app_meta_data ->> 'role' in ('owner', 'consultant', 'marketing')
        then (new.raw_app_meta_data ->> 'role')::public.app_role
    end
  );
  return new;
end;
$$;

revoke all on function app.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard on changes:
--  1. Only an active Owner may change role, can_see_values, active, email or
--     mailbox_connected. Server-side work (migrations, seed, service role) has no
--     logged-in user and is trusted.
--  2. The last active Owner can never be demoted, deactivated or deleted, not even by
--     themselves and not by the server, so the firm can't lock itself out.
-- ---------------------------------------------------------------------------
create function app.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'A profile id cannot change' using errcode = '42501';
    end if;

    if (select auth.uid()) is not null
      and not app.is_owner()
      and (
        new.role is distinct from old.role
        or new.can_see_values is distinct from old.can_see_values
        or new.active is distinct from old.active
        or new.email is distinct from old.email
        or new.mailbox_connected is distinct from old.mailbox_connected
      ) then
      raise exception 'Only an Owner can change role, values access, active status, email or mailbox status'
        using errcode = '42501';
    end if;

    new.updated_at := now();
  end if;

  if old.role = 'owner' and old.active
    and (tg_op = 'DELETE' or new.role is distinct from 'owner' or not new.active) then
    -- Lock the active Owners so two Owners can't demote each other at the same moment.
    perform 1 from public.profiles where role = 'owner' and active for update;
    if not exists (
      select 1 from public.profiles
      where role = 'owner' and active and id <> old.id
    ) then
      raise exception 'The last active Owner cannot be demoted, deactivated or deleted'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.guard_profile_changes() from public;

create trigger guard_profile_changes
  before update or delete on public.profiles
  for each row execute function app.guard_profile_changes();

-- ---------------------------------------------------------------------------
-- Access to profiles. No insert (the trigger creates rows) and no delete for anyone
-- through the API. email and mailbox_connected are not updatable through the API at all.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, booking_link, theme_preference, role, can_see_values, active)
  on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

create policy "profiles: read own row while active"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) and active);

create policy "profiles: owners read all"
  on public.profiles for select to authenticated
  using ((select app.is_owner()));

-- Own name, booking link and theme. The guard stops a non-Owner changing anything else.
create policy "profiles: update own row while active"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and active)
  with check (id = (select auth.uid()));

create policy "profiles: owners update all"
  on public.profiles for update to authenticated
  using ((select app.is_owner()))
  with check ((select app.is_owner()));

-- ---------------------------------------------------------------------------
-- team_members: the colleague list (Phase 2 replaces the hard-coded team with it).
-- Only the six safe columns: can_see_values, mailbox_connected and theme_preference stay
-- visible only to the person themselves and to Owners, through profiles.
-- security_invoker = false: the view reads profiles as its owner, so every role-holder
-- sees all colleagues; the where clause is the gate (logged-in, active, with a role).
-- security_barrier = true: that gate is checked before any condition a caller adds.
-- ---------------------------------------------------------------------------
create view public.team_members
  with (security_invoker = false, security_barrier = true)
as
  select p.id, p.full_name, p.email, p.role, p.booking_link, p.active
  from public.profiles p
  where app.current_app_role() is not null;

revoke all on table public.team_members from anon, authenticated;
grant select on table public.team_members to authenticated;
grant select on table public.team_members to service_role;
