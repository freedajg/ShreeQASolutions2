-- Phase 1, step 9: the status views the screens read (CLAUDE.md rule 6; PRD §6.4).
--   pipeline        Lead, Proposal (pipeline group) and On Hold (paused group)
--   delivery        In Progress, Implemented, Audit Completed (delivery group)
--   active_clients  Certified, Renewal Due, Completed (active group)
--   closed          Closed (ended group); hidden by default, for a "show Closed" option
--   needs_review    no status, or a status with no group (e.g. a misspelt Excel status the
--                   import left empty and flagged), so it doesn't vanish from every screen
-- Every engagement is in exactly one of the five. All five have the same 43 columns.
--
-- security_invoker = true (SECURITY.md A3): each view reads its tables as the logged-in user,
-- so the step 8 row rules decide what each role sees. team_members (step 5) stays the only
-- view that runs as its owner. So:
--   Owner, Consultant        every row of each view
--   Marketing                pipeline rows only; the other four come back empty
--   role-less, inactive      nothing; anon has no grant at all
--
-- Contract value and payment status come from a LEFT JOIN on engagement_financials:
--   - an engagement with no financials row (added by Marketing, or by a Consultant without
--     values access) still appears, with both columns empty;
--   - for someone without values access, row-level security hides every financials row, so
--     both columns are always empty for them. The values never leave the database, and a
--     filter such as "contract_value > 0" matches nothing.
-- So an empty value means "not recorded" to an Owner and "not shown" to everyone else; the
-- screen tells the two apart from the user's own can_see_values (profiles).
--
-- Clients use an inner join: client_id is required, and every engagement a role may read has
-- a client that role may read (Marketing reads the clients behind its leads), so no
-- engagement is dropped. The pgTAP tests check the exact rows per role.
--
-- Archived rows: like the step 8 rules, these views ignore archived_at (DECISIONS
-- 06-Oct-2026: kept in the views, screens filter them; revisit after the demo). Both
-- archived_at columns are included so the screen can filter them.
--
-- Read-only: select is the only grant (the joins also make them not updatable).

-- ---------------------------------------------------------------------------
-- pipeline
-- ---------------------------------------------------------------------------
create view public.pipeline
  with (security_invoker = true)
as
  select
    e.id,
    e.client_id,
    e.certification_type,
    e.standard_framework,
    e.scope,
    e.status,
    s.status_group,
    s.sort_order as status_sort_order,
    e.initial_engagement_date,
    e.completion_date,
    e.certificate_number,
    e.valid_from,
    e.valid_to,
    e.certification_body,
    e.surveillance_due_date,
    e.last_audit_date,
    e.next_audit_date,
    e.owner_id,
    e.lead_source,
    e.remarks,
    e.last_contacted_on,
    e.next_follow_up_on,
    e.date_is_estimated,
    e.created_by,
    e.archived_at,
    e.created_at,
    e.updated_at,
    c.client_code,
    c.name as client_name,
    c.industry as client_industry,
    c.address as client_address,
    c.city as client_city,
    c.state_country as client_state_country,
    c.contact_person as client_contact_person,
    c.designation as client_designation,
    c.email as client_email,
    c.phone as client_phone,
    c.website as client_website,
    c.priority as client_priority,
    c.do_not_contact as client_do_not_contact,
    c.archived_at as client_archived_at,
    f.contract_value,
    f.payment_status
  from public.engagements e
  join public.statuses s on s.code = e.status
  join public.clients c on c.id = e.client_id
  left join public.engagement_financials f on f.engagement_id = e.id
  -- On Hold is in the paused group but belongs on the Pipeline board (DECISIONS 04-Oct-2026).
  where s.status_group in ('pipeline', 'paused');

-- ---------------------------------------------------------------------------
-- delivery
-- ---------------------------------------------------------------------------
create view public.delivery
  with (security_invoker = true)
as
  select
    e.id,
    e.client_id,
    e.certification_type,
    e.standard_framework,
    e.scope,
    e.status,
    s.status_group,
    s.sort_order as status_sort_order,
    e.initial_engagement_date,
    e.completion_date,
    e.certificate_number,
    e.valid_from,
    e.valid_to,
    e.certification_body,
    e.surveillance_due_date,
    e.last_audit_date,
    e.next_audit_date,
    e.owner_id,
    e.lead_source,
    e.remarks,
    e.last_contacted_on,
    e.next_follow_up_on,
    e.date_is_estimated,
    e.created_by,
    e.archived_at,
    e.created_at,
    e.updated_at,
    c.client_code,
    c.name as client_name,
    c.industry as client_industry,
    c.address as client_address,
    c.city as client_city,
    c.state_country as client_state_country,
    c.contact_person as client_contact_person,
    c.designation as client_designation,
    c.email as client_email,
    c.phone as client_phone,
    c.website as client_website,
    c.priority as client_priority,
    c.do_not_contact as client_do_not_contact,
    c.archived_at as client_archived_at,
    f.contract_value,
    f.payment_status
  from public.engagements e
  join public.statuses s on s.code = e.status
  join public.clients c on c.id = e.client_id
  left join public.engagement_financials f on f.engagement_id = e.id
  where s.status_group = 'delivery';

-- ---------------------------------------------------------------------------
-- active_clients
-- ---------------------------------------------------------------------------
create view public.active_clients
  with (security_invoker = true)
