-- CrowRules Podcasting Studio: private multitrack recording storage
-- Project: cevylpnoexugwgygvtgu
-- Safe to rerun. No existing podcast tables or policies are replaced.
create table if not exists public.studio_recordings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  podcast_id uuid null references public.podcasts(id) on delete set null,
  title text not null default 'Untitled recording',
  status text not null default 'saved' check (status in ('recording','saved','draft_created','deleted')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  tracks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists studio_recordings_owner_created_idx on public.studio_recordings(owner_user_id, created_at desc);
alter table public.studio_recordings enable row level security;
revoke all on public.studio_recordings from anon;
grant select, insert, update, delete on public.studio_recordings to authenticated;
drop policy if exists "Creators manage own studio recordings" on public.studio_recordings;
create policy "Creators manage own studio recordings" on public.studio_recordings for all to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()) and (
  podcast_id is null or exists (
    select 1 from public.podcasts p
    join public.creators c on c.id = p.creator_id
    join public.members m on m.id = c.member_id
    where p.id = podcast_id and m.user_id = (select auth.uid())
  )
));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('studio-recordings','studio-recordings',false,524288000,
  array['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg','audio/aac','audio/x-m4a'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Studio users read own recording files" on storage.objects;
create policy "Studio users read own recording files" on storage.objects for select to authenticated
using (bucket_id='studio-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Studio users upload own recording files" on storage.objects;
create policy "Studio users upload own recording files" on storage.objects for insert to authenticated
with check (bucket_id='studio-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Studio users update own recording files" on storage.objects;
create policy "Studio users update own recording files" on storage.objects for update to authenticated
using (bucket_id='studio-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='studio-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Studio users delete own recording files" on storage.objects;
create policy "Studio users delete own recording files" on storage.objects for delete to authenticated
using (bucket_id='studio-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
