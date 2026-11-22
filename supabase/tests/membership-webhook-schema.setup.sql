-- Disposable PostgreSQL fixture for applying the candidate membership webhook SQL.
-- This file is only used by the isolated GitHub Actions PostgreSQL service.
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $roles$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key
);

create table if not exists public.members (
  user_id uuid primary key,
  membership_type text not null default 'Free',
  status text not null default 'Active',
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_plans (
  id uuid primary key,
  plan_key text not null
);

create table if not exists public.membership_subscriptions (
  id uuid primary key,
  user_id uuid not null,
  plan_id uuid references public.membership_plans(id) on delete set null,
  status text not null,
  created_at timestamptz not null default now(),
  site_key text
);
