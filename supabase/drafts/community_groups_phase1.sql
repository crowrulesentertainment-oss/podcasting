-- CrowRules Podcasting — Community Groups Phase 1 foundation
-- DRAFT ONLY: this file has not been applied to production and is not yet in migration history.
-- Promote with: supabase migration new community_groups_phase1
-- Then move this SQL into the CLI-generated timestamped migration file.
--
-- Strategy:
--   * Extend the existing podcast_community_circles model; do not create a parallel groups system.
--   * Reuse existing circle members, posts, replies, invites, events, polls/collaborations,
--     activity, recognition, Podcasting member profiles, and direct messaging.
--   * Add only the missing group metadata, private join requests, and group chat messages.
--   * Preserve existing is_public behavior through a compatibility trigger.
--   * Keep all new private data behind RLS and explicit authenticated grants.

begin;

-- ---------------------------------------------------------------------------
-- 1. Extend existing circle records into the Community Groups product.
-- ---------------------------------------------------------------------------

alter table public.podcast_community_circles
  add column if not exists slug text,
  add column if not exists cover_image_url text,
  add column if not exists avatar_image_url text,
  add column if not exists visibility text not null default 'public',
  add column if not exists group_chat_enabled boolean not null default true;

-- Existing non-public circles were previously not discoverable. Preserve that
-- behavior by classifying them as hidden, not newly discoverable private groups.
update public.podcast_community_circles
set visibility = case when is_public then 'public' else 'hidden' end
where visibility is null
   or (visibility = 'public' and is_public = false);

-- Stable, collision-resistant slugs for existing records. The UUID suffix means
-- this backfill does not depend on name uniqueness.
update public.podcast_community_circles
set slug =
  coalesce(
    nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''),
    'community'
  ) || '-' || left(replace(id::text, '-', ''), 8)
where slug is null or btrim(slug) = '';

alter table public.podcast_community_circles
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.podcast_community_circles'::regclass
      and conname = 'podcast_community_circles_visibility_check'
  ) then
    alter table public.podcast_community_circles
      add constraint podcast_community_circles_visibility_check
      check (visibility in ('public', 'private', 'hidden'));
  end if;
end
$$;

create unique index if not exists podcast_community_circles_slug_uidx
  on public.podcast_community_circles (slug);

create index if not exists podcast_community_circles_visibility_created_idx
  on public.podcast_community_circles (visibility, created_at desc);

comment on column public.podcast_community_circles.visibility is
  'public = discoverable and public content; private = discoverable metadata with member-only content and approval; hidden = invitation-only.';
comment on column public.podcast_community_circles.group_chat_enabled is
  'Controls whether active circle members may read and send group chat messages.';

-- Keep legacy clients that only write is_public compatible with the new
-- visibility field. New clients should write visibility and may omit is_public.
create or replace function public.podcasting_prepare_community_circle_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_base_slug text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    v_base_slug := trim(both '-' from regexp_replace(lower(coalesce(new.name, '')), '[^a-z0-9]+', '-', 'g'));
    new.slug := coalesce(nullif(v_base_slug, ''), 'community')
      || '-' || left(replace(new.id::text, '-', ''), 8);
  end if;

  if new.visibility is null then
    new.visibility := case when new.is_public then 'public' else 'hidden' end;
  end if;

  if new.visibility = 'public' and new.is_public = false then
    -- Legacy insert that explicitly set is_public=false.
    new.visibility := 'hidden';
  else
    new.is_public := (new.visibility = 'public');
  end if;

  return new;
end;
$function$;

revoke all on function public.podcasting_prepare_community_circle_insert() from public, anon, authenticated;

create or replace function public.podcasting_sync_community_circle_visibility()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if new.visibility is distinct from old.visibility then
    new.is_public := (new.visibility = 'public');
  elsif new.is_public is distinct from old.is_public then
    new.visibility := case when new.is_public then 'public' else 'hidden' end;
  end if;

  return new;
end;
$function$;

revoke all on function public.podcasting_sync_community_circle_visibility() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'podcasting_prepare_community_circle_insert'
      and tgrelid = 'public.podcast_community_circles'::regclass
      and not tgisinternal
  ) then
    create trigger podcasting_prepare_community_circle_insert
      before insert on public.podcast_community_circles
      for each row
      execute function public.podcasting_prepare_community_circle_insert();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'podcasting_sync_community_circle_visibility'
      and tgrelid = 'public.podcast_community_circles'::regclass
      and not tgisinternal
  ) then
    create trigger podcasting_sync_community_circle_visibility
      before update of is_public, visibility on public.podcast_community_circles
      for each row
      execute function public.podcasting_sync_community_circle_visibility();
  end if;
end
$$;

-- Private groups may appear in discovery, but their posts, events, and chat
-- remain member-only. Hidden groups remain visible only under the existing
-- owner/member policy. This is additive; existing SELECT policies are retained.
drop policy if exists "podcasting_discoverable_community_groups" on public.podcast_community_circles;
create policy "podcasting_discoverable_community_groups"
on public.podcast_community_circles
for select
to anon, authenticated
using (visibility in ('public', 'private'));

