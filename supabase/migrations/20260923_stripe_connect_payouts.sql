-- CrowRules Podcasting Stripe Connect + Creator Payouts 1.0
-- Creates the server-owned Stripe Connect account and payout ledger used by creator onboarding.
-- Financial writes are performed by Edge Functions/webhooks only.

create table if not exists public.cr_podcast_stripe_accounts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references public.creators(id) on delete cascade,
  user_id uuid not null,
  stripe_account_id text not null unique,
  account_type text not null default 'express',
  onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending','submitted','enabled','restricted')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  country text,
  default_currency text,
  requirements_due jsonb not null default '[]'::jsonb,
  requirements_currently_due jsonb not null default '[]'::jsonb,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cr_podcast_payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  stripe_account_id text not null,
  stripe_payout_id text not null unique,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending','in_transit','paid','failed','canceled')),
  arrival_date timestamptz,
  paid_at timestamptz,
  failure_code text,
  failure_message text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cr_podcast_stripe_accounts_user_idx
  on public.cr_podcast_stripe_accounts(user_id);

create index if not exists cr_podcast_payouts_creator_idx
  on public.cr_podcast_payouts(creator_id, created_at desc);

alter table public.cr_podcast_stripe_accounts enable row level security;
alter table public.cr_podcast_payouts enable row level security;

drop policy if exists "creators read own stripe connection" on public.cr_podcast_stripe_accounts;
create policy "creators read own stripe connection"
on public.cr_podcast_stripe_accounts
for select to authenticated
using (
  creator_id in (
    select c.id
    from public.creators c
    join public.members m on m.id = c.member_id
    where m.user_id = (select auth.uid())
  )
);

drop policy if exists "creators read own payouts" on public.cr_podcast_payouts;
create policy "creators read own payouts"
on public.cr_podcast_payouts
for select to authenticated
using (
  creator_id in (
    select c.id
    from public.creators c
    join public.members m on m.id = c.member_id
    where m.user_id = (select auth.uid())
  )
);

revoke all on table public.cr_podcast_stripe_accounts from anon;
revoke all on table public.cr_podcast_payouts from anon;

create or replace function public.get_my_podcast_payout_summary()
returns table(
  available_cents bigint,
  pending_cents bigint,
  paid_cents bigint,
  failed_cents bigint,
  currency text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select c.id as creator_id
    from public.creators c
    join public.members m on m.id = c.member_id
    where m.user_id = auth.uid()
    limit 1
  )
  select
    coalesce(sum(case when p.status in ('pending','in_transit') then p.amount_cents else 0 end),0)::bigint,
    coalesce(sum(case when p.status = 'pending' then p.amount_cents else 0 end),0)::bigint,
    coalesce(sum(case when p.status = 'paid' then p.amount_cents else 0 end),0)::bigint,
    coalesce(sum(case when p.status = 'failed' then p.amount_cents else 0 end),0)::bigint,
    coalesce(max(p.currency),'usd')
  from public.cr_podcast_payouts p
  join me on me.creator_id = p.creator_id;
$$;

create or replace function public.get_my_podcast_payout_center()
returns table(
  id uuid,
  external_reference text,
  external_payout_id text,
  amount_cents bigint,
  currency text,
  status text,
  scheduled_for timestamptz,
  paid_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.external_reference,
         p.stripe_payout_id,
         p.amount_cents,
         p.currency,
         p.status,
         p.arrival_date,
         p.paid_at
  from public.cr_podcast_payouts p
  join public.creators c on c.id = p.creator_id
  join public.members m on m.id = c.member_id
  where m.user_id = auth.uid()
  order by p.created_at desc
  limit 200;
$$;

revoke all on function public.get_my_podcast_payout_summary() from public, anon;
grant execute on function public.get_my_podcast_payout_summary() to authenticated;
revoke all on function public.get_my_podcast_payout_center() from public, anon;
grant execute on function public.get_my_podcast_payout_center() to authenticated;

comment on table public.cr_podcast_stripe_accounts is 'Server-managed Stripe Connect account state for podcast creators.';
comment on table public.cr_podcast_payouts is 'Server-managed Stripe payout events for podcast creators.';
