-- Delivery workroom, invoices, WhatsApp and voice-call records, web leads (the screens from the
-- approved AI Studio design, 24-Nov-2026), and MFA for Owners (Phase 1 step 18).
--
-- Honesty rules for the phase-2 records (PRD §5 "Not in v1"): SQAS has no WhatsApp Business
-- account, no voice-calling provider and no invoicing tool connection yet. These tables store
-- what a person records; nothing here messages, calls or syncs anyone. A WhatsApp message
-- written in Drishti stays 'queued' until a provider exists; invoices are 'not_synced'.

-- commit_import(), apply_drishti_proposal() and submit_web_lead() run as the caller and write
-- their own log row through app.log(). The app schema is not exposed over the API, so this
-- grant doesn't let the browser call it directly.
grant execute on function app.log(text, uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- delivery_items: checklist tasks, gap-analysis domains and document requests per engagement
-- ---------------------------------------------------------------------------
create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  kind text not null check (kind in ('checklist', 'gap', 'document')),
  label text not null check (btrim(label) <> '' and char_length(label) <= 300), -- clause / domain / doc
  detail text check (char_length(detail) <= 2000), -- task / note
  state text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint delivery_items_state check (
    (kind = 'checklist' and state in ('open', 'done'))
    or (kind = 'gap' and state in ('Compliant', 'Partial Gap', 'Missing'))
    or (kind = 'document' and state in ('Collected', 'Pending Client', 'Under Review'))
  )
);

create index delivery_items_engagement_idx on public.delivery_items (engagement_id, kind, sort_order);
create index delivery_items_created_by_idx on public.delivery_items (created_by);

alter table public.delivery_items enable row level security;

create trigger stamp_created_by before insert on public.delivery_items
  for each row execute function app.stamp_created_by();
create trigger touch_updated_at before update on public.delivery_items
  for each row execute function app.touch_updated_at();

revoke all on table public.delivery_items from anon, authenticated;
grant select on table public.delivery_items to authenticated;
grant insert (engagement_id, kind, label, detail, state, sort_order),
  update (label, detail, state, sort_order)
  on table public.delivery_items to authenticated;
grant all on table public.delivery_items to service_role;

create policy "delivery_items: owners and consultants read"
  on public.delivery_items for select to authenticated
  using ((select app.current_app_role()) in ('owner', 'consultant'));

create policy "delivery_items: owners add, consultants on their engagements"
  on public.delivery_items for insert to authenticated
  with check ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

create policy "delivery_items: owners change, consultants on their engagements"
  on public.delivery_items for update to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)))
  with check ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

