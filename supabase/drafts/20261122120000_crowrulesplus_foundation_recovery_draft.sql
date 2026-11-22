-- CrowRules+ foundational schema recovery draft
-- Validation trigger: exercise the disposable PostgreSQL CI harness.
-- Status: DRAFT ONLY. Do not apply until reviewed against the CrowRules+ application
-- contract and tested in an isolated Supabase project.
-- Recovery basis: production supabase_migrations.schema_migrations records
-- 20260920043519 through 20260920052547. The historical base definitions for
-- crplus_content, crplus_live_channels, and crplus_schedule were not found.
-- The fields below are reconstructed from downstream migration references.
--
-- This file intentionally does not insert admin identities, modify migration
-- history, create storage policies/buckets, or change production data.

begin;

-- Admin membership table is referenced by the historical admin bootstrap.
create table if not exists public.crplus_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('owner','admin','editor','moderator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creator records are referenced by content, follows, project credits and
-- the Dreamscapes bridge.
create table if not exists public.crplus_creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  bio text,
  avatar_url text,
  banner_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Production project pipeline. These columns are copied from the historical
-- 20260920045544 migration; bridge columns are from 20260920045722/20260920045912.
create table if not exists public.crplus_projects (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.crplus_creators(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  slug text unique not null,
  logline text,
  description text,
  division_key text,
  project_type text not null default 'series'
    check (project_type in ('series','film','short','podcast','sports','special','other')),
  status text not null default 'idea'
    check (status in ('idea','submitted','development','review','approved','production','post_production','scheduled','published','archived')),
  thumbnail_url text,
  banner_url text,
  target_release_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  source_submission_id uuid,
  dreamscapes_project_id uuid references public.ds_projects(id) on delete set null,
  content_id uuid,
  parent_content_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reconstructed content catalog base. Downstream migrations prove these
-- fields are referenced, but do not establish that this is the complete
-- original schema. Confirm any additional app-required columns before use.
create table if not exists public.crplus_content (
  id uuid primary key default gen_random_uuid(),
  show_id uuid,
  title text not null,
  description text,
  season_number integer,
  episode_number integer,
  creator_id uuid references public.crplus_creators(id) on delete set null,
  project_id uuid references public.crplus_projects(id) on delete set null,
  storage_path text,
  playback_type text not null default 'external'
    check (playback_type in ('external','hls','mp4','youtube','youtube_live','storage')),
  age_rating text,
  tags text[] not null default '{}',
  workflow_status text not null default 'draft'
    check (workflow_status in ('draft','review','published','archived')),
  is_published boolean not null default false,
  published_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- source_submission_id remains an unconstrained UUID in this draft because
-- the referenced project-submission table is not yet reconstructed. Add its
-- foreign key only after that table is created and validated.

-- Reconstructed live-channel catalog. is_live and sort_order are confirmed by
-- historical index/view references; stream_type is confirmed by 20260920044543.
create table if not exists public.crplus_live_channels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  stream_url text,
  stream_type text not null default 'hls'
    check (stream_type in ('hls','youtube_live','external')),
  is_live boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reconstructed schedule. channel_id, starts_at, ends_at, content_id and title
-- are directly evidenced by downstream indexes/triggers.
create table if not exists public.crplus_schedule (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.crplus_live_channels(id) on delete set null,
  content_id uuid references public.crplus_content(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crplus_schedule_time_check check (ends_at > starts_at)
);

create index if not exists crplus_content_creator_idx
  on public.crplus_content(creator_id);
create index if not exists crplus_content_project_idx
  on public.crplus_content(project_id);
create index if not exists crplus_content_show_idx
  on public.crplus_content(show_id,season_number,episode_number);
create index if not exists crplus_content_tags_idx
  on public.crplus_content using gin(tags);
create index if not exists crplus_projects_status_idx
  on public.crplus_projects(status,updated_at desc);
create index if not exists crplus_projects_creator_idx
  on public.crplus_projects(creator_id);
create index if not exists crplus_live_channels_live_idx
  on public.crplus_live_channels(is_live,sort_order);
create index if not exists idx_crplus_schedule_channel_time
  on public.crplus_schedule(channel_id,starts_at,ends_at);

-- RLS is enabled here, but write policies are intentionally restricted to
-- authenticated CrowRules+ admins until the complete ownership contract has
-- been reviewed. Existing admin helper is used; do not bootstrap admins here.
alter table public.crplus_admins enable row level security;
alter table public.crplus_creators enable row level security;
alter table public.crplus_projects enable row level security;
alter table public.crplus_content enable row level security;
alter table public.crplus_live_channels enable row level security;
alter table public.crplus_schedule enable row level security;

-- Preserve the production helper's existing members-based authorization,
-- including super_admin, while allowing an explicitly managed CR+ admin row.
-- Do not use SECURITY DEFINER here; keep the helper's existing execution model.
create or replace function public.crplus_is_admin()
returns boolean
language sql stable
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.crplus_admins a
    where a.user_id=(select auth.uid()) and a.is_active
  ) or exists(
    select 1 from public.members m
    where m.user_id=(select auth.uid())
      and m.status='Active'
      and lower(coalesce(m.role,'')) in ('admin','owner','super_admin')
  );
$$;
revoke all on function public.crplus_is_admin() from public,anon;
grant execute on function public.crplus_is_admin() to authenticated;

drop policy if exists crplus_admins_self_read on public.crplus_admins;
create policy crplus_admins_self_read on public.crplus_admins
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists crplus_creators_public_read on public.crplus_creators;
create policy crplus_creators_public_read on public.crplus_creators
  for select to anon, authenticated using (true);
drop policy if exists crplus_creators_admin_manage on public.crplus_creators;
create policy crplus_creators_admin_manage on public.crplus_creators
  for all to authenticated using (public.crplus_is_admin())
  with check (public.crplus_is_admin());

drop policy if exists crplus_projects_admin_all on public.crplus_projects;
create policy crplus_projects_admin_all on public.crplus_projects
  for all to authenticated using (public.crplus_is_admin())
  with check (public.crplus_is_admin());
drop policy if exists crplus_projects_owner_read on public.crplus_projects;
create policy crplus_projects_owner_read on public.crplus_projects
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or public.crplus_is_admin());

drop policy if exists crplus_content_public_read on public.crplus_content;
create policy crplus_content_public_read on public.crplus_content
  for select to anon, authenticated using (is_published = true);
drop policy if exists crplus_content_owner_read on public.crplus_content;
create policy crplus_content_owner_read on public.crplus_content
  for select to authenticated
  using (
    exists (
      select 1 from public.crplus_projects p
      where p.id = crplus_content.project_id
        and p.owner_user_id = (select auth.uid())
    ) or public.crplus_is_admin()
  );
drop policy if exists crplus_content_admin_manage on public.crplus_content;
create policy crplus_content_admin_manage on public.crplus_content
  for all to authenticated using (public.crplus_is_admin())
  with check (public.crplus_is_admin());

drop policy if exists crplus_live_channels_public_read on public.crplus_live_channels;
create policy crplus_live_channels_public_read on public.crplus_live_channels
  for select to anon, authenticated using (is_live = true);
drop policy if exists crplus_live_channels_admin_manage on public.crplus_live_channels;
create policy crplus_live_channels_admin_manage on public.crplus_live_channels
  for all to authenticated using (public.crplus_is_admin())
  with check (public.crplus_is_admin());

drop policy if exists crplus_schedule_public_read on public.crplus_schedule;
create policy crplus_schedule_public_read on public.crplus_schedule
  for select to anon, authenticated using (
    exists (
      select 1 from public.crplus_content c
      where c.id = crplus_schedule.content_id and c.is_published = true
    )
  );
drop policy if exists crplus_schedule_admin_manage on public.crplus_schedule;
create policy crplus_schedule_admin_manage on public.crplus_schedule
  for all to authenticated using (public.crplus_is_admin())
  with check (public.crplus_is_admin());

grant select on public.crplus_creators, public.crplus_content,
  public.crplus_live_channels, public.crplus_schedule to anon, authenticated;
grant select on public.crplus_projects, public.crplus_admins to authenticated;
grant insert, update, delete on public.crplus_projects, public.crplus_content,
  public.crplus_creators, public.crplus_live_channels, public.crplus_schedule
  to authenticated;


-- ---------------------------------------------------------------------------
-- Recovered dependent tables: exact table columns are taken from the recorded
-- historical migrations 20260920043558, 20260920044352, 20260920045059,
-- 20260920045544 and 20260920045722.
-- ---------------------------------------------------------------------------

create table if not exists public.crplus_project_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.crplus_projects(id) on delete cascade,
  submitter_user_id uuid references auth.users(id) on delete set null,
  submission_type text not null default 'dream'
    check (submission_type in ('dream','idea','pitch','episode','podcast','other')),
  message text,
  status text not null default 'submitted'
    check (status in ('submitted','review','accepted','declined','converted')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

alter table public.crplus_projects
  add constraint crplus_projects_source_submission_fk
  foreign key (source_submission_id)
  references public.crplus_project_submissions(id) on delete set null;
create unique index if not exists crplus_projects_source_submission_uidx
  on public.crplus_projects(source_submission_id)
  where source_submission_id is not null;
create unique index if not exists crplus_projects_dreamscapes_project_uidx
  on public.crplus_projects(dreamscapes_project_id)
  where dreamscapes_project_id is not null;
create index if not exists crplus_projects_content_idx
  on public.crplus_projects(content_id);
create index if not exists crplus_projects_parent_content_idx
  on public.crplus_projects(parent_content_id);

create table if not exists public.crplus_project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.crplus_projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'todo'
    check (status in ('todo','in_progress','blocked','done')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crplus_project_credits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.crplus_projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  creator_id uuid references public.crplus_creators(id) on delete set null,
  credit_role text not null,
  credit_name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.crplus_project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crplus_projects(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.crplus_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  membership_level integer not null default 0,
  status text not null default 'active',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.crplus_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.crplus_content(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  is_hidden boolean not null default false,
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.crplus_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.crplus_creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id,creator_id)
);

create table if not exists public.crplus_play_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  content_id uuid references public.crplus_content(id) on delete set null,
  event_type text not null
    check (event_type in ('start','progress','complete','pause','stop')),
  position_seconds integer not null default 0,
  session_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.crplus_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.crplus_content(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,content_id)
);

create table if not exists public.crplus_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null default 'system',
  title text not null,
  body text,
  content_id uuid references public.crplus_content(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.crplus_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  cover_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crplus_collection_items (
  collection_id uuid not null references public.crplus_collections(id) on delete cascade,
  content_id uuid not null references public.crplus_content(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id,content_id)
);

create table if not exists public.crplus_content_sources (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.crplus_content(id) on delete cascade,
  source_type text not null
    check (source_type in ('youtube','youtube_live','storage','hls','external')),
  source_url text,
  storage_path text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crplus_project_submissions_status_idx
  on public.crplus_project_submissions(status,created_at desc);
create index if not exists crplus_project_tasks_project_idx
  on public.crplus_project_tasks(project_id,status);
create index if not exists crplus_project_credits_project_idx
  on public.crplus_project_credits(project_id,sort_order);
create index if not exists crplus_comments_content_idx
  on public.crplus_comments(content_id,created_at desc);
create index if not exists crplus_events_content_idx
  on public.crplus_play_events(content_id,created_at desc);
create index if not exists crplus_events_user_idx
  on public.crplus_play_events(user_id,created_at desc);
create index if not exists crplus_ratings_content_idx
  on public.crplus_ratings(content_id);
create index if not exists crplus_notifications_user_idx
  on public.crplus_notifications(user_id,is_read,created_at desc);
create index if not exists crplus_collection_items_order_idx
  on public.crplus_collection_items(collection_id,sort_order);
create index if not exists idx_crplus_sources_content
  on public.crplus_content_sources(content_id,is_active,sort_order);
create index if not exists idx_crplus_sources_primary
  on public.crplus_content_sources(content_id,is_primary,is_active,sort_order);
create index if not exists idx_crplus_content_workflow
  on public.crplus_content(workflow_status,created_at desc);
create index if not exists idx_crplus_comments_moderation
  on public.crplus_comments(is_hidden,created_at desc);

alter table public.crplus_project_submissions enable row level security;
alter table public.crplus_project_tasks enable row level security;
alter table public.crplus_project_credits enable row level security;
alter table public.crplus_project_status_history enable row level security;
alter table public.crplus_entitlements enable row level security;
alter table public.crplus_comments enable row level security;
alter table public.crplus_follows enable row level security;
alter table public.crplus_play_events enable row level security;
alter table public.crplus_ratings enable row level security;
alter table public.crplus_notifications enable row level security;
alter table public.crplus_collections enable row level security;
alter table public.crplus_collection_items enable row level security;
alter table public.crplus_content_sources enable row level security;

create policy crplus_project_submissions_admin_all
  on public.crplus_project_submissions for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));
create policy crplus_project_submissions_owner_read
  on public.crplus_project_submissions for select to authenticated
  using (submitter_user_id=(select auth.uid()) or (select public.crplus_is_admin()));
create policy crplus_project_tasks_admin_all
  on public.crplus_project_tasks for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));
create policy crplus_project_credits_admin_all
  on public.crplus_project_credits for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));
