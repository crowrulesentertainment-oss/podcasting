-- V4.1: historical podcast subscription lifecycle events
create table if not exists public.podcast_subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.podcast_subscriptions(id) on delete cascade,
  stripe_subscription_id text not null,
  user_id uuid not null,
  creator_id uuid not null,
  podcast_id uuid not null,
  from_product_id uuid,
  to_product_id uuid,
  event_type text not null check (event_type in ('started','plan_upgrade','plan_downgrade','plan_change','cancellation_scheduled','canceled','reactivated','status_change','renewed')),
  from_status text,
  to_status text,
  from_amount_cents integer,
  to_amount_cents integer,
  currency text default 'usd',
  stripe_event_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_podcast_subscription_events_creator_time on public.podcast_subscription_events(creator_id, occurred_at desc);
create index if not exists idx_podcast_subscription_events_subscription_time on public.podcast_subscription_events(stripe_subscription_id, occurred_at desc);
create index if not exists idx_podcast_subscription_events_podcast_time on public.podcast_subscription_events(podcast_id, occurred_at desc);
create unique index if not exists ux_podcast_subscription_events_stripe_event on public.podcast_subscription_events(stripe_event_id) where stripe_event_id is not null;
alter table public.podcast_subscription_events enable row level security;
drop policy if exists "creators can read own subscription events" on public.podcast_subscription_events;
create policy "creators can read own subscription events"
on public.podcast_subscription_events for select to authenticated
using ((select public.get_my_podcast_creator_id()) = creator_id);
