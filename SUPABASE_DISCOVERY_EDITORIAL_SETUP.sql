-- CrowRules Podcasting — Discovery & Editorial Control Room
-- Applied to the existing Supabase project cevylpnoexugwgygvtgu.
-- Public can read editorial homepage configuration. Only trusted podcast admins can write it.
create table if not exists public.podcast_discovery_home_settings (
  id boolean primary key default true check (id = true),
  hero_title text not null default 'Discover your next favorite show.',
  hero_copy text not null default 'Independent voices. Original conversations. One listening universe.',
  hero_image_url text,
  hero_podcast_id uuid references public.podcasts(id) on delete set null,
  hero_tag text not null default 'CROWRULES SPOTLIGHT',
  trending_title text not null default 'Trending Now',
  trending_description text not null default 'Shows gaining momentum across the published network.',
  new_releases_title text not null default 'New Releases',
  new_releases_description text not null default 'Recently published episodes ready to explore.',
  spotlight_title text not null default 'CrowRules Spotlight',
  spotlight_description text not null default 'Featured shows and categories selected for the network.',
  section_order text[] not null default array['hero','trending','new_releases','because_you_follow','continue_listening','spotlight','collections'],
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.podcast_discovery_home_settings enable row level security;
grant select on public.podcast_discovery_home_settings to anon, authenticated;
grant insert, update on public.podcast_discovery_home_settings to authenticated;
drop policy if exists "Discovery homepage settings are public" on public.podcast_discovery_home_settings;
create policy "Discovery homepage settings are public" on public.podcast_discovery_home_settings for select to anon, authenticated using (true);
drop policy if exists "Podcast admins manage discovery homepage settings" on public.podcast_discovery_home_settings;
create policy "Podcast admins manage discovery homepage settings" on public.podcast_discovery_home_settings for all to authenticated using (public.crowrules_is_admin()) with check (public.crowrules_is_admin());
insert into public.podcast_discovery_home_settings (id) values (true) on conflict (id) do nothing;

-- Existing categories are the editorial collection records; no duplicate collection table.
drop policy if exists "Podcast admins can view all categories" on public.podcast_categories;
create policy "Podcast admins can view all categories" on public.podcast_categories for select to authenticated using (public.crowrules_is_admin());
drop policy if exists "Podcast admins can update categories" on public.podcast_categories;
create policy "Podcast admins can update categories" on public.podcast_categories for update to authenticated using (public.crowrules_is_admin()) with check (public.crowrules_is_admin());
grant select on public.podcast_categories to anon, authenticated;
grant update on public.podcast_categories to authenticated;
