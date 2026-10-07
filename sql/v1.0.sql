-- CrowRules Podcasting V1.0 foundation. Run in Supabase SQL editor.
create extension if not exists pgcrypto;
create table if not exists public.podcasts(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,title text not null,description text default '',artwork_url text,created_at timestamptz not null default now());
create table if not exists public.episodes(id uuid primary key default gen_random_uuid(),podcast_id uuid not null references public.podcasts(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,title text not null,description text default '',audio_url text not null,image_url text,created_at timestamptz not null default now());
create table if not exists public.podcast_subscription_plans(id uuid primary key default gen_random_uuid(),podcast_id uuid not null references public.podcasts(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,name text not null,description text default '',price_cents integer not null check(price_cents>=100),stripe_price_id text,active boolean not null default true,created_at timestamptz not null default now());
alter table public.podcasts enable row level security; alter table public.episodes enable row level security; alter table public.podcast_subscription_plans enable row level security;
create policy "public read podcasts" on public.podcasts for select using (true);
create policy "owners create podcasts" on public.podcasts for insert with check(auth.uid()=owner_id);
create policy "owners update podcasts" on public.podcasts for update using(auth.uid()=owner_id);
create policy "public read episodes" on public.episodes for select using (true);
create policy "owners create episodes" on public.episodes for insert with check(auth.uid()=owner_id);
create policy "owners update episodes" on public.episodes for update using(auth.uid()=owner_id);
create policy "public read active plans" on public.podcast_subscription_plans for select using(active=true);
create policy "owners create plans" on public.podcast_subscription_plans for insert with check(auth.uid()=owner_id);
create policy "owners update plans" on public.podcast_subscription_plans for update using(auth.uid()=owner_id);
insert into storage.buckets(id,name,public) values('podcasting','podcasting',true) on conflict(id) do nothing;
-- Storage policies can be tightened later; V1.0 allows authenticated uploads to this bucket.
create policy "podcasting authenticated upload" on storage.objects for insert to authenticated with check(bucket_id='podcasting');
create policy "podcasting public read" on storage.objects for select using(bucket_id='podcasting');