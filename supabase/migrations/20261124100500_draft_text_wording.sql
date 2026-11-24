-- Draft wording fixes found when running the engine for 29-Sep-2026 (Test Notes date):
--   1. "Hi Dr.," / "Hi Col.,": skip a leading title and greet by the first name.
--   2. Overdue renewals said the audit "falls on" a past date: now "was due on".
--   3. The meeting note was lower-cased whole ("cmmi ml3"): now only its first letter.

create or replace function app.draft_text(p_engagement uuid, p_kind text, p_as_of date)
returns table (subject text, body text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e public.engagements%rowtype;
  v_c public.clients%rowtype;
  v_owner public.profiles%rowtype;
  v_note public.engagement_notes%rowtype;
  v_first text;
  v_cert text;
  v_ask text;
  v_due record;
  v_event text;
  v_summary text;
begin
  select * into v_e from public.engagements where id = p_engagement;
  select * into v_c from public.clients where id = v_e.client_id;
  select * into v_owner from public.profiles where id = v_e.owner_id;
  select * into v_note from public.engagement_notes n
    where n.engagement_id = p_engagement order by n.held_on desc, n.created_at desc limit 1;

  v_first := split_part(
    regexp_replace(btrim(coalesce(v_c.contact_person, '')),
      '^(dr|mr|mrs|ms|miss|prof|col|capt|lt|maj|gen|sri|shri|smt)\.?\s+', '', 'i'),
    ' ', 1);
  v_first := coalesce(nullif(v_first, ''), 'there');
  v_cert := coalesce(v_e.standard_framework, v_e.certification_type, 'certification');
  v_ask := case
    when v_owner.booking_link is not null
      then 'If easier, pick a slot here: ' || v_owner.booking_link
    else 'Would Thursday 11:30 IST or Friday 15:00 IST suit you for 20 minutes?'
  end;

  if p_kind = 'renewal' then
    select * into v_due from app.renewal_info(v_e.certification_type, v_e.surveillance_due_date,
      v_e.next_audit_date, v_e.valid_to, v_e.completion_date, p_as_of);
    v_event := lower(coalesce(v_due.event_kind, 'renewal'));
    subject := v_c.name || ' — ' || v_cert || ' ' || v_event || ' planning';
    body := 'Hi ' || v_first || ',' || E'\n\n'
      || case
        when v_due.due_date < p_as_of then
          'Your ' || v_cert || ' ' || v_event || ' was due on ' || to_char(v_due.due_date, 'DD-Mon-YYYY')
          || '. I''d like to help you get it scheduled before it affects your certification.'
        else
          'Your ' || v_cert || ' ' || v_event || ' falls on ' || to_char(v_due.due_date, 'DD-Mon-YYYY')
          || '. I''d like to plan the audit window early so it doesn''t clash with your release calendar.'
      end || E'\n\n'
      || v_ask || E'\n\n'
      || 'Regards,' || E'\n' || coalesce(nullif(v_owner.full_name, ''), 'SQAS');
  else
    v_summary := left(btrim(coalesce(v_note.summary, '')), 140);
    v_summary := lower(left(v_summary, 1)) || substr(v_summary, 2);
    subject := 'Re: ' || v_cert || ' — ' || v_c.name;
    body := 'Hi ' || v_first || ',' || E'\n\n'
      || case
        when v_note.id is not null then
          'When we spoke on ' || to_char(v_note.held_on, 'DD Mon') || ', you mentioned: '
          || rtrim(v_summary, '.') || '. '
        else 'Following up on our ' || v_cert || ' conversation. '
      end
      || 'Is this still a priority for this quarter?' || E'\n\n'
      || v_ask || E'\n\n'
      || 'Regards,' || E'\n' || coalesce(nullif(v_owner.full_name, ''), 'SQAS');
  end if;
  return next;
end;
$$;