-- ---------------------------------------------------------------------------
-- 2. Private-group join requests.
-- Public groups continue to use the existing self-join membership policy.
-- Hidden groups continue to use the existing invitation system.
-- ---------------------------------------------------------------------------

create table if not exists public.podcast_community_circle_join_requests (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

-- Keep one pending request per user/group while retaining declined history.
-- This lets a member reapply after a decline without deleting audit history.
create unique index if not exists podcast_circle_join_requests_one_pending_uidx
  on public.podcast_community_circle_join_requests (circle_id, user_id)
  where status = 'pending';

create index if not exists podcast_circle_join_requests_group_status_idx
  on public.podcast_community_circle_join_requests (circle_id, status, created_at desc);

create index if not exists podcast_circle_join_requests_user_status_idx
  on public.podcast_community_circle_join_requests (user_id, status, created_at desc);

alter table public.podcast_community_circle_join_requests enable row level security;

-- Do not inherit broad default Data API grants. Access is explicitly opt-in.
revoke all on table public.podcast_community_circle_join_requests from public, anon, authenticated;

grant select, insert, delete
  on table public.podcast_community_circle_join_requests to authenticated;
grant update (status, reviewed_at, reviewed_by)
  on table public.podcast_community_circle_join_requests to authenticated;

drop policy if exists "Circle join requests visible to requester and moderators" on public.podcast_community_circle_join_requests;
create policy "Circle join requests visible to requester and moderators"
on public.podcast_community_circle_join_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.crowspace_is_circle_moderator_or_owner(public.podcast_community_circle_join_requests.circle_id)
  or private.crowrules_is_admin_impl()
);

drop policy if exists "Members request access to private circles" on public.podcast_community_circle_join_requests;
create policy "Members request access to private circles"
on public.podcast_community_circle_join_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1
    from public.podcast_community_circles c
    where c.id = public.podcast_community_circle_join_requests.circle_id
      and c.visibility = 'private'
  )
  and not exists (
    select 1
    from public.podcast_community_circle_members m
    where m.circle_id = public.podcast_community_circle_join_requests.circle_id
      and m.member_id = (select auth.uid())
  )
);

drop policy if exists "Circle moderators review join requests" on public.podcast_community_circle_join_requests;
create policy "Circle moderators review join requests"
on public.podcast_community_circle_join_requests
for update
to authenticated
using (
  status = 'pending'
  and (
    private.crowspace_is_circle_moderator_or_owner(circle_id)
    or private.crowrules_is_admin_impl()
  )
)
with check (
  -- Direct table updates may only decline. Approval must use the atomic RPC below.
  status = 'declined'
  and reviewed_at is not null
  and reviewed_by = (select auth.uid())
  and (
    private.crowspace_is_circle_moderator_or_owner(circle_id)
    or private.crowrules_is_admin_impl()
  )
);

drop policy if exists "Requesters or moderators remove pending join requests" on public.podcast_community_circle_join_requests;
create policy "Requesters or moderators remove pending join requests"
on public.podcast_community_circle_join_requests
for delete
to authenticated
using (
  (user_id = (select auth.uid()) and status = 'pending')
  or private.crowspace_is_circle_moderator_or_owner(public.podcast_community_circle_join_requests.circle_id)
  or private.crowrules_is_admin_impl()
);

