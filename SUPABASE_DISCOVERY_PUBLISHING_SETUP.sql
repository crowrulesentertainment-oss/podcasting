-- CrowRules Podcasting — Homepage Draft, Preview & Publishing
-- Project: cevylpnoexugwgygvtgu
-- Run once in the Supabase SQL Editor.

alter table public.podcast_discovery_home_settings
  add column if not exists draft_config jsonb,
  add column if not exists published_config jsonb,
  add column if not exists draft_updated_by uuid references auth.users(id) on delete set null,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null,
  add column if not exists published_at timestamptz;

create table if not exists public.podcast_discovery_home_revisions (
  id bigint generated always as identity primary key,
  config jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now()
);
alter table public.podcast_discovery_home_revisions enable row level security;
revoke all on public.podcast_discovery_home_revisions from anon, authenticated;
grant select on public.podcast_discovery_home_revisions to authenticated;
drop policy if exists "Podcast admins view homepage revisions" on public.podcast_discovery_home_revisions;
create policy "Podcast admins view homepage revisions"
on public.podcast_discovery_home_revisions for select to authenticated
using (public.crowrules_is_admin());

drop policy if exists "Podcast admins manage discovery homepage settings" on public.podcast_discovery_home_settings;
create policy "Podcast admins manage discovery homepage settings"
on public.podcast_discovery_home_settings for all to authenticated
using (public.crowrules_is_admin()) with check (public.crowrules_is_admin());

create or replace function public.capture_podcast_discovery_home_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.crowrules_is_admin() then
    raise exception 'Administrator access required to publish homepage revisions';
  end if;
  if new.published_config is not null
     and new.published_config is distinct from old.published_config then
    insert into public.podcast_discovery_home_revisions(config, published_by, published_at)
    values (new.published_config, new.published_by, coalesce(new.published_at, now()));
    delete from public.podcast_discovery_home_revisions
    where id not in (
      select id from public.podcast_discovery_home_revisions
      order by published_at desc, id desc limit 20
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.capture_podcast_discovery_home_revision() from public, anon, authenticated;
drop trigger if exists podcast_discovery_home_revision_capture on public.podcast_discovery_home_settings;
create trigger podcast_discovery_home_revision_capture
after update of published_config on public.podcast_discovery_home_settings
for each row execute function public.capture_podcast_discovery_home_revision();

-- The public homepage only selects settings; it never receives drafts or revision rows.
grant select on public.podcast_discovery_home_settings to anon, authenticated;
grant update on public.podcast_discovery_home_settings to authenticated;
