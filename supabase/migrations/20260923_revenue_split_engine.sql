-- CrowRules Podcasting Revenue Split Engine 15.0
create table if not exists public.cr_podcast_revenue_split_rules (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null unique references public.creators(id) on delete cascade,
  platform_fee_bps integer not null default 0 check (platform_fee_bps between 0 and 2500),
  creator_share_bps integer generated always as (10000-platform_fee_bps) stored,
  currency text not null default 'usd', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.cr_podcast_revenue_split_rules enable row level security;
create policy "creators read own revenue split" on public.cr_podcast_revenue_split_rules for select to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=(select auth.uid())));
revoke all on public.cr_podcast_revenue_split_rules from anon;

create table if not exists public.cr_podcast_revenue_splits (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.creators(id) on delete cascade,
 transaction_id uuid, stripe_checkout_session_id text unique, stripe_payment_intent_id text,
 gross_cents bigint not null default 0, stripe_fee_cents bigint not null default 0, platform_fee_cents bigint not null default 0,
 creator_net_cents bigint not null default 0, currency text not null default 'usd',
 status text not null default 'pending' check (status in ('pending','paid','refunded','disputed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.cr_podcast_revenue_splits enable row level security;
create policy "creators read own revenue splits" on public.cr_podcast_revenue_splits for select to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=(select auth.uid())));
revoke all on public.cr_podcast_revenue_splits from anon;

create or replace function public.get_my_podcast_revenue_split_summary()
returns table(gross_cents bigint,platform_fee_cents bigint,creator_net_cents bigint,paid_cents bigint,pending_cents bigint,currency text)
language sql security definer set search_path=public as $$
 select coalesce(sum(s.gross_cents),0)::bigint,coalesce(sum(s.platform_fee_cents),0)::bigint,
 coalesce(sum(s.creator_net_cents),0)::bigint,coalesce(sum(case when s.status='paid' then s.creator_net_cents else 0 end),0)::bigint,
 coalesce(sum(case when s.status='pending' then s.creator_net_cents else 0 end),0)::bigint,coalesce(max(s.currency),'usd')
 from public.cr_podcast_revenue_splits s join public.creators c on c.id=s.creator_id join public.members m on m.id=c.member_id where m.user_id=auth.uid();
$$;
revoke all on function public.get_my_podcast_revenue_split_summary() from public,anon;
grant execute on function public.get_my_podcast_revenue_split_summary() to authenticated;