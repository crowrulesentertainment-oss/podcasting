-- CrowRules Podcasting Reviews foundation
-- Phase 1: show-level star ratings and written reviews.
-- Later-phase tables are created now so episode reviews, creator replies, helpful votes,
-- reports, reviewer badges and awards can be added without redesigning the core model.
-- Existing podcast_reviews rows and podcast_episode_ratings are preserved.

alter table public.podcast_reviews
  add column if not exists title text,
  add column if not exists status text not null default 'published',
  add column if not exists moderation_reason text,
  add column if not exists featured_at timestamptz;
alter table public.podcast_reviews drop constraint if exists podcast_reviews_status_check;
alter table public.podcast_reviews add constraint podcast_reviews_status_check
  check (status in ('published','pending','hidden','removed'));
alter table public.podcast_reviews drop constraint if exists podcast_reviews_title_length_check;
alter table public.podcast_reviews add constraint podcast_reviews_title_length_check
  check (title is null or char_length(title) between 1 and 120);
alter table public.podcast_reviews drop constraint if exists podcast_reviews_body_length_check;
alter table public.podcast_reviews add constraint podcast_reviews_body_length_check
  check (body is null or char_length(body) between 1 and 3000);
create index if not exists podcast_reviews_public_feed_idx on public.podcast_reviews(podcast_id,created_at desc) where status='published';
create index if not exists podcast_reviews_user_idx on public.podcast_reviews(user_id,updated_at desc);

drop policy if exists "Public can read podcast reviews" on public.podcast_reviews;
drop policy if exists "Users manage own podcast reviews" on public.podcast_reviews;
drop policy if exists "Public can read published podcast reviews" on public.podcast_reviews;
drop policy if exists "Members can read their own podcast reviews" on public.podcast_reviews;
drop policy if exists "Creators can read reviews for their shows" on public.podcast_reviews;
drop policy if exists "Members can submit published podcast reviews" on public.podcast_reviews;
drop policy if exists "Members can update their own published podcast reviews" on public.podcast_reviews;
drop policy if exists "Members can delete their own podcast reviews" on public.podcast_reviews;
drop policy if exists "CrowRules admins manage podcast reviews" on public.podcast_reviews;

create policy "Public can read published podcast reviews" on public.podcast_reviews for select to anon,authenticated using(status='published');
create policy "Members can read their own podcast reviews" on public.podcast_reviews for select to authenticated using((select auth.uid())=user_id);
create policy "Creators can read reviews for their shows" on public.podcast_reviews for select to authenticated using(private.can_manage_podcast(podcast_id));
create policy "Members can submit published podcast reviews" on public.podcast_reviews for insert to authenticated with check(
 (select auth.uid())=user_id and status='published' and title is not null
 and char_length(trim(title)) between 1 and 120 and body is not null
 and char_length(trim(body)) between 1 and 3000);
create policy "Members can update their own published podcast reviews" on public.podcast_reviews for update to authenticated
 using((select auth.uid())=user_id and status='published')
 with check((select auth.uid())=user_id and status='published' and title is not null
 and char_length(trim(title)) between 1 and 120 and body is not null and char_length(trim(body)) between 1 and 3000);
create policy "Members can delete their own podcast reviews" on public.podcast_reviews for delete to authenticated using((select auth.uid())=user_id);
create policy "CrowRules admins manage podcast reviews" on public.podcast_reviews for all to authenticated
 using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());

create table if not exists public.podcast_episode_reviews(
 id uuid primary key default gen_random_uuid(),
 episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5),
 title text not null check(char_length(trim(title)) between 1 and 120),
 body text not null check(char_length(trim(body)) between 1 and 3000),
 status text not null default 'published' check(status in('published','pending','hidden','removed')),
 moderation_reason text, featured_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(episode_id,user_id));
create index if not exists podcast_episode_reviews_public_feed_idx on public.podcast_episode_reviews(episode_id,created_at desc) where status='published';

