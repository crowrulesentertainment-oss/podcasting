-- CrowRules Podcasting — Creator Follow System 2.0
-- Project: cevylpnoexugwgygvtgu
-- Run once in the Supabase SQL Editor.

create table if not exists public.podcast_creator_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, creator_user_id),
  constraint podcast_creator_follows_no_self_follow check (follower_id <> creator_user_id)
);

create index if not exists podcast_creator_follows_creator_idx
  on public.podcast_creator_follows (creator_user_id, created_at desc);
create index if not exists podcast_creator_follows_follower_idx
  on public.podcast_creator_follows (follower_id, created_at desc);

alter table public.podcast_creator_follows enable row level security;
revoke all on public.podcast_creator_follows from anon, public;
grant select, insert, delete on public.podcast_creator_follows to authenticated;

drop policy if exists "Listeners can view their own creator follows" on public.podcast_creator_follows;
create policy "Listeners can view their own creator follows"
on public.podcast_creator_follows for select to authenticated
using (follower_id = (select auth.uid()));

drop policy if exists "Listeners can follow creators as themselves" on public.podcast_creator_follows;
create policy "Listeners can follow creators as themselves"
on public.podcast_creator_follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and creator_user_id <> (select auth.uid())
);

drop policy if exists "Listeners can unfollow creators as themselves" on public.podcast_creator_follows;
create policy "Listeners can unfollow creators as themselves"
on public.podcast_creator_follows for delete to authenticated
using (follower_id = (select auth.uid()));

-- Expose aggregate counts only; follower identities remain private.
create or replace view public.podcast_creator_follower_counts
with (security_barrier = true)
as
select creator_user_id, count(*)::bigint as follower_count
from public.podcast_creator_follows
group by creator_user_id;

grant select on public.podcast_creator_follower_counts to anon, authenticated;
