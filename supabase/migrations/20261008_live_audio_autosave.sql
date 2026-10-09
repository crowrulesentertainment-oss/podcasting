-- CrowRules Podcasting: private audio recordings with automatic upload after recording stops.
alter table public.podcast_live_sessions
  add column if not exists recording_path text,
  add column if not exists recording_mime text,
  add column if not exists recording_size bigint;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('podcast-live-recordings','podcast-live-recordings',false,524288000,
  array['audio/webm','audio/webm;codecs=opus','audio/mp4','audio/ogg','audio/mpeg','audio/wav','audio/x-wav'])
on conflict (id) do update set public=false, file_size_limit=524288000;

drop policy if exists "Creators upload own live recordings" on storage.objects;
create policy "Creators upload own live recordings"
on storage.objects for insert to authenticated
with check (bucket_id='podcast-live-recordings' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Creators read own live recordings" on storage.objects;
create policy "Creators read own live recordings"
on storage.objects for select to authenticated
using (bucket_id='podcast-live-recordings' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Creators update own live recordings" on storage.objects;
create policy "Creators update own live recordings"
on storage.objects for update to authenticated
using (bucket_id='podcast-live-recordings' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='podcast-live-recordings' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Creators delete own live recordings" on storage.objects;
create policy "Creators delete own live recordings"
on storage.objects for delete to authenticated
using (bucket_id='podcast-live-recordings' and (storage.foldername(name))[1]=auth.uid()::text);

grant select, insert, update, delete on storage.objects to authenticated;
