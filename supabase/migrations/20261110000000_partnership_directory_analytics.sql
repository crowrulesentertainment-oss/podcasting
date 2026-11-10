-- CrowRules Podcasting partnership directory and engagement analytics
-- Additive schema only. Existing business_inquiries and business_partnerships are preserved.
create table if not exists public.podcast_public_partners (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null check (char_length(btrim(organization_name)) between 1 and 180),
  short_description text not null default '' check (char_length(short_description) <= 1200),
  category text not null default 'Community Partner',
  recognition_tier text not null default 'Community Partner'
    check (recognition_tier in ('Founding Partner','Gold Partner','Community Partner','Media Partner','Technology Partner')),
  logo_url text,
  website_url text,
  is_featured boolean not null default false,
  is_active boolean not null default false,
  spotlight_month date,
  spotlight_title text,
  spotlight_story text,
  episode_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.podcast_public_partners enable row level security;
create policy "Public can view active podcast partners" on public.podcast_public_partners
  for select to anon, authenticated using (is_active = true);
create policy "Admins manage podcast public partners" on public.podcast_public_partners
  for all to authenticated
  using ((select private.crowrules_is_admin_impl()))
  with check ((select private.crowrules_is_admin_impl()));
grant select on public.podcast_public_partners to anon, authenticated;
grant insert, update, delete on public.podcast_public_partners to authenticated;

create table if not exists public.podcast_partnership_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('page_view','partner_click','spotlight_click','media_kit_open','apply_click','application_submit')),
  partner_id uuid references public.podcast_public_partners(id) on delete set null,
  campaign_key text,
  campaign_source text,
  campaign_medium text,
  campaign_content text,
  referral_code text,
  page_path text,
  referrer_host text,
  created_at timestamptz not null default now()
);
create index if not exists podcast_partnership_events_created_at_idx on public.podcast_partnership_events(created_at desc);
create index if not exists podcast_partnership_events_type_created_idx on public.podcast_partnership_events(event_type, created_at desc);
alter table public.podcast_partnership_events enable row level security;
create policy "Public can record partnership engagement" on public.podcast_partnership_events
  for insert to anon, authenticated
  with check (
    event_type in ('page_view','partner_click','spotlight_click','media_kit_open','apply_click','application_submit')
    and (campaign_key is null or char_length(campaign_key) <= 100)
    and (campaign_source is null or char_length(campaign_source) <= 100)
    and (campaign_medium is null or char_length(campaign_medium) <= 100)
    and (campaign_content is null or char_length(campaign_content) <= 150)
    and (referral_code is null or char_length(referral_code) <= 100)
    and (page_path is null or char_length(page_path) <= 300)
    and (referrer_host is null or char_length(referrer_host) <= 160)
  );
create policy "Admins can view partnership engagement" on public.podcast_partnership_events
  for select to authenticated using ((select private.crowrules_is_admin_impl()));
grant insert on public.podcast_partnership_events to anon, authenticated;
grant select on public.podcast_partnership_events to authenticated;
