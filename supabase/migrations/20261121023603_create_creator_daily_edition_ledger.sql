create table if not exists public.podcast_creator_daily_editions (
  id uuid primary key default gen_random_uuid(),
  edition_date date not null,
  timezone text not null default 'America/Los_Angeles'
    check (timezone = 'America/Los_Angeles'),
  status text not null default 'prepared'
    check (status in ('prepared','sending','completed','skipped','failed')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  campaign_id uuid null references public.podcast_email_campaigns(id) on delete set null,
  content_hash text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint podcast_creator_daily_editions_edition_date_key unique (edition_date)
);

alter table public.podcast_creator_daily_editions enable row level security;
revoke all on table public.podcast_creator_daily_editions from anon, authenticated;
grant all on table public.podcast_creator_daily_editions to service_role;

create index if not exists podcast_creator_daily_editions_created_at_idx
  on public.podcast_creator_daily_editions (created_at desc);