create table if not exists public.podcast_review_replies(
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null unique references public.podcast_reviews(id) on delete cascade,
 creator_user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 status text not null default 'published' check(status in('published','hidden')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.podcast_episode_review_replies(
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null unique references public.podcast_episode_reviews(id) on delete cascade,
 creator_user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 2000),
 status text not null default 'published' check(status in('published','hidden')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table if not exists public.podcast_review_votes(
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.podcast_reviews(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), unique(review_id,user_id));
create table if not exists public.podcast_episode_review_votes(
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.podcast_episode_reviews(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), unique(review_id,user_id));

create table if not exists public.podcast_review_reports(
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.podcast_reviews(id) on delete cascade,
 reporter_user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in('spam','harassment','hate','misinformation','conflict_of_interest','other')),
 details text check(details is null or char_length(details)<=1500),
 status text not null default 'new' check(status in('new','reviewing','actioned','dismissed')),
 moderator_note text, created_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id));
create table if not exists public.podcast_episode_review_reports(
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.podcast_episode_reviews(id) on delete cascade,
 reporter_user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in('spam','harassment','hate','misinformation','conflict_of_interest','other')),
 details text check(details is null or char_length(details)<=1500),
 status text not null default 'new' check(status in('new','reviewing','actioned','dismissed')),
 moderator_note text, created_at timestamptz not null default now(),
 reviewed_at timestamptz, reviewed_by uuid references auth.users(id));

create table if not exists public.podcast_review_badge_catalog(
 badge_key text primary key, name text not null, description text not null,
 icon text not null default '⭐', is_active boolean not null default true,
 created_at timestamptz not null default now());
create table if not exists public.podcast_review_badge_awards(
 id uuid primary key default gen_random_uuid(),
 badge_key text not null references public.podcast_review_badge_catalog(badge_key),
 user_id uuid not null references auth.users(id) on delete cascade,
 review_id uuid references public.podcast_reviews(id) on delete set null,
 awarded_at timestamptz not null default now(), note text, is_public boolean not null default true,
 unique(badge_key,user_id));

alter table public.podcast_episode_reviews enable row level security;
alter table public.podcast_review_replies enable row level security;
alter table public.podcast_episode_review_replies enable row level security;
alter table public.podcast_review_votes enable row level security;
alter table public.podcast_episode_review_votes enable row level security;
alter table public.podcast_review_reports enable row level security;
alter table public.podcast_episode_review_reports enable row level security;
alter table public.podcast_review_badge_catalog enable row level security;
alter table public.podcast_review_badge_awards enable row level security;

-- Supabase's Data API no longer exposes newly created public tables automatically.
grant select on public.podcast_reviews to anon,authenticated;
grant select,insert,update,delete on public.podcast_reviews to authenticated;
grant select on public.podcast_episode_reviews to anon,authenticated;
grant select,insert,update,delete on public.podcast_episode_reviews to authenticated;
grant select on public.podcast_review_replies,public.podcast_episode_review_replies to anon,authenticated;
grant select,insert,update,delete on public.podcast_review_replies,public.podcast_episode_review_replies to authenticated;
grant select,insert,delete on public.podcast_review_votes,public.podcast_episode_review_votes to authenticated;
grant select,insert,update on public.podcast_review_reports,public.podcast_episode_review_reports to authenticated;
grant select on public.podcast_review_badge_catalog,public.podcast_review_badge_awards to anon,authenticated;
grant insert,update,delete on public.podcast_review_badge_catalog,public.podcast_review_badge_awards to authenticated;

create policy "Public can read published episode reviews" on public.podcast_episode_reviews for select to anon,authenticated using(status='published');
create policy "Members can read their own episode reviews" on public.podcast_episode_reviews for select to authenticated using((select auth.uid())=user_id);
create policy "Creators can read episode reviews for their shows" on public.podcast_episode_reviews for select to authenticated using(
 exists(select 1 from public.podcast_episodes e where e.id=episode_id and private.can_manage_podcast(e.podcast_id)));
create policy "Members can submit published episode reviews" on public.podcast_episode_reviews for insert to authenticated with check(
 (select auth.uid())=user_id and status='published' and exists(
 select 1 from public.podcast_episodes e join public.podcasts p on p.id=e.podcast_id
 where e.id=episode_id and e.status='published' and p.status='published'));
create policy "Members can update their own episode reviews" on public.podcast_episode_reviews for update to authenticated
 using((select auth.uid())=user_id and status='published') with check((select auth.uid())=user_id and status='published');
create policy "Members can delete their own episode reviews" on public.podcast_episode_reviews for delete to authenticated using((select auth.uid())=user_id);
create policy "CrowRules admins manage episode reviews" on public.podcast_episode_reviews for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());