as
  select
    e.id,
    e.client_id,
    e.certification_type,
    e.standard_framework,
    e.scope,
    e.status,
    s.status_group,
    s.sort_order as status_sort_order,
    e.initial_engagement_date,
    e.completion_date,
    e.certificate_number,
    e.valid_from,
    e.valid_to,
    e.certification_body,
    e.surveillance_due_date,
    e.last_audit_date,
    e.next_audit_date,
    e.owner_id,
    e.lead_source,
    e.remarks,
    e.last_contacted_on,
    e.next_follow_up_on,
    e.date_is_estimated,
    e.created_by,
    e.archived_at,
    e.created_at,
    e.updated_at,
    c.client_code,
    c.name as client_name,
    c.industry as client_industry,
    c.address as client_address,
    c.city as client_city,
    c.state_country as client_state_country,
    c.contact_person as client_contact_person,
    c.designation as client_designation,
    c.email as client_email,
    c.phone as client_phone,
    c.website as client_website,
    c.priority as client_priority,
    c.do_not_contact as client_do_not_contact,
    c.archived_at as client_archived_at,
    f.contract_value,
    f.payment_status
  from public.engagements e
  join public.statuses s on s.code = e.status
  join public.clients c on c.id = e.client_id
  left join public.engagement_financials f on f.engagement_id = e.id
  where s.status_group = 'active';

-- ---------------------------------------------------------------------------
-- closed
-- ---------------------------------------------------------------------------
create view public.closed
  with (security_invoker = true)
as
  select
    e.id,
    e.client_id,
    e.certification_type,
    e.standard_framework,
    e.scope,
    e.status,
    s.status_group,
    s.sort_order as status_sort_order,
    e.initial_engagement_date,
    e.completion_date,
    e.certificate_number,
    e.valid_from,
    e.valid_to,
    e.certification_body,
    e.surveillance_due_date,
    e.last_audit_date,
    e.next_audit_date,
    e.owner_id,
    e.lead_source,
    e.remarks,
    e.last_contacted_on,
    e.next_follow_up_on,
    e.date_is_estimated,
    e.created_by,
    e.archived_at,
    e.created_at,
    e.updated_at,
    c.client_code,
    c.name as client_name,
    c.industry as client_industry,
    c.address as client_address,
    c.city as client_city,
    c.state_country as client_state_country,
    c.contact_person as client_contact_person,
    c.designation as client_designation,
    c.email as client_email,
    c.phone as client_phone,
    c.website as client_website,
    c.priority as client_priority,
    c.do_not_contact as client_do_not_contact,
    c.archived_at as client_archived_at,
    f.contract_value,
    f.payment_status
  from public.engagements e
  join public.statuses s on s.code = e.status
  join public.clients c on c.id = e.client_id
  left join public.engagement_financials f on f.engagement_id = e.id
  where s.status_group = 'ended';

-- ---------------------------------------------------------------------------
-- needs_review: a left join on statuses, so an engagement with no status is kept, and
-- status_group / status_sort_order are empty. statuses.status_group is required and
-- engagements.status must be a known code, so today this means "status is empty"; the
-- "no group" half guards against a future change. Every role that can read an engagement
-- can also read statuses, so a hidden statuses row can't misfile an engagement here.
-- ---------------------------------------------------------------------------
create view public.needs_review
  with (security_invoker = true)
as
  select
    e.id,
    e.client_id,
    e.certification_type,
    e.standard_framework,
    e.scope,
    e.status,
    s.status_group,
    s.sort_order as status_sort_order,
    e.initial_engagement_date,
    e.completion_date,
    e.certificate_number,
    e.valid_from,
    e.valid_to,
    e.certification_body,
    e.surveillance_due_date,
    e.last_audit_date,
    e.next_audit_date,
    e.owner_id,
    e.lead_source,
    e.remarks,
    e.last_contacted_on,
    e.next_follow_up_on,
    e.date_is_estimated,
    e.created_by,
    e.archived_at,
    e.created_at,
    e.updated_at,
    c.client_code,
    c.name as client_name,
    c.industry as client_industry,
    c.address as client_address,
    c.city as client_city,
    c.state_country as client_state_country,
    c.contact_person as client_contact_person,
    c.designation as client_designation,
    c.email as client_email,
    c.phone as client_phone,
    c.website as client_website,
    c.priority as client_priority,
    c.do_not_contact as client_do_not_contact,
    c.archived_at as client_archived_at,
    f.contract_value,
    f.payment_status
  from public.engagements e
  left join public.statuses s on s.code = e.status
  join public.clients c on c.id = e.client_id
  left join public.engagement_financials f on f.engagement_id = e.id
  where s.status_group is null;

-- ---------------------------------------------------------------------------
-- Grants: read-only for logged-in users; nothing for anon. The step 8 row rules on
-- engagements, clients, statuses and engagement_financials still apply underneath.
-- ---------------------------------------------------------------------------
revoke all on table public.pipeline, public.delivery, public.active_clients, public.closed,
  public.needs_review from anon, authenticated;
grant select on table public.pipeline, public.delivery, public.active_clients, public.closed,
  public.needs_review to authenticated;
grant select on table public.pipeline, public.delivery, public.active_clients, public.closed,
  public.needs_review to service_role;
