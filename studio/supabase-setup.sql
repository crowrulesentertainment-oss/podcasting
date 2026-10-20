-- Run in Supabase SQL Editor if you need to recreate the studio integration.
-- This migration has already been applied to the CrowRules Supabase project.
create table if not exists public.crowrules_studio_projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Podcast Session', show_name text not null default '', notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists crowrules_studio_projects_owner_updated_idx on public.crowrules_studio_projects(owner_id,updated_at desc);
alter table public.crowrules_studio_projects enable row level security;
grant select,insert,update,delete on public.crowrules_studio_projects to authenticated;
drop policy if exists "studio projects owner select" on public.crowrules_studio_projects;
create policy "studio projects owner select" on public.crowrules_studio_projects for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists "studio projects owner insert" on public.crowrules_studio_projects;
create policy "studio projects owner insert" on public.crowrules_studio_projects for insert to authenticated with check ((select auth.uid())=owner_id);
drop policy if exists "studio projects owner update" on public.crowrules_studio_projects;
create policy "studio projects owner update" on public.crowrules_studio_projects for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
drop policy if exists "studio projects owner delete" on public.crowrules_studio_projects;
create policy "studio projects owner delete" on public.crowrules_studio_projects for delete to authenticated using ((select auth.uid())=owner_id);

create table if not exists public.crowrules_studio_exports (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.crowrules_studio_projects(id) on delete set null, title text not null, show_name text not null default '',
  audio_path text not null, mime_type text not null default 'audio/wav', file_bytes bigint not null default 0 check(file_bytes>=0),
  duration_seconds integer check(duration_seconds is null or duration_seconds>=0),
  delivery_status text not null default 'ready_for_show' check(delivery_status in ('ready_for_show','published')), created_at timestamptz not null default now()
);
create index if not exists crowrules_studio_exports_owner_created_idx on public.crowrules_studio_exports(owner_id,created_at desc);
alter table public.crowrules_studio_exports enable row level security;
grant select,insert,update,delete on public.crowrules_studio_exports to authenticated;
drop policy if exists "studio exports owner select" on public.crowrules_studio_exports;
create policy "studio exports owner select" on public.crowrules_studio_exports for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists "studio exports owner insert" on public.crowrules_studio_exports;
create policy "studio exports owner insert" on public.crowrules_studio_exports for insert to authenticated with check ((select auth.uid())=owner_id and (project_id is null or exists(select 1 from public.crowrules_studio_projects p where p.id=project_id and p.owner_id=(select auth.uid()))));
drop policy if exists "studio exports owner update" on public.crowrules_studio_exports;
create policy "studio exports owner update" on public.crowrules_studio_exports for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
drop policy if exists "studio exports owner delete" on public.crowrules_studio_exports;
create policy "studio exports owner delete" on public.crowrules_studio_exports for delete to authenticated using ((select auth.uid())=owner_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('crowrules-podcast-studio','crowrules-podcast-studio',false,524288000,array['audio/wav','audio/webm','audio/mp4','audio/ogg']) on conflict(id) do update set public=false,file_size_limit=524288000,allowed_mime_types=array['audio/wav','audio/webm','audio/mp4','audio/ogg'];
drop policy if exists "studio audio owner select" on storage.objects;
create policy "studio audio owner select" on storage.objects for select to authenticated using(bucket_id='crowrules-podcast-studio' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "studio audio owner insert" on storage.objects;
create policy "studio audio owner insert" on storage.objects for insert to authenticated with check(bucket_id='crowrules-podcast-studio' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "studio audio owner update" on storage.objects;
create policy "studio audio owner update" on storage.objects for update to authenticated using(bucket_id='crowrules-podcast-studio' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='crowrules-podcast-studio' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "studio audio owner delete" on storage.objects;
create policy "studio audio owner delete" on storage.objects for delete to authenticated using(bucket_id='crowrules-podcast-studio' and (storage.foldername(name))[1]=(select auth.uid())::text);
