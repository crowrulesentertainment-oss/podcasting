-- Dedicated public image storage for CrowRules Podcasting cinematic theme environments.
-- Only active CrowRules platform administrators may upload or delete theme images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crp-theme-environments',
  'crp-theme-environments',
  true,
  15728640,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do nothing;

drop policy if exists "CRP theme images admin upload" on storage.objects;
create policy "CRP theme images admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crp-theme-environments'
  and (storage.foldername(name))[1] = 'themes'
  and exists (
    select 1
    from public.cr_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and lower(a.role) in ('admin', 'super_admin')
  )
);

drop policy if exists "CRP theme images admin delete" on storage.objects;
create policy "CRP theme images admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crp-theme-environments'
  and (storage.foldername(name))[1] = 'themes'
  and exists (
    select 1
    from public.cr_admins a
    where a.user_id = (select auth.uid())
      and a.is_active = true
      and lower(a.role) in ('admin', 'super_admin')
  )
);
