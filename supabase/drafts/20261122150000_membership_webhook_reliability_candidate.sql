-- REVIEW-ONLY DRAFT. Do not apply to hosted Supabase.
-- Adds an idempotency ledger for Stripe membership webhook processing.
-- Production table names/columns were inspected read-only on 2026-11-22.

create table if not exists public.membership_stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  stripe_created_at bigint not null,
  status text not null check (status in ('processing','processed','failed')),
  attempts integer not null default 1 check (attempts > 0),
  lease_expires_at timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.membership_subscriptions
  add column if not exists last_stripe_event_created bigint;

create or replace function public.claim_membership_stripe_event(
  p_event_id text,
  p_event_type text,
  p_event_created bigint
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.membership_stripe_webhook_events%rowtype;
begin
  insert into public.membership_stripe_webhook_events (
    stripe_event_id, event_type, stripe_created_at, status, lease_expires_at
  ) values (
    p_event_id, p_event_type, p_event_created, 'processing', now() + interval '5 minutes'
  )
  on conflict (stripe_event_id) do nothing;

  if found then return 'claimed'; end if;

  select * into v_row
  from public.membership_stripe_webhook_events
  where stripe_event_id = p_event_id
  for update;

  if v_row.status = 'processed' then return 'processed'; end if;

  if v_row.status = 'processing'
     and v_row.lease_expires_at is not null
     and v_row.lease_expires_at > now() then
    return 'busy';
  end if;

  update public.membership_stripe_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      event_type = p_event_type,
      stripe_created_at = greatest(stripe_created_at, p_event_created),
      lease_expires_at = now() + interval '5 minutes',
      last_error = null,
      processed_at = null,
      updated_at = now()
  where stripe_event_id = p_event_id;

  return 'claimed';
end;
$$;

create or replace function public.finish_membership_stripe_event(
  p_event_id text,
  p_status text,
  p_error text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('processed','failed') then
    raise exception 'Invalid terminal webhook event status';
  end if;

  update public.membership_stripe_webhook_events
  set status = p_status,
      last_error = case when p_status = 'failed' then left(coalesce(p_error, 'Unknown error'), 2000) else null end,
      processed_at = case when p_status = 'processed' then now() else null end,
      lease_expires_at = null,
      updated_at = now()
  where stripe_event_id = p_event_id
    and status = 'processing';

  if not found then
    raise exception 'Webhook event was not claimed or is no longer processing';
  end if;
end;
$$;

revoke all on public.membership_stripe_webhook_events from public, anon, authenticated;
revoke all on function public.claim_membership_stripe_event(text,text,bigint) from public, anon, authenticated;
revoke all on function public.finish_membership_stripe_event(text,text,text) from public, anon, authenticated;
grant execute on function public.claim_membership_stripe_event(text,text,bigint) to service_role;
grant execute on function public.finish_membership_stripe_event(text,text,text) to service_role;

-- Corrected global membership synchronization: site-scoped subscriptions are excluded.
create or replace function public.sync_member_membership_from_subscription(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sub record;
  mtype text;
begin
  select ms.status, mp.plan_key
    into sub
  from public.membership_subscriptions ms
  join public.membership_plans mp on mp.id = ms.plan_id
  where ms.user_id = p_user_id
    and ms.site_key is null
  order by
    case when ms.status in ('active','pending') then 0 else 1 end,
    ms.created_at desc
  limit 1;

  if not found then
    update public.members
      set membership_type = 'Free', status = 'Active', updated_at = now()
    where user_id = p_user_id;
    return;
  end if;

  mtype := case sub.plan_key
    when 'founder' then 'Owner'
    when 'creator' then 'Creator'
    when 'crowner' then 'Pro'
    else 'Free'
  end;

  update public.members
    set membership_type = mtype,
        status = case when sub.status in ('active','pending') then 'Active' else 'Suspended' end,
        updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- Preserve the existing function's grants; do not broaden execute access here.