create policy crplus_project_status_history_admin_all
  on public.crplus_project_status_history for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));
create policy crplus_project_status_history_owner_read
  on public.crplus_project_status_history for select to authenticated
  using (exists (
    select 1 from public.crplus_projects p
    where p.id=crplus_project_status_history.project_id
      and p.owner_user_id=(select auth.uid())
  ));

create policy crplus_entitlement_own
  on public.crplus_entitlements for select to authenticated
  using ((select auth.uid())=user_id);

create policy crplus_comments_public_read
  on public.crplus_comments for select to anon,authenticated
  using (is_hidden=false);
create policy crplus_comments_own_insert
  on public.crplus_comments for insert to authenticated
  with check ((select auth.uid())=user_id);
create policy crplus_comments_own_delete
  on public.crplus_comments for delete to authenticated
  using ((select auth.uid())=user_id);
create policy crplus_comments_admin_all
  on public.crplus_comments for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));

create policy crplus_follows_public_read
  on public.crplus_follows for select to anon,authenticated using (true);
create policy crplus_follows_own
  on public.crplus_follows for all to authenticated
  using ((select auth.uid())=follower_id)
  with check ((select auth.uid())=follower_id);

create policy crplus_events_own
  on public.crplus_play_events for all to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy crplus_ratings_public_read
  on public.crplus_ratings for select to anon,authenticated using (true);
