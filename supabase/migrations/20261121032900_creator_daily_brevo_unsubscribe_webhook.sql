create table if not exists public.podcast_creator_daily_brevo_webhook_events (
  event_key text primary key,
  provider text not null default 'brevo',
  event_type text not null check (event_type = 'unsubscribe'),
  recipient_email_sha256 text not null,
  event_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  matched_user_id uuid references auth.users(id) on delete set null,
  processing_result text not null default 'received'
    check (processing_result in ('received','matched_unsubscribed','unmatched','stale_event'))
);

create index if not exists podcast_creator_daily_brevo_events_user_idx
  on public.podcast_creator_daily_brevo_webhook_events (matched_user_id, event_at desc)
  where matched_user_id is not null;

alter table public.podcast_creator_daily_brevo_webhook_events enable row level security;
revoke all on public.podcast_creator_daily_brevo_webhook_events from public, anon, authenticated;
grant all on public.podcast_creator_daily_brevo_webhook_events to service_role;

create or replace function public.apply_creator_daily_brevo_unsubscribe(
  p_event_key text,
  p_email text,
  p_email_sha256 text,
  p_event_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_updated_user_id uuid;
begin
  if p_event_key is null or length(p_event_key) < 32
     or p_email is null or length(trim(p_email)) = 0
     or p_email_sha256 is null or length(p_email_sha256) <> 64
     or p_event_at is null then
    raise exception 'Invalid Brevo unsubscribe event.';
  end if;

  insert into public.podcast_creator_daily_brevo_webhook_events (
    event_key, event_type, recipient_email_sha256, event_at
  ) values (
    p_event_key, 'unsubscribe', lower(p_email_sha256), p_event_at
  )
  on conflict (event_key) do nothing;

  if not found then
    return pg_catalog.jsonb_build_object('ok', true, 'duplicate', true, 'matched', false);
  end if;

  select u.id into v_user_id
  from auth.users as u
  where pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
  limit 1;

  if v_user_id is null then
    update public.podcast_creator_daily_brevo_webhook_events
      set processed_at = now(), processing_result = 'unmatched'
      where event_key = p_event_key;
    return pg_catalog.jsonb_build_object('ok', true, 'duplicate', false, 'matched', false);
  end if;

  insert into public.podcast_creator_daily_consents as current_consent (
    user_id, consented, consent_source, unsubscribed_at, updated_at
  ) values (
    v_user_id, false, 'creator_daily_unsubscribe', p_event_at, p_event_at
  )
  on conflict (user_id) do update
    set consented = false,
        consent_source = 'creator_daily_unsubscribe',
        unsubscribed_at = excluded.unsubscribed_at,
        updated_at = excluded.updated_at
    where coalesce(current_consent.consent_at, '-infinity'::timestamptz) <= excluded.unsubscribed_at
      and (current_consent.unsubscribed_at is null
        or current_consent.unsubscribed_at < excluded.unsubscribed_at)
  returning user_id into v_updated_user_id;

  if v_updated_user_id is not null then
    insert into public.podcast_creator_daily_consent_events (
      user_id, event_type, event_source, event_at
    ) values (
      v_user_id, 'unsubscribe', 'brevo_marketing_webhook', p_event_at
    );
    update public.podcast_creator_daily_brevo_webhook_events
      set matched_user_id = v_user_id, processed_at = now(),
          processing_result = 'matched_unsubscribed'
      where event_key = p_event_key;
    return pg_catalog.jsonb_build_object('ok', true, 'duplicate', false, 'matched', true, 'unsubscribed', true);
  end if;

  update public.podcast_creator_daily_brevo_webhook_events
    set matched_user_id = v_user_id, processed_at = now(),
        processing_result = 'stale_event'
    where event_key = p_event_key;

  return pg_catalog.jsonb_build_object('ok', true, 'duplicate', false, 'matched', true, 'unsubscribed', false, 'stale_event', true);
end;
$$;

revoke all on function public.apply_creator_daily_brevo_unsubscribe(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_creator_daily_brevo_unsubscribe(text, text, text, timestamptz) to service_role;
