-- CrowRules Podcasting — Creator Subscription Manager
alter table public.cr_podcast_monetization_products add column if not exists interval_count integer not null default 1;
alter table public.cr_podcast_monetization_products add column if not exists trial_period_days integer not null default 0;
alter table public.cr_podcast_monetization_products add column if not exists display_order integer not null default 0;
alter table public.cr_podcast_monetization_products add column if not exists features jsonb not null default '[]'::jsonb;
do $$ begin
if not exists(select 1 from pg_constraint where conname='cr_monetization_products_interval_count_check') then alter table public.cr_podcast_monetization_products add constraint cr_monetization_products_interval_count_check check(interval_count between 1 and 36); end if;
if not exists(select 1 from pg_constraint where conname='cr_monetization_products_trial_days_check') then alter table public.cr_podcast_monetization_products add constraint cr_monetization_products_trial_days_check check(trial_period_days between 0 and 365); end if;
if not exists(select 1 from pg_constraint where conname='cr_monetization_products_features_array') then alter table public.cr_podcast_monetization_products add constraint cr_monetization_products_features_array check(jsonb_typeof(features)='array'); end if;
end $$;
create index if not exists cr_monetization_products_membership_idx on public.cr_podcast_monetization_products(creator_id,podcast_id,active,product_type);