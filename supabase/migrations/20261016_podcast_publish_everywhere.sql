-- CrowRules Podcasting: Publish Everywhere distribution tables
-- Applied to project cevylpnoexugwgygvtgu.
create table if not exists public.podcast_distribution_accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 podcast_id uuid not null references public.podcasts(id) on delete cascade,
 platform text not null check (platform in ('facebook','instagram','tiktok','youtube','x','threads','crowrules')),
 account_label text, profile_url text,
 connection_status text not null default 'not_connected' check (connection_status in ('not_connected','pending','connected','expired','needs_review')),
 connection_method text not null default 'manual', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(user_id,podcast_id,platform)
);
create table if not exists public.podcast_distribution_posts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 podcast_id uuid not null references public.podcasts(id) on delete cascade,
 episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
 platform text not null check (platform in ('facebook','instagram','tiktok','youtube','x','threads','crowrules')),
 caption text not null default '',
 status text not null default 'draft' check (status in ('draft','approved','queued','manual_required','publishing','published','failed','cancelled')),
 scheduled_at timestamptz, external_post_url text, last_error text, approved_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,episode_id,platform)
);
create index if not exists podcast_distribution_posts_user_status_idx on public.podcast_distribution_posts(user_id,status,created_at desc);
create index if not exists podcast_distribution_posts_schedule_idx on public.podcast_distribution_posts(status,scheduled_at) where status='queued';
alter table public.podcast_distribution_accounts enable row level security;
alter table public.podcast_distribution_posts enable row level security;
create policy "Creators manage own distribution accounts" on public.podcast_distribution_accounts for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.podcasts p join public.creators c on c.id=p.creator_id join public.members m on m.id=c.member_id where p.id=podcast_id and m.user_id=auth.uid()))
 with check (user_id=auth.uid() and exists(select 1 from public.podcasts p join public.creators c on c.id=p.creator_id join public.members m on m.id=c.member_id where p.id=podcast_id and m.user_id=auth.uid()));
create policy "Creators manage own distribution posts" on public.podcast_distribution_posts for all to authenticated
 using (user_id=auth.uid() and exists(select 1 from public.podcasts p join public.creators c on c.id=p.creator_id join public.members m on m.id=c.member_id where p.id=podcast_id and m.user_id=auth.uid()))
 with check (user_id=auth.uid() and exists(select 1 from public.podcasts p join public.creators c on c.id=p.creator_id join public.members m on m.id=c.member_id where p.id=podcast_id and m.user_id=auth.uid())
 and exists(select 1 from public.podcast_episodes e where e.id=episode_id and e.podcast_id=podcast_id));
grant select,insert,update,delete on public.podcast_distribution_accounts, public.podcast_distribution_posts to authenticated;
