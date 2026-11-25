create table if not exists public.podcast_rss_growth_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  podcast_id uuid not null references public.podcasts(id) on delete cascade,
  enabled boolean not null default true,
  frequency text not null default 'weekly'
    check (frequency in ('manual','weekly','new_episode','weekly_and_new_episode')),
  weekday smallint not null default 1 check (weekday between 0 and 6),
  send_time time without time zone not null default '10:00',
  timezone text not null default 'America/Los_Angeles',
  email_enabled boolean not null default true,
  social_enabled boolean not null default true,
  directory_tracking_enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint podcast_rss_growth_settings_podcast_unique unique (podcast_id)
);
create index if not exists podcast_rss_growth_settings_due_idx
  on public.podcast_rss_growth_settings (enabled, next_run_at);
alter table public.podcast_rss_growth_settings enable row level security;
revoke all on public.podcast_rss_growth_settings from anon, authenticated;
grant all on public.podcast_rss_growth_settings to service_role;