-- ---------------------------------------------------------------------------
-- invoices: money, so values access only (same rule as engagement_financials)
-- ---------------------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique check (char_length(invoice_no) <= 50),
  engagement_id uuid not null references public.engagements (id) on delete restrict,
  issued_on date not null default app.today_ist(),
  due_on date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  gst_amount numeric(12, 2) not null default 0 check (gst_amount >= 0),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue')),
  sync_provider text check (sync_provider in ('Tally Prime', 'Zoho Books')),
  sync_status text not null default 'not_synced' check (sync_status in ('not_synced', 'synced')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_engagement_idx on public.invoices (engagement_id);
create index invoices_created_by_idx on public.invoices (created_by);

alter table public.invoices enable row level security;

create trigger stamp_created_by before insert on public.invoices
  for each row execute function app.stamp_created_by();
create trigger touch_updated_at before update on public.invoices
  for each row execute function app.touch_updated_at();

-- Invoice paid -> the engagement's Payment Status (Col Z) follows. Runs as the caller's
-- change was already allowed; written by definer so the financials row can be created.
create function app.invoice_updates_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('Paid', 'Partially Paid', 'Overdue')
    and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    insert into public.engagement_financials (engagement_id, payment_status)
    values (new.engagement_id, new.status)
    on conflict (engagement_id) do update set payment_status = excluded.payment_status;
  end if;
  perform app.log('invoice', new.engagement_id,
    (select e.client_id from public.engagements e where e.id = new.engagement_id),
    jsonb_build_object('invoice_no', new.invoice_no, 'status', new.status));
  return null;
end;
$$;

revoke all on function app.invoice_updates_payment_status() from public;

create trigger invoice_updates_payment_status after insert or update of status on public.invoices
  for each row execute function app.invoice_updates_payment_status();

revoke all on table public.invoices from anon, authenticated;
grant select on table public.invoices to authenticated;
grant insert (invoice_no, engagement_id, issued_on, due_on, amount, gst_amount, status, sync_provider),
  update (due_on, amount, gst_amount, status, sync_provider)
  on table public.invoices to authenticated;
grant all on table public.invoices to service_role;

create policy "invoices: values-access read"
  on public.invoices for select to authenticated
  using ((select app.can_see_values()));

create policy "invoices: owners add, consultants with values access on their own"
  on public.invoices for insert to authenticated
  with check ((select app.is_owner())
    or ((select app.can_see_values()) and app.owns_engagement(engagement_id)));

create policy "invoices: owners change, consultants with values access on their own"
  on public.invoices for update to authenticated
  using ((select app.is_owner())
    or ((select app.can_see_values()) and app.owns_engagement(engagement_id)))
  with check ((select app.is_owner())
    or ((select app.can_see_values()) and app.owns_engagement(engagement_id)));

-- ---------------------------------------------------------------------------
-- whatsapp_messages and voice_calls: records only (no provider yet)
-- ---------------------------------------------------------------------------
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  engagement_id uuid references public.engagements (id) on delete restrict,
  contact_phone text check (char_length(contact_phone) <= 50),
  template text check (char_length(template) <= 100),
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  body text not null check (btrim(body) <> '' and char_length(body) <= 2000),
  -- 'queued' until a WhatsApp Business provider is connected (PRD §5, phase 2).
  delivery_status text not null default 'queued' check (delivery_status in ('queued', 'delivered', 'read', 'failed')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  engagement_id uuid references public.engagements (id) on delete restrict,
  owner_id uuid references public.profiles (id) on delete restrict,
  called_at timestamptz not null default now(),
  duration_sec integer check (duration_sec >= 0),
  outcome text not null check (outcome in
    ('Requested', 'Meeting Booked', 'Requested Proposal', 'No Answer', 'Callback Scheduled')),
  booked_slot text check (char_length(booked_slot) <= 200),
  summary text check (char_length(summary) <= 4000),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index whatsapp_messages_client_idx on public.whatsapp_messages (client_id, created_at desc);
create index whatsapp_messages_engagement_idx on public.whatsapp_messages (engagement_id);
create index whatsapp_messages_created_by_idx on public.whatsapp_messages (created_by);
create index voice_calls_client_idx on public.voice_calls (client_id, called_at desc);
create index voice_calls_engagement_idx on public.voice_calls (engagement_id);
create index voice_calls_owner_idx on public.voice_calls (owner_id);
create index voice_calls_created_by_idx on public.voice_calls (created_by);

alter table public.whatsapp_messages enable row level security;
alter table public.voice_calls enable row level security;

create trigger stamp_created_by before insert on public.whatsapp_messages
  for each row execute function app.stamp_created_by();
create trigger stamp_created_by before insert on public.voice_calls
  for each row execute function app.stamp_created_by();

-- A message or call written from the browser is always queued / requested: only a future
-- provider integration (service role) can say it was delivered or what the outcome was.
create function app.outreach_from_browser()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_table_name = 'whatsapp_messages' then
      new.delivery_status := 'queued';
      new.direction := 'outbound';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.outreach_from_browser() from public;

create trigger outreach_from_browser before insert on public.whatsapp_messages
  for each row execute function app.outreach_from_browser();

create function app.log_outreach()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.log(case when tg_table_name = 'whatsapp_messages' then 'whatsapp' else 'voice_call' end,
    new.engagement_id, new.client_id, jsonb_build_object('id', new.id));
  return null;
end;
$$;

revoke all on function app.log_outreach() from public;

create trigger log_outreach after insert on public.whatsapp_messages
  for each row execute function app.log_outreach();
create trigger log_outreach after insert on public.voice_calls
  for each row execute function app.log_outreach();

revoke all on table public.whatsapp_messages, public.voice_calls from anon, authenticated;
grant select on table public.whatsapp_messages, public.voice_calls to authenticated;
grant insert (client_id, engagement_id, contact_phone, template, body) on table public.whatsapp_messages
  to authenticated;
grant insert (client_id, engagement_id, owner_id, called_at, duration_sec, outcome, booked_slot, summary)
  on table public.voice_calls to authenticated;
grant all on table public.whatsapp_messages, public.voice_calls to service_role;

-- Same as email: Owners all; Consultants their own engagements; Marketing none.
create policy "whatsapp_messages: owners read all, consultants their engagements"
  on public.whatsapp_messages for select to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

create policy "whatsapp_messages: senders add"
  on public.whatsapp_messages for insert to authenticated
  with check (app.can_email_engagement(engagement_id)
    and not (select c.do_not_contact from public.clients c where c.id = client_id)
    and client_id = (select e.client_id from public.engagements e where e.id = engagement_id));

create policy "voice_calls: owners read all, consultants their engagements"
  on public.voice_calls for select to authenticated
  using ((select app.is_owner())
    or ((select app.current_app_role()) = 'consultant' and app.owns_engagement(engagement_id)));

create policy "voice_calls: senders add"
  on public.voice_calls for insert to authenticated
  with check (app.can_email_engagement(engagement_id)
    and client_id = (select e.client_id from public.engagements e where e.id = engagement_id));

-- ---------------------------------------------------------------------------
-- Web lead form: one call creates the client and its Lead (source Website). Runs as the
-- caller: every role-holder may add leads (FR-9). No owner is set (an Owner assigns one, and
-- the Pipeline highlights it until then). Nothing is invented: empty fields stay empty.
-- ---------------------------------------------------------------------------
create function public.submit_web_lead(
  p_company text,
  p_contact text,
  p_email text,
  p_phone text,
  p_city text,
  p_service text,
  p_notes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client uuid;
  v_eng uuid;
begin
  if (select app.current_app_role()) is null then
    raise exception 'You don''t have access' using errcode = '42501';
  end if;

  insert into public.clients (name, contact_person, email, phone, city)
  values (btrim(p_company), nullif(btrim(p_contact), ''), nullif(lower(btrim(p_email)), ''),
    nullif(btrim(p_phone), ''), nullif(btrim(p_city), ''))
  returning id into v_client;

  insert into public.engagements (client_id, certification_type, status, lead_source,
    initial_engagement_date, remarks)
  values (v_client, nullif(p_service, ''), 'Lead', 'Website', app.today_ist(), nullif(btrim(p_notes), ''))
  returning id into v_eng;

  if nullif(btrim(p_notes), '') is not null then
    insert into public.engagement_notes (engagement_id, summary, next_step)
    values (v_eng, 'Website enquiry: ' || left(btrim(p_notes), 3900), 'Initial discovery call');
  end if;

  perform app.log('web_lead', v_eng, v_client, jsonb_build_object('service', p_service));
  return v_eng;
end;
$$;

revoke all on function public.submit_web_lead(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_web_lead(text, text, text, text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- MFA for Owners (PRD §8, Phase 1 step 18): an Owner's session must be aal2 (authenticator
-- app verified) before any Owner rule applies. At aal1 an Owner has no role at all, so every
-- policy that calls these helpers refuses. Their own profile row stays readable (the screen
-- needs it to send them to MFA set-up).
-- ---------------------------------------------------------------------------
create or replace function app.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role = 'owner' and coalesce((select auth.jwt()) ->> 'aal', 'aal1') <> 'aal2' then null
    else p.role
  end
  from public.profiles p
  where p.id = (select auth.uid()) and p.active
$$;

create or replace function app.can_see_values()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (p.role = 'owner' and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2')
        or (p.role = 'consultant' and p.can_see_values)
      from public.profiles p
      where p.id = (select auth.uid()) and p.active
    ),
    false
  )
$$;
