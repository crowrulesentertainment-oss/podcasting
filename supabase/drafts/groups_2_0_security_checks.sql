-- Groups 2.0 post-migration diagnostics. Read-only; safe to run after the draft
-- has been promoted and applied in a disposable/local Supabase environment.
select 'required_columns' as check_name, count(*) as found
from information_schema.columns
where table_schema='public'
  and ((table_name='podcast_community_circles' and column_name in ('avatar_image_path','banner_image_path'))
    or (table_name='podcast_community_circle_posts' and column_name in ('post_type','episode_url','episode_title','episode_artwork_url','media_path','edited_at','deleted_at','is_pinned','is_locked')))
having count(*)=11;

select 'new_tables_rls' as check_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('podcast_community_circle_image_suggestions','podcast_community_circle_reports')
order by c.relname;

select 'new_table_policies' as check_name, tablename, policyname, cmd, roles
from pg_policies
where schemaname='public'
  and tablename in ('podcast_community_circle_image_suggestions','podcast_community_circle_reports')
order by tablename,policyname;

select 'media_bucket' as check_name,id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='podcast-group-media';

select 'media_storage_policies' as check_name,policyname,cmd,roles
from pg_policies where schemaname='storage' and tablename='objects'
  and policyname in ('Group members upload their own group media','Group members read group media','Owners and moderators delete group media')
order by policyname;

-- Must return zero rows: every reply must reference a post in its own circle.
select r.id,r.circle_id,p.circle_id as post_circle_id
from public.podcast_community_circle_replies r
left join public.podcast_community_circle_posts p on p.id=r.post_id
where p.id is null or p.circle_id<>r.circle_id;

-- Verify helper routines used by the new RLS policies exist.
select n.nspname as schema_name,p.proname as function_name,pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname in ('crowspace_is_circle_member','crowspace_is_circle_moderator_or_owner','crowrules_is_admin_impl'))
order by p.proname;
