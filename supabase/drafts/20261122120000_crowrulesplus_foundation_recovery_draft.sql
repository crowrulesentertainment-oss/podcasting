-- CrowRules+ foundational schema recovery draft
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

commit;

-- REVIEW BLOCKERS BEFORE THIS CAN BECOME A DEPLOYABLE MIGRATION:
-- 1. Define/verify the complete crplus_content schema against the original UI.
-- 2. Verify show_id FK target and type; it is intentionally left unconstrained.
-- 3. Create crplus_project_submissions before adding source_submission_id FK.
-- 4. Confirm whether schedule entries without content_id should be publicly visible.
-- 5. Reconstruct missing entitlement/social/ratings/notifications/collections/
--    content-source tables because their historical migration versions are already
--    recorded and will not automatically rerun on the restored environment.
-- 6. Reconcile crplus_admins versus the existing public.crplus_is_admin() helper.
