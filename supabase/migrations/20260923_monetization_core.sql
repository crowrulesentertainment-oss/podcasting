-- CrowRules Podcasting Monetization Core 3.1
-- Apply through Supabase SQL editor/migrations. Review existing schema before production use.
-- Financial truth remains server/webhook controlled; clients receive only RLS-authorized rows.

create table if not exists public.cr_podcast_monetization_products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  podcast_id uuid references public.podcasts(id) on delete cascade,
  product_type text not null check (product_type in ('membership','listener_support','sponsorship','advertising','affiliate','digital_product')),
  name text not null,
  description text,
  currency text not null default 'usd',
  stripe_product_id text,
  stripe_price_id text,
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  interval text check (interval is null or interval in ('one_time','month','year')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cr_podcast_monetization_transactions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  product_id uuid references public.cr_podcast_monetization_products(id) on delete set null,
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  state text not null check (state in ('projected','agreed','pending','paid','refunded','paid_out')),
  source text not null default 'stripe',
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.cr_podcast_entitlements (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade,
  member_user_id uuid,
  product_id uuid references public.cr_podcast_monetization_products(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'active' check (status in ('active','past_due','canceled','expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cr_monetization_products_creator_idx on public.cr_podcast_monetization_products(creator_id);
create index if not exists cr_monetization_transactions_creator_idx on public.cr_podcast_monetization_transactions(creator_id,created_at desc);
create index if not exists cr_entitlements_member_idx on public.cr_podcast_entitlements(member_user_id,status);

alter table public.cr_podcast_monetization_products enable row level security;
alter table public.cr_podcast_monetization_transactions enable row level security;
alter table public.cr_podcast_entitlements enable row level security;

-- Creator product visibility/control. Adjust auth->creator mapping to your canonical CrowRules profile if needed.
create policy "creators manage own monetization products"
on public.cr_podcast_monetization_products
for all to authenticated
using (creator_id in (select id from public.creators where user_id = auth.uid()))
with check (creator_id in (select id from public.creators where user_id = auth.uid()));

-- Transactions are intentionally read-only to creators. Inserts/updates belong to trusted server/webhook code.
create policy "creators read own monetization transactions"
on public.cr_podcast_monetization_transactions
for select to authenticated
using (creator_id in (select id from public.creators where user_id = auth.uid()));

create policy "members read own podcast entitlements"
on public.cr_podcast_entitlements
for select to authenticated
using (member_user_id = auth.uid() or creator_id in (select id from public.creators where user_id = auth.uid()));

comment on table public.cr_podcast_monetization_transactions is 'Financial event ledger; trusted webhook/server writes only.';
comment on table public.cr_podcast_entitlements is 'Access rights derived from verified payment/subscription state.';