-- Approval is atomic: update the request and create membership together.
-- SECURITY DEFINER is confined to the non-exposed private schema, checks the
-- caller's authenticated identity and group role, and is not executable by PUBLIC.
create or replace function private.review_podcast_circle_join_request(
  p_request_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_circle_id uuid;
  v_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_decision is null or p_decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined' using errcode = '22023';
  end if;

  select r.circle_id, r.user_id
    into v_circle_id, v_user_id
  from public.podcast_community_circle_join_requests r
  where r.id = p_request_id
    and r.status = 'pending'
  for update;

  if not found then
    raise exception 'Pending join request not found' using errcode = 'P0002';
  end if;

  if not (
    private.crowspace_is_circle_moderator_or_owner(v_circle_id)
    or private.crowrules_is_admin_impl()
  ) then
    raise exception 'Not authorized to review this group request' using errcode = '42501';
  end if;

  update public.podcast_community_circle_join_requests
  set status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_request_id;

  if p_decision = 'approved' then
    insert into public.podcast_community_circle_members (circle_id, member_id, role)
    values (v_circle_id, v_user_id, 'member')
    on conflict (circle_id, member_id) do nothing;
  end if;
end;
$function$;

revoke all on function private.review_podcast_circle_join_request(uuid, text) from public, anon, authenticated;
grant execute on function private.review_podcast_circle_join_request(uuid, text) to authenticated;

-- PostgREST can invoke the public SECURITY INVOKER wrapper; the privileged
-- implementation remains in the non-exposed private schema.
create or replace function public.review_podcast_circle_join_request(
  p_request_id uuid,
  p_decision text
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.review_podcast_circle_join_request($1, $2);
$function$;

revoke all on function public.review_podcast_circle_join_request(uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_podcast_circle_join_request(uuid, text)
  to authenticated;

-- Invitees may join hidden groups only after accepting an existing invitation.
drop policy if exists "Accepted invitees may join hidden circles" on public.podcast_community_circle_members;
create policy "Accepted invitees may join hidden circles"
on public.podcast_community_circle_members
for insert
to authenticated
with check (
  member_id = (select auth.uid())
  and role = 'member'
  and exists (
    select 1
    from public.podcast_community_circles c
    where c.id = circle_id
      and c.visibility = 'hidden'
  )
  and exists (
    select 1
    from public.podcast_community_circle_invites i
    where i.circle_id = public.podcast_community_circle_members.circle_id
      and i.invitee_id = (select auth.uid())
      and i.status = 'accepted'
  )
);

-- ---------------------------------------------------------------------------
-- 3. Real-time group chat. Direct messages continue to use the existing
-- podcast_direct_conversations and podcast_direct_messages tables.
-- ---------------------------------------------------------------------------

create table if not exists public.podcast_community_circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.podcast_community_circles(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint podcast_community_circle_messages_body_check
    check (char_length(btrim(body)) between 1 and 3000)
);

create index if not exists podcast_circle_messages_group_created_idx
  on public.podcast_community_circle_messages (circle_id, created_at desc);

create index if not exists podcast_circle_messages_sender_created_idx
  on public.podcast_community_circle_messages (sender_id, created_at desc);

alter table public.podcast_community_circle_messages enable row level security;

-- Group chat is authenticated-only and additionally constrained by RLS.
revoke all on table public.podcast_community_circle_messages from public, anon, authenticated;

grant select, insert, delete
  on table public.podcast_community_circle_messages to authenticated;
grant update (body, edited_at, deleted_at)
  on table public.podcast_community_circle_messages to authenticated;

drop policy if exists "Circle members read enabled group chat" on public.podcast_community_circle_messages;
create policy "Circle members read enabled group chat"
on public.podcast_community_circle_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.podcast_community_circles c
    join public.podcast_community_circle_members m on m.circle_id = c.id
    where c.id = public.podcast_community_circle_messages.circle_id
      and c.group_chat_enabled = true
      and m.member_id = (select auth.uid())
  )
);

drop policy if exists "Circle members send group chat messages" on public.podcast_community_circle_messages;
create policy "Circle members send group chat messages"
on public.podcast_community_circle_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.podcast_community_circles c
    join public.podcast_community_circle_members m on m.circle_id = c.id
    where c.id = circle_id
      and c.group_chat_enabled = true
      and m.member_id = (select auth.uid())
  )
);

drop policy if exists "Authors and moderators edit group chat messages" on public.podcast_community_circle_messages;
create policy "Authors and moderators edit group chat messages"
on public.podcast_community_circle_messages
for update
to authenticated
using (
  (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.podcast_community_circle_members m
      where m.circle_id = podcast_community_circle_messages.circle_id
        and m.member_id = (select auth.uid())
    )
  )
  or private.crowspace_is_circle_moderator_or_owner(circle_id)
  or private.crowrules_is_admin_impl()
)
with check (
  (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.podcast_community_circle_members m
      where m.circle_id = podcast_community_circle_messages.circle_id
        and m.member_id = (select auth.uid())
    )
  )
  or private.crowspace_is_circle_moderator_or_owner(circle_id)
  or private.crowrules_is_admin_impl()
);

drop policy if exists "Authors and moderators delete group chat messages" on public.podcast_community_circle_messages;
create policy "Authors and moderators delete group chat messages"
on public.podcast_community_circle_messages
for delete
to authenticated
using (
  (
    sender_id = (select auth.uid())
    and exists (
      select 1
      from public.podcast_community_circle_members m
      where m.circle_id = podcast_community_circle_messages.circle_id
        and m.member_id = (select auth.uid())
    )
  )
  or private.crowspace_is_circle_moderator_or_owner(circle_id)
  or private.crowrules_is_admin_impl()
);

-- Add group chat to Postgres Changes only if the standard publication exists
-- and the table is not already included.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'podcast_community_circle_messages'
  ) then
    alter publication supabase_realtime
      add table public.podcast_community_circle_messages;
  end if;
end
$$;

comment on table public.podcast_community_circle_join_requests is
  'Private-group membership requests. Approval is performed atomically by private.review_podcast_circle_join_request.';
comment on table public.podcast_community_circle_messages is
  'Realtime group chat for active members of Podcasting community circles. Direct messages use the existing Podcasting DM system.';

commit;

-- Post-migration verification (run separately after applying in a development
-- environment): confirm both new tables have RLS enabled, grants are limited to
-- authenticated, the private schema RPC is not executable by PUBLIC/anon,
-- and the chat table is in supabase_realtime when that publication is enabled.