create policy "Public can read published show review replies" on public.podcast_review_replies for select to anon,authenticated using(status='published');
create policy "Creators can read replies for their shows" on public.podcast_review_replies for select to authenticated using(
 exists(select 1 from public.podcast_reviews r where r.id=review_id and private.can_manage_podcast(r.podcast_id)));
create policy "Creators can write replies for their shows" on public.podcast_review_replies for insert to authenticated with check(
 creator_user_id=(select auth.uid()) and status='published' and exists(
 select 1 from public.podcast_reviews r where r.id=review_id and private.can_manage_podcast(r.podcast_id)));
create policy "Creators can update their own show review replies" on public.podcast_review_replies for update to authenticated
 using(creator_user_id=(select auth.uid()) and exists(select 1 from public.podcast_reviews r where r.id=review_id and private.can_manage_podcast(r.podcast_id)))
 with check(creator_user_id=(select auth.uid()) and status='published' and exists(select 1 from public.podcast_reviews r where r.id=review_id and private.can_manage_podcast(r.podcast_id)));
create policy "Creators can delete their own show review replies" on public.podcast_review_replies for delete to authenticated
 using(creator_user_id=(select auth.uid()) and exists(select 1 from public.podcast_reviews r where r.id=review_id and private.can_manage_podcast(r.podcast_id)));
create policy "Admins manage show review replies" on public.podcast_review_replies for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());

create policy "Public can read published episode review replies" on public.podcast_episode_review_replies for select to anon,authenticated using(status='published');
create policy "Creators can read episode review replies" on public.podcast_episode_review_replies for select to authenticated using(
 exists(select 1 from public.podcast_episode_reviews r join public.podcast_episodes e on e.id=r.episode_id where r.id=review_id and private.can_manage_podcast(e.podcast_id)));
create policy "Creators can write episode review replies" on public.podcast_episode_review_replies for insert to authenticated with check(
 creator_user_id=(select auth.uid()) and status='published' and exists(
 select 1 from public.podcast_episode_reviews r join public.podcast_episodes e on e.id=r.episode_id
 where r.id=review_id and private.can_manage_podcast(e.podcast_id)));
create policy "Creators can update episode review replies" on public.podcast_episode_review_replies for update to authenticated
 using(creator_user_id=(select auth.uid()) and exists(select 1 from public.podcast_episode_reviews r join public.podcast_episodes e on e.id=r.episode_id where r.id=review_id and private.can_manage_podcast(e.podcast_id)))
 with check(creator_user_id=(select auth.uid()) and status='published' and exists(select 1 from public.podcast_episode_reviews r join public.podcast_episodes e on e.id=r.episode_id where r.id=review_id and private.can_manage_podcast(e.podcast_id)));
create policy "Creators can delete episode review replies" on public.podcast_episode_review_replies for delete to authenticated
 using(creator_user_id=(select auth.uid()) and exists(select 1 from public.podcast_episode_reviews r join public.podcast_episodes e on e.id=r.episode_id where r.id=review_id and private.can_manage_podcast(e.podcast_id)));
create policy "Admins manage episode review replies" on public.podcast_episode_review_replies for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());

create policy "Members manage own show review votes" on public.podcast_review_votes for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "Members manage own episode review votes" on public.podcast_episode_review_votes for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "Members submit show review reports" on public.podcast_review_reports for insert to authenticated with check((select auth.uid())=reporter_user_id);
create policy "Members read their show review reports" on public.podcast_review_reports for select to authenticated using((select auth.uid())=reporter_user_id);
create policy "Admins manage show review reports" on public.podcast_review_reports for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());
create policy "Members submit episode review reports" on public.podcast_episode_review_reports for insert to authenticated with check((select auth.uid())=reporter_user_id);
create policy "Members read their episode review reports" on public.podcast_episode_review_reports for select to authenticated using((select auth.uid())=reporter_user_id);
create policy "Admins manage episode review reports" on public.podcast_episode_review_reports for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());
create policy "Public can read active review badges" on public.podcast_review_badge_catalog for select to anon,authenticated using(is_active=true);
create policy "Admins manage review badge catalog" on public.podcast_review_badge_catalog for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());
create policy "Public can read public review badge awards" on public.podcast_review_badge_awards for select to anon,authenticated using(is_public=true);
create policy "Members can read their own review badge awards" on public.podcast_review_badge_awards for select to authenticated using((select auth.uid())=user_id);
create policy "Admins manage review badge awards" on public.podcast_review_badge_awards for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());
