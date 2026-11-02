-- CrowRules Podcasting: Creator & Listener Collaboration Studio
create table if not exists public.podcast_community_circle_collaborations (
 id uuid primary key default gen_random_uuid(),
 circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 content_type text not null check(content_type in ('topic','guest','question','feedback','poll')),
 title text not null check(char_length(title) between 4 and 140),
 body text not null check(char_length(body) between 4 and 3000),
 poll_options jsonb not null default '[]'::jsonb check(jsonb_typeof(poll_options)='array' and jsonb_array_length(poll_options)<=8),
 status text not null default 'submitted' check(status in ('submitted','under_review','approved','in_production','published','declined')),
 creator_response text not null default '' check(char_length(creator_response)<=2000),
 responded_by uuid references auth.users(id) on delete set null,
 responded_at timestamptz,
 episode_id uuid references public.podcast_episodes(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint collaboration_poll_options_valid check(content_type<>'poll' or jsonb_array_length(poll_options)>=2)
);
create index if not exists podcast_circle_collaborations_feed_idx on public.podcast_community_circle_collaborations(circle_id,created_at desc);
create index if not exists podcast_circle_collaborations_status_idx on public.podcast_community_circle_collaborations(circle_id,status,updated_at desc);
alter table public.podcast_community_circle_collaborations enable row level security;
revoke all on public.podcast_community_circle_collaborations from public,anon;
grant select,insert,update,delete on public.podcast_community_circle_collaborations to authenticated;
drop policy if exists circle_collaborations_select_members on public.podcast_community_circle_collaborations;
create policy circle_collaborations_select_members on public.podcast_community_circle_collaborations for select to authenticated
using(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaborations.circle_id and m.member_id=(select auth.uid())));
drop policy if exists circle_collaborations_insert_members on public.podcast_community_circle_collaborations;
create policy circle_collaborations_insert_members on public.podcast_community_circle_collaborations for insert to authenticated
with check(author_id=(select auth.uid()) and status='submitted' and creator_response='' and responded_by is null
 and exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaborations.circle_id and m.member_id=(select auth.uid())));
drop policy if exists circle_collaborations_author_update on public.podcast_community_circle_collaborations;
create policy circle_collaborations_author_update on public.podcast_community_circle_collaborations for update to authenticated
using(author_id=(select auth.uid()) and status='submitted')
with check(author_id=(select auth.uid()) and status='submitted' and creator_response='' and responded_by is null);
drop policy if exists circle_collaborations_moderator_update on public.podcast_community_circle_collaborations;
create policy circle_collaborations_moderator_update on public.podcast_community_circle_collaborations for update to authenticated
using(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaborations.circle_id and m.member_id=(select auth.uid()) and m.role in ('owner','moderator')))
with check(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaborations.circle_id and m.member_id=(select auth.uid()) and m.role in ('owner','moderator')));
drop policy if exists circle_collaborations_delete_author_or_mod on public.podcast_community_circle_collaborations;
create policy circle_collaborations_delete_author_or_mod on public.podcast_community_circle_collaborations for delete to authenticated
using((author_id=(select auth.uid()) and status='submitted') or exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaborations.circle_id and m.member_id=(select auth.uid()) and m.role in ('owner','moderator')));
create table if not exists public.podcast_community_circle_collaboration_votes (
 collaboration_id uuid not null references public.podcast_community_circle_collaborations(id) on delete cascade,
 circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
 voter_id uuid not null references auth.users(id) on delete cascade,
 choice text not null default 'support' check(char_length(choice)<=140),
 created_at timestamptz not null default now(),
 primary key(collaboration_id,voter_id)
);
create index if not exists podcast_circle_collaboration_votes_circle_idx on public.podcast_community_circle_collaboration_votes(circle_id,collaboration_id);
alter table public.podcast_community_circle_collaboration_votes enable row level security;
revoke all on public.podcast_community_circle_collaboration_votes from public,anon;
grant select,insert,delete on public.podcast_community_circle_collaboration_votes to authenticated;
drop policy if exists circle_collaboration_votes_select_members on public.podcast_community_circle_collaboration_votes;
create policy circle_collaboration_votes_select_members on public.podcast_community_circle_collaboration_votes for select to authenticated
using(exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaboration_votes.circle_id and m.member_id=(select auth.uid())));
drop policy if exists circle_collaboration_votes_insert_members on public.podcast_community_circle_collaboration_votes;
create policy circle_collaboration_votes_insert_members on public.podcast_community_circle_collaboration_votes for insert to authenticated
with check(voter_id=(select auth.uid())
 and exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaboration_votes.circle_id and m.member_id=(select auth.uid()))
 and exists(select 1 from public.podcast_community_circle_collaborations c where c.id=podcast_community_circle_collaboration_votes.collaboration_id and c.circle_id=podcast_community_circle_collaboration_votes.circle_id and c.author_id<>(select auth.uid()) and (c.content_type<>'poll' or c.poll_options @> jsonb_build_array(podcast_community_circle_collaboration_votes.choice))));
drop policy if exists circle_collaboration_votes_delete_own on public.podcast_community_circle_collaboration_votes;
create policy circle_collaboration_votes_delete_own on public.podcast_community_circle_collaboration_votes for delete to authenticated
using(voter_id=(select auth.uid()) and exists(select 1 from public.podcast_community_circle_members m where m.circle_id=podcast_community_circle_collaboration_votes.circle_id and m.member_id=(select auth.uid())));
