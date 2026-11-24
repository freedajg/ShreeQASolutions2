-- Extra dummy rows for the tables added on 24-Nov-2026 (3-4 each, as agreed). Fictitious only,
-- built on top of supabase/seed.sql (the DUMMY workbook rows). Runs as the database owner, so
-- log rows are 'system'. Safe to run once; rows are keyed on the DUMMY client codes.

do $$
declare
  v_owner1 uuid := (select id from public.profiles where email = 'demo.owner1@example.com');
  v_owner2 uuid := (select id from public.profiles where email = 'demo.owner2@example.com');
  v_cons1 uuid := (select id from public.profiles where email = 'demo.consultant1@example.com');
  e_bright_cmmi uuid;
  e_bright_iso uuid;
  e_arjun uuid;
  e_sahyadri uuid;
  e_meridian uuid;
  e_tejas uuid;
  e_deccan uuid;
  e_lotus uuid;
  v_thread uuid;
  v_msg uuid;
  v_tag_ent uuid;
  v_tag_bfsi uuid;
  v_tag_ref uuid;
  v_tag_hot uuid;
begin
  select e.id into e_bright_cmmi from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C001' and e.certification_type = 'CMMI';
  select e.id into e_bright_iso from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C001' and e.certification_type = 'ISO 27001';
  select e.id into e_arjun from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C005';
  select e.id into e_sahyadri from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C006';
  select e.id into e_meridian from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C010';
  select e.id into e_tejas from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C011';
  select e.id into e_deccan from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C012';
  select e.id into e_lotus from public.engagements e join public.clients c on c.id = e.client_id
    where c.client_code = 'SQAS-C004';

  -- Meeting notes (PRD §6.5)
  insert into public.engagement_notes (engagement_id, held_on, held_by, summary, next_step, source) values
    (e_arjun, '2026-09-12', v_owner2, 'Zoom with the CTO: wants CMMI ML3 by March for an enterprise RFP', 'Send ML3 roadmap and proposal', 'system'),
    (e_sahyadri, '2026-08-28', v_owner1, 'Proposal walkthrough for ISO 27001 scope (2 sites)', 'Chase decision after board meeting', 'system'),
    (e_bright_cmmi, '2026-07-02', v_owner2, 'Appraisal debrief; planning the next appraisal before expiry', 'Book readiness review in October', 'system'),
    (e_meridian, '2026-09-20', v_cons1, 'Gap assessment kick-off with the process group', 'Collect process documents', 'system');

  -- Tags
  insert into public.tags (name, tone) values
    ('Enterprise', 'primary'), ('BFSI', 'info'), ('Referral partner', 'success'), ('Hot', 'danger')
    on conflict (name) do nothing;
  select id into v_tag_ent from public.tags where name = 'Enterprise';
  select id into v_tag_bfsi from public.tags where name = 'BFSI';
  select id into v_tag_ref from public.tags where name = 'Referral partner';
  select id into v_tag_hot from public.tags where name = 'Hot';

  insert into public.client_tags (client_id, tag_id)
  select c.id, t.tag from public.clients c
  join (values ('SQAS-C001', v_tag_ent), ('SQAS-C005', v_tag_bfsi), ('SQAS-C005', v_tag_hot),
               ('SQAS-C006', v_tag_ref), ('SQAS-C002', v_tag_ent)) t(code, tag) on t.code = c.client_code
  on conflict do nothing;

  -- Delivery workroom
  insert into public.delivery_items (engagement_id, kind, label, detail, state, sort_order) values
    (e_meridian, 'checklist', 'PP SP 2.1', 'Project plans baselined for 3 sample projects', 'done', 1),
    (e_meridian, 'checklist', 'MC SP 1.1', 'Monitoring evidence for last 2 sprints', 'open', 2),
    (e_tejas, 'gap', 'A.8 Asset management', 'Asset register missing owners', 'Partial Gap', 1),
    (e_deccan, 'document', 'Records of processing (RoPA)', null, 'Pending Client', 1);

  -- Invoices (amounts are dummy)
  insert into public.invoices (invoice_no, engagement_id, issued_on, due_on, amount, gst_amount, status, sync_provider) values
    ('SQAS/26-27/101', e_meridian, '2026-08-01', '2026-08-31', 300000, 54000, 'Paid', 'Tally Prime'),
    ('SQAS/26-27/102', e_tejas, '2026-09-01', '2026-10-01', 150000, 27000, 'Sent', 'Tally Prime'),
    ('SQAS/26-27/103', e_deccan, '2026-07-15', '2026-08-14', 120000, 21600, 'Overdue', 'Zoho Books');

  -- WhatsApp (queued: no WhatsApp Business account yet) and calls (recorded by a person)
  insert into public.whatsapp_messages (client_id, engagement_id, contact_phone, template, body, delivery_status) values
    ((select client_id from public.engagements where id = e_bright_iso), e_bright_iso, '+91 90000 00001', 'renewal_reminder', 'Reminder: ISO 27001 surveillance audit is due. Shall we plan dates?', 'queued'),
    ((select client_id from public.engagements where id = e_arjun), e_arjun, '+91 90000 00005', 'meeting_followup', 'Thanks for the call. Sharing the ML3 roadmap by email today.', 'queued'),
    ((select client_id from public.engagements where id = e_lotus), e_lotus, '+91 90000 00004', 'audit_window', 'SOC 2 report window opens next month.', 'queued');

  insert into public.voice_calls (client_id, engagement_id, owner_id, called_at, duration_sec, outcome, booked_slot, summary) values
    ((select client_id from public.engagements where id = e_arjun), e_arjun, v_owner2, '2026-09-12 10:30+05:30', 1500, 'Requested Proposal', null, 'Discovery call: ML3 by March; proposal requested.'),
    ((select client_id from public.engagements where id = e_sahyadri), e_sahyadri, v_owner1, '2026-09-15 16:00+05:30', 0, 'No Answer', null, 'No answer; left voicemail.'),
    ((select client_id from public.engagements where id = e_bright_cmmi), e_bright_cmmi, v_owner2, '2026-09-22 11:00+05:30', 600, 'Meeting Booked', '01-Oct-2026 11:30 IST', 'Readiness review booked.');

  -- One sent email in a thread (test provider), opened, so the Client 360 email tab has history
  insert into public.email_threads (engagement_id, client_id, owner_id, subject)
  values (e_arjun, (select client_id from public.engagements where id = e_arjun), v_owner2,
    'CMMI ML3 roadmap — Arjun Fintech')
  returning id into v_thread;

  insert into public.email_messages (thread_id, engagement_id, client_id, direction, sender_id, approved_by,
    from_email, to_email, subject, body, provider, sent_at, opened_at, open_count)
  values (v_thread, e_arjun, (select client_id from public.engagements where id = e_arjun), 'outbound',
    v_owner2, v_owner2, 'demo.owner2@example.com',
    coalesce((select c.email from public.clients c join public.engagements e on e.client_id = c.id where e.id = e_arjun), 'cto@example.com'),
    'CMMI ML3 roadmap — Arjun Fintech',
    'Hi, as discussed on 12 Sep, here is the ML3 roadmap. Would Thursday 11:30 IST work to walk through it?',
    'test', '2026-09-13 09:40+05:30', '2026-09-13 14:05+05:30', 2)
  returning id into v_msg;
end
$$;
