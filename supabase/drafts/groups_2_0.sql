-- CrowRules Podcasting Groups 2.0 — REVIEW DRAFT ONLY.
-- Do not apply to production until migration history has been reconciled,
-- this SQL is replayed locally, and the role-based test matrix passes.
-- Existing circle IDs, memberships, posts, events and profiles are preserved.
begin;

alter table public.podcast_community_circles
  add column if not exists avatar_image_path text,
  add column if not exists banner_image_path text;

alter table public.podcast_community_circle_posts
  add column if not exists post_type text not null default 'discussion',
  add column if not exists episode_url text,
  add column if not exists episode_title text,
  add column if not exists episode_artwork_url text,
  add column if not exists media_path text,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_locked boolean not null default false;

alter table public.podcast_community_circle_posts
  drop constraint if exists podcast_community_circle_posts_post_type_check;
alter table public.podcast_community_circle_posts
  add constraint podcast_community_circle_posts_post_type_check
  check (post_type in ('discussion','episode','question','announcement','media'));

create index if not exists podcast_circle_posts_feed_v2_idx
  on public.podcast_community_circle_posts(circle_id, is_pinned desc, created_at desc)
  where deleted_at is null;

create table if not exists public.podcast_community_circle_image_suggestions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  image_kind text not null check (image_kind in ('avatar','banner')),
  object_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  unique (circle_id, object_path)
);
create index if not exists podcast_circle_image_suggestions_review_idx
  on public.podcast_community_circle_image_suggestions(circle_id,status,created_at desc);
alter table public.podcast_community_circle_image_suggestions enable row level security;
revoke all on public.podcast_community_circle_image_suggestions from public,anon,authenticated;
grant select,insert,update,delete on public.podcast_community_circle_image_suggestions to authenticated;
drop policy if exists "Members submit group image suggestions" on public.podcast_community_circle_image_suggestions;
drop policy if exists "Submitters and moderators view image suggestions" on public.podcast_community_circle_image_suggestions;
drop policy if exists "Moderators review group image suggestions" on public.podcast_community_circle_image_suggestions;
drop policy if exists "Submitters withdraw pending suggestions" on public.podcast_community_circle_image_suggestions;
revoke update on public.podcast_community_circle_image_suggestions from authenticated;
grant update (status,reviewed_by,reviewed_at) on public.podcast_community_circle_image_suggestions to authenticated;
create policy "Members submit group image suggestions"
on public.podcast_community_circle_image_suggestions for insert to authenticated
with check (submitted_by=(select auth.uid()) and status='pending' and private.crowspace_is_circle_member(circle_id));
create policy "Submitters and moderators view image suggestions"
on public.podcast_community_circle_image_suggestions for select to authenticated
using (submitted_by=(select auth.uid()) or private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl());
create policy "Moderators review group image suggestions"
on public.podcast_community_circle_image_suggestions for update to authenticated
using (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl())
with check (status='rejected' and reviewed_by=(select auth.uid()) and (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl()));
create policy "Submitters withdraw pending suggestions"
on public.podcast_community_circle_image_suggestions for delete to authenticated
using ((submitted_by=(select auth.uid()) and status='pending') or private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl());

create table if not exists public.podcast_community_circle_reports (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
  post_id uuid not null references public.podcast_community_circle_posts(id) on delete cascade,
  reported_by uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 5 and 1000),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
create index if not exists podcast_circle_reports_open_idx on public.podcast_community_circle_reports(circle_id,status,created_at);
alter table public.podcast_community_circle_reports enable row level security;
revoke all on public.podcast_community_circle_reports from public,anon,authenticated;
grant select,insert,update on public.podcast_community_circle_reports to authenticated;
drop policy if exists "Members report posts in their circle" on public.podcast_community_circle_reports;
drop policy if exists "Circle moderators review reports" on public.podcast_community_circle_reports;
drop policy if exists "Circle moderators close reports" on public.podcast_community_circle_reports;
revoke update on public.podcast_community_circle_reports from authenticated;
grant update (status,reviewed_by,reviewed_at) on public.podcast_community_circle_reports to authenticated;
create policy "Members report posts in their circle"
on public.podcast_community_circle_reports for insert to authenticated
with check (reported_by=(select auth.uid()) and exists (
  select 1 from public.podcast_community_circle_posts p
  where p.id=post_id and p.circle_id=podcast_community_circle_reports.circle_id
) and private.crowspace_is_circle_member(circle_id));
create policy "Circle moderators review reports"
on public.podcast_community_circle_reports for select to authenticated
using (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl());
create policy "Circle moderators close reports"
on public.podcast_community_circle_reports for update to authenticated
using (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl())
with check (status='closed' and reviewed_by=(select auth.uid()) and (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl()));

-- Moderators can edit/pin/lock posts in their own circle; authors retain existing
-- edit/delete policy. Existing delete policy already permits circle moderators.
drop policy if exists "Circle moderators manage posts" on public.podcast_community_circle_posts;
create policy "Circle moderators manage posts"
on public.podcast_community_circle_posts for update to authenticated
using (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl())
with check (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl());

