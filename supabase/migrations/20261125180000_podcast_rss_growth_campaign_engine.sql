
alter table public.podcast_rss_growth_settings
  add column if not exists last_promoted_episode_id uuid references public.podcast_episodes(id) on delete set null;

create table if not exists public.podcast_rss_growth_campaigns (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid not null references public.podcasts(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('weekly','new_episode','manual')),
  run_key text not null unique,
  episode_id uuid references public.podcast_episodes(id) on delete set null,
  subject text not null,
  body_text text not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  status text not null default 'processing' check (status in ('processing','completed','partial','failed','no_recipients')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists podcast_rss_growth_campaigns_show_recent_idx on public.podcast_rss_growth_campaigns(podcast_id,started_at desc);
create table if not exists public.podcast_rss_growth_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.podcast_rss_growth_campaigns(id) on delete cascade,
  recipient_user_id uuid not null,
  recipient_email text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique(campaign_id,recipient_user_id)
);
create index if not exists podcast_rss_growth_deliveries_campaign_idx on public.podcast_rss_growth_deliveries(campaign_id,status);
create table if not exists public.podcast_rss_growth_social_drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.podcast_rss_growth_campaigns(id) on delete cascade,
  podcast_id uuid not null references public.podcasts(id) on delete cascade,
  platform text not null default 'general',
  post_text text not null,
  status text not null default 'draft' check (status in ('draft','approved','published','failed')),
  created_at timestamptz not null default now(),
  unique(campaign_id,platform)
);
alter table public.podcast_rss_growth_campaigns enable row level security;
alter table public.podcast_rss_growth_deliveries enable row level security;
alter table public.podcast_rss_growth_social_drafts enable row level security;
revoke all on public.podcast_rss_growth_campaigns, public.podcast_rss_growth_deliveries, public.podcast_rss_growth_social_drafts from anon, authenticated;
grant all on public.podcast_rss_growth_campaigns, public.podcast_rss_growth_deliveries, public.podcast_rss_growth_social_drafts to service_role;
create or replace function public.verify_podcast_email_worker_secret(candidate text)
returns boolean language sql security definer set search_path = ''
as $$ select exists(select 1 from vault.decrypted_secrets where name='podcast_email_worker_secret' and decrypted_secret=candidate and candidate is not null and length(candidate)>=24); $$;
revoke all on function public.verify_podcast_email_worker_secret(text) from public, anon, authenticated;
grant execute on function public.verify_podcast_email_worker_secret(text) to service_role;
select cron.schedule('crowrules-rss-growth-automation-minute','* * * * *',$job$
 select net.http_post(
  url := 'https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/podcast-rss-growth-engine',
  headers := jsonb_build_object('Content-Type','application/json','x-podcast-email-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='podcast_email_worker_secret')),
  body := '{"action":"tick"}'::jsonb
 );
$job$);
