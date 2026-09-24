-- CrowRules Podcasting Stripe Connect + Creator Payouts 1.1
-- Uses the existing cr_podcast_payouts financial ledger and creator_monetization
-- tables already present in production. This migration adds the creator-scoped
-- Stripe Connect account state used by podcast creation/onboarding.

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

create index if not exists cr_podcast_stripe_accounts_user_idx
  on public.cr_podcast_stripe_accounts(user_id);

alter table public.cr_podcast_stripe_accounts enable row level security;

drop policy if exists "creators read own stripe connection"
on public.cr_podcast_stripe_accounts;

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

revoke all on table public.cr_podcast_stripe_accounts from anon;

comment on table public.cr_podcast_stripe_accounts
is 'Server-managed Stripe Connect account state for podcast creators; bank details remain with Stripe.';