create policy crplus_ratings_own_insert
  on public.crplus_ratings for insert to authenticated
  with check ((select auth.uid())=user_id);
create policy crplus_ratings_own_update
  on public.crplus_ratings for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);
create policy crplus_ratings_own_delete
  on public.crplus_ratings for delete to authenticated
  using ((select auth.uid())=user_id);

create policy crplus_notifications_own_read
  on public.crplus_notifications for select to authenticated
  using ((select auth.uid())=user_id);
create policy crplus_notifications_own_update
  on public.crplus_notifications for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create policy crplus_collections_published_read
  on public.crplus_collections for select to anon,authenticated
  using (is_published=true);
create policy crplus_collection_items_published_read
  on public.crplus_collection_items for select to anon,authenticated
  using (exists (
    select 1 from public.crplus_collections c
    where c.id=collection_id and c.is_published=true
  ));
create policy crplus_content_sources_published_read
  on public.crplus_content_sources for select to anon,authenticated
  using (exists (
    select 1 from public.crplus_content c
    where c.id=content_id and c.is_published=true
  ));

create policy crplus_admin_collections_all
  on public.crplus_collections for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));
create policy crplus_admin_collection_items_all
  on public.crplus_collection_items for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));
create policy crplus_admin_sources_all
  on public.crplus_content_sources for all to authenticated
  using ((select public.crplus_is_admin()))
  with check ((select public.crplus_is_admin()));

