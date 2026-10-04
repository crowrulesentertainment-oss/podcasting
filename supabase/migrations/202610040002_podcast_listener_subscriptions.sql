alter table public.podcast_subscriptions add column if not exists creator_id uuid;
alter table public.podcast_subscriptions add column if not exists stripe_checkout_session_id text;
alter table public.podcast_subscriptions add column if not exists stripe_price_id text;
alter table public.podcast_subscriptions add column if not exists amount_cents integer;
alter table public.podcast_subscriptions add column if not exists currency text default 'usd';
create index if not exists podcast_subscriptions_stripe_sub_idx on public.podcast_subscriptions(stripe_subscription_id);
create index if not exists podcast_subscriptions_user_status_idx on public.podcast_subscriptions(user_id,status);
create index if not exists podcast_subscriptions_podcast_status_idx on public.podcast_subscriptions(podcast_id,status);