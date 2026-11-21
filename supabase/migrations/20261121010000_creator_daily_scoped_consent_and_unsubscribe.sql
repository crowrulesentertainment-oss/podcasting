create table if not exists public.podcast_creator_daily_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consented boolean not null default false,
  consent_at timestamptz,
  consent_source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint podcast_creator_daily_consent_source_check
    check (consent_source is null or consent_source in ('creator_studio_dashboard','creator_daily_preferences','creator_daily_unsubscribe'))
);

create index if not exists podcast_creator_daily_consents_eligible_idx
  on public.podcast_creator_daily_consents (consented, consent_at)
  where consented = true and unsubscribed_at is null;

alter table public.podcast_creator_daily_consents enable row level security;
revoke all on public.podcast_creator_daily_consents from anon, authenticated;
grant all on public.podcast_creator_daily_consents to service_role;

create table if not exists public.podcast_creator_daily_unsubscribe_tokens (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index if not exists podcast_creator_daily_unsubscribe_tokens_user_idx
  on public.podcast_creator_daily_unsubscribe_tokens (user_id, created_at desc);

alter table public.podcast_creator_daily_unsubscribe_tokens enable row level security;
revoke all on public.podcast_creator_daily_unsubscribe_tokens from anon, authenticated;
grant all on public.podcast_creator_daily_unsubscribe_tokens to service_role;