grant select on public.crplus_comments,public.crplus_follows,
  public.crplus_ratings,public.crplus_collections,
  public.crplus_collection_items,public.crplus_content_sources
  to anon,authenticated;
grant insert,delete on public.crplus_comments to authenticated;
grant select,insert,update,delete on public.crplus_follows,
  public.crplus_play_events,public.crplus_ratings to authenticated;
grant select,update on public.crplus_notifications to authenticated;
grant select on public.crplus_entitlements to authenticated;
grant select,insert,update,delete on public.crplus_project_submissions,
  public.crplus_project_tasks,public.crplus_project_credits,
  public.crplus_project_status_history to authenticated;
grant insert,update,delete on public.crplus_collections,
  public.crplus_collection_items,public.crplus_content_sources to authenticated;



-- Notification helpers and triggers recovered from migration 20260920050036.
create or replace function public.crplus_notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_content_id uuid default null
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if p_user_id is null then return; end if;
  insert into public.crplus_notifications(user_id,notification_type,title,body,content_id)
  values(p_user_id,p_type,p_title,p_body,p_content_id);
end;
$$;
revoke all on function public.crplus_notify_user(uuid,text,text,text,uuid)
  from public,anon,authenticated;

create or replace function public.crplus_project_status_notification()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.status is distinct from old.status
     and new.owner_user_id is not null then
    perform public.crplus_notify_user(
      new.owner_user_id,'project_status','Project status updated',
      new.title || ' moved to ' || replace(new.status,'_',' ') || '.',
      new.content_id
    );
  elsif tg_op='INSERT' and new.owner_user_id is not null then
    perform public.crplus_notify_user(
      new.owner_user_id,'project_created','Production project created',
      new.title || ' has been added to the CrowRules+ production pipeline.',
      new.content_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.crplus_project_status_notification()
  from public,anon,authenticated;
drop trigger if exists trg_crplus_project_status_notification on public.crplus_projects;
create trigger trg_crplus_project_status_notification
after insert or update of status on public.crplus_projects
for each row execute function public.crplus_project_status_notification();

create or replace function public.crplus_content_workflow_notification()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_user uuid;
begin
  if new.project_id is null
     or not (tg_op='INSERT' or new.workflow_status is distinct from old.workflow_status) then
    return new;
  end if;
  select owner_user_id into v_user
  from public.crplus_projects where id=new.project_id;
  if new.workflow_status='review' then
    perform public.crplus_notify_user(v_user,'content_review',
      'Content sent for review',new.title || ' is ready for review.',new.id);
  elsif new.workflow_status='published' then
    perform public.crplus_notify_user(v_user,'content_published',
      'Content published',new.title || ' is now published on CrowRules+.',new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.crplus_content_workflow_notification()
  from public,anon,authenticated;
drop trigger if exists trg_crplus_content_workflow_notification on public.crplus_content;
create trigger trg_crplus_content_workflow_notification
after insert or update of workflow_status on public.crplus_content
for each row execute function public.crplus_content_workflow_notification();

create or replace function public.crplus_schedule_notification()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_user uuid; v_title text;
begin
  if new.content_id is null then return new; end if;
  select p.owner_user_id,c.title into v_user,v_title
  from public.crplus_content c
  left join public.crplus_projects p on p.id=c.project_id
  where c.id=new.content_id;
  if v_user is not null then
    perform public.crplus_notify_user(v_user,'content_scheduled',
      'Content scheduled for CrowRules TV',
      coalesce(v_title,new.title) || ' was added to the TV guide.',
      new.content_id);
  end if;
  return new;
end;
$$;
revoke all on function public.crplus_schedule_notification()
  from public,anon,authenticated;
drop trigger if exists trg_crplus_schedule_notification on public.crplus_schedule;
create trigger trg_crplus_schedule_notification
after insert on public.crplus_schedule
for each row execute function public.crplus_schedule_notification();


commit;

-- REVIEW BLOCKERS BEFORE THIS CAN BECOME A DEPLOYABLE MIGRATION:
-- 1. crplus_content, crplus_live_channels and crplus_schedule base definitions
--    are reconstructed because their original CREATE TABLE statements were not
--    present in the recoverable migration history. Compare against the original UI.
-- 2. Verify crplus_content.show_id target/type; intentionally left unconstrained.
-- 3. Confirm whether schedule entries without content_id should be public.
-- 4. Validate the existing Dreamscapes bridge trigger against current ds_submissions
--    columns before restoring that integration. It is intentionally not recreated here.
-- 5. Review the historical private storage bucket and storage.objects policies before
--    adding the crplus-videos bucket/policies; this draft does not mutate Storage.
-- 6. Confirm all current app queries, enum/status values, and admin workflows against
--    this schema, then test in an isolated database before applying anywhere.
-- 7. No admin user is bootstrapped here. Populate crplus_admins only through a
--    trusted, reviewed administrative process.
