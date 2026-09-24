-- CrowRules Podcasting Finance 18.0: refund/dispute reconciliation
alter table public.cr_podcast_revenue_splits add column if not exists refund_cents bigint not null default 0;
alter table public.cr_podcast_revenue_splits add column if not exists dispute_cents bigint not null default 0;
alter table public.cr_podcast_revenue_splits add column if not exists reconciled_at timestamptz;
alter table public.cr_podcast_revenue_splits drop constraint if exists cr_podcast_revenue_splits_status_check;
alter table public.cr_podcast_revenue_splits add constraint cr_podcast_revenue_splits_status_check check(status in ('pending','paid','refunded','disputed'));