-- Group owners may delete only circles they own. Child data follows the
-- existing FK cascade rules; the UI warns before the irreversible action.
drop policy if exists "Circle owners delete their circles" on public.podcast_community_circles;
create policy "Circle owners delete their circles"
on public.podcast_community_circles for delete to authenticated
using (owner_id=(select auth.uid()) or private.crowrules_is_admin_impl());

-- Keep post updates column-scoped: authors can edit text and moderators can
-- additionally pin/lock, but clients cannot reassign author_id or circle_id.
revoke update on public.podcast_community_circle_posts from authenticated;
grant update (body,edited_at,is_pinned,is_locked) on public.podcast_community_circle_posts to authenticated;

-- Moderators can see the roster for their own circle. Members retain the
-- existing self-membership visibility policy.
drop policy if exists "Circle moderators can view roster" on public.podcast_community_circle_members;
create policy "Circle moderators can view roster"
on public.podcast_community_circle_members for select to authenticated
using (private.crowspace_is_circle_moderator_or_owner(circle_id) or private.crowrules_is_admin_impl());

-- Repair the known reply/post circle correlation defect before enabling replies
-- in Groups 2.0. Each reply must reference a post in the same circle.
drop policy if exists "Circle members can reply" on public.podcast_community_circle_replies;
create policy "Circle members can reply"
on public.podcast_community_circle_replies for insert to authenticated
with check (author_id=(select auth.uid())
  and private.crowspace_is_circle_member(circle_id)
  and exists (select 1 from public.podcast_community_circle_posts p
    where p.id=podcast_community_circle_replies.post_id
      and p.circle_id=podcast_community_circle_replies.circle_id
      and p.is_locked is not true));
drop policy if exists "Replies visible wherever the parent post is visible"
on public.podcast_community_circle_replies;
create policy "Replies visible wherever the parent post is visible"
on public.podcast_community_circle_replies for select to authenticated
using (exists (select 1 from public.podcast_community_circle_posts p
  where p.id=podcast_community_circle_replies.post_id
    and p.circle_id=podcast_community_circle_replies.circle_id));

-- Create a private media bucket. Object names are <circle UUID>/<user UUID>/<file>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('podcast-group-media','podcast-group-media',false,8388608,
  array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=false,file_size_limit=8388608,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Group members upload their own group media" on storage.objects;
drop policy if exists "Group members read group media" on storage.objects;
drop policy if exists "Owners and moderators delete group media" on storage.objects;
create policy "Group members upload their own group media"
on storage.objects for insert to authenticated
with check (bucket_id='podcast-group-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2]=(select auth.uid())::text
  and private.crowspace_is_circle_member(((storage.foldername(name))[1])::uuid));
create policy "Group members read group media"
on storage.objects for select to authenticated
using (bucket_id='podcast-group-media'
  and private.crowspace_is_circle_member(((storage.foldername(name))[1])::uuid));
create policy "Owners and moderators delete group media"
on storage.objects for delete to authenticated
using (bucket_id='podcast-group-media'
  and (private.crowspace_is_circle_moderator_or_owner(((storage.foldername(name))[1])::uuid)
       or owner_id=(select auth.uid())::text));

-- Apply approved member artwork through a narrowly scoped private RPC.
create or replace function private.apply_podcast_circle_image_suggestion(p_suggestion_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog
as $function$
declare v_circle_id uuid; v_kind text; v_path text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select s.circle_id,s.image_kind,s.object_path into v_circle_id,v_kind,v_path
  from public.podcast_community_circle_image_suggestions s
  where s.id=p_suggestion_id and s.status='pending' for update;
  if not found then raise exception 'Pending image suggestion not found' using errcode='P0002'; end if;
  if not (private.crowspace_is_circle_moderator_or_owner(v_circle_id) or private.crowrules_is_admin_impl()) then
    raise exception 'Not authorized to approve group artwork' using errcode='42501';
  end if;
  if v_kind='avatar' then update public.podcast_community_circles set avatar_image_path=v_path where id=v_circle_id;
  elsif v_kind='banner' then update public.podcast_community_circles set banner_image_path=v_path where id=v_circle_id;
  else raise exception 'Unsupported group image kind' using errcode='22023'; end if;
  update public.podcast_community_circle_image_suggestions set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=p_suggestion_id;
end;
$function$;
revoke all on function private.apply_podcast_circle_image_suggestion(uuid) from public,anon,authenticated;
grant execute on function private.apply_podcast_circle_image_suggestion(uuid) to authenticated;
create or replace function public.apply_podcast_circle_image_suggestion(p_suggestion_id uuid)
returns void language sql security invoker set search_path = ''
as $function$ select private.apply_podcast_circle_image_suggestion($1); $function$;
revoke all on function public.apply_podcast_circle_image_suggestion(uuid) from public,anon,authenticated;
grant execute on function public.apply_podcast_circle_image_suggestion(uuid) to authenticated;

comment on table public.podcast_community_circle_image_suggestions is
  'Member-submitted group avatars and banners awaiting owner or moderator review.';
comment on table public.podcast_community_circle_reports is
  'Member reports of group posts; review is restricted to the same group owner/moderator or platform admin.';
commit;

-- IMPORTANT: This is a draft, not a production migration. Test anon/member/author/
-- moderator/owner/admin identities, storage object paths, cross-circle isolation,
-- group deletion cascade behavior, and replies against a recovered local migration chain.
