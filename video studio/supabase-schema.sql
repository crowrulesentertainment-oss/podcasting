-- Run in the Supabase SQL editor to enable cloud project details and private video uploads.
create table if not exists public.video_studio_projects (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 podcast_id uuid null references public.podcasts(id) on delete set null,
 title text not null default 'Untitled Video Project', description text not null default '',
 assets jsonb not null default '[]'::jsonb, duration_seconds integer not null default 0,
 video_mime_type text, storage_path text, has_video boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.video_studio_projects enable row level security;
drop policy if exists video_projects_select_own on public.video_studio_projects;
create policy video_projects_select_own on public.video_studio_projects for select to authenticated using(auth.uid()=user_id);
drop policy if exists video_projects_insert_own on public.video_studio_projects;
create policy video_projects_insert_own on public.video_studio_projects for insert to authenticated with check(auth.uid()=user_id);
drop policy if exists video_projects_update_own on public.video_studio_projects;
create policy video_projects_update_own on public.video_studio_projects for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists video_projects_delete_own on public.video_studio_projects;
create policy video_projects_delete_own on public.video_studio_projects for delete to authenticated using(auth.uid()=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('studio-videos','studio-videos',false,2147483648,array['video/webm','video/mp4','video/quicktime']) on conflict(id) do nothing;
drop policy if exists studio_videos_insert_own on storage.objects;
create policy studio_videos_insert_own on storage.objects for insert to authenticated with check(bucket_id='studio-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists studio_videos_select_own on storage.objects;
create policy studio_videos_select_own on storage.objects for select to authenticated using(bucket_id='studio-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists studio_videos_update_own on storage.objects;
create policy studio_videos_update_own on storage.objects for update to authenticated using(bucket_id='studio-videos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='studio-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists studio_videos_delete_own on storage.objects;
create policy studio_videos_delete_own on storage.objects for delete to authenticated using(bucket_id='studio-videos' and (storage.foldername(name))[1]=auth.uid()::text);
