-- Phase 1, step 15: the renewal-date rule (PRD FR-4) and the v_renewals view behind the
-- Renewal Radar.
--
-- Rule, in order (PRD FR-4):
--   1. Surveillance / Renewal Due Date (V), if filled          -> 'Surveillance'
--   2. Next Audit / Review Date (X), if filled                 -> 'Surveillance'
--   3. Certificate Valid To (T), if filled                      -> 'Recertification'
--   4. Otherwise Certification / Completion Date (Q) plus the certification type's first
--      cycle (surveillance months if it has them, else recertification months), labelled
--      estimated. No cycle (GDPR, DPDP, HIPAA, Other) or no completion date = no date, and
--      the engagement stays off the Radar (Test Notes row 22).
-- Buckets: Overdue (before the reference date), Due in 30 days (0-30), 31-90 days, Later.
--
-- app.renewal_info() is pure: it takes the dates and the reference date, so tests always pass
-- 29-Sep-2026 (PHASE-1-PLAN.md choice 5). Only v_renewals uses today's date in IST.
-- Reading follows the caller's own row rules (security invoker), so Marketing, which can't read
-- active-client engagements, gets nothing.

create function app.renewal_info(
  p_certification_type text,
  p_surveillance_due_date date,
  p_next_audit_date date,
  p_valid_to date,
  p_completion_date date,
  p_as_of date
)
returns table (due_date date, event_kind text, is_estimated boolean, bucket text, days_until integer)
language sql
stable
security definer
set search_path = ''
as $$
  with picked as (
    select
      case
        when p_surveillance_due_date is not null then p_surveillance_due_date
        when p_next_audit_date is not null then p_next_audit_date
        when p_valid_to is not null then p_valid_to
        when p_completion_date is not null and ct.first_cycle is not null
          then (p_completion_date + make_interval(months => ct.first_cycle))::date
      end as due,
      case
        when p_surveillance_due_date is not null or p_next_audit_date is not null then 'Surveillance'
        when p_valid_to is not null then 'Recertification'
        when ct.surveillance_months is not null then 'Surveillance'
        else 'Recertification'
      end as kind,
      (p_surveillance_due_date is null and p_next_audit_date is null and p_valid_to is null) as est
    from (select 1) one
    left join lateral (
      select c.surveillance_months, coalesce(c.surveillance_months, c.recert_months) as first_cycle
      from public.certification_types c
      where c.code = p_certification_type
    ) ct on true
  )
  select
    due,
    case when due is null then null else kind end,
    due is not null and est,
    case
      when due is null then 'No date'
      when due < p_as_of then 'Overdue'
      when due - p_as_of <= 30 then 'Due in 30 days'
      when due - p_as_of <= 90 then '31–90 days'
      else 'Later'
    end,
    case when due is null then null else due - p_as_of end
  from picked
$$;

revoke all on function app.renewal_info(text, date, date, date, date, date) from public;
grant execute on function app.renewal_info(text, date, date, date, date, date)
  to authenticated, service_role;

-- Today in India (PRD: times in IST).
create function app.today_ist()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

revoke all on function app.today_ist() from public;
grant execute on function app.today_ist() to authenticated, service_role;

-- renewal_due: one engagement, any reference date. security invoker: the caller sees only
-- engagements their own row rules allow; an unknown or hidden id returns no row.
create function public.renewal_due(p_engagement_id uuid, p_as_of date)
returns table (due_date date, event_kind text, is_estimated boolean, bucket text, days_until integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.*
  from public.engagements e
  cross join lateral app.renewal_info(
    e.certification_type, e.surveillance_due_date, e.next_audit_date, e.valid_to,
    e.completion_date, p_as_of
  ) r
  where e.id = p_engagement_id
$$;

revoke all on function public.renewal_due(uuid, date) from public, anon, authenticated;
grant execute on function public.renewal_due(uuid, date) to authenticated, service_role;

-- The Radar: every live engagement in the Active client group that has a due date.
-- Both kinds of event are shown where they exist (FR-4): the next surveillance (V or X) and the
-- recertification date (T).
create view public.v_renewals
  with (security_invoker = true)
as
  select
    e.id as engagement_id,
    e.client_id,
    c.name as client_name,
    c.client_code,
    c.priority,
    e.certification_type,
    e.standard_framework,
    e.status,
    e.owner_id,
    coalesce(e.surveillance_due_date, e.next_audit_date) as next_surveillance_date,
    e.valid_to as recertification_date,
    r.due_date,
    r.event_kind,
    r.is_estimated,
    r.bucket,
    r.days_until
  from public.engagements e
  join public.clients c on c.id = e.client_id
  join public.statuses s on s.code = e.status
  cross join lateral app.renewal_info(
    e.certification_type, e.surveillance_due_date, e.next_audit_date, e.valid_to,
    e.completion_date, app.today_ist()
  ) r
  where s.status_group = 'active'
    and e.archived_at is null
    and c.archived_at is null
    and r.due_date is not null;

revoke all on table public.v_renewals from anon, authenticated;
grant select on table public.v_renewals to authenticated, service_role;
