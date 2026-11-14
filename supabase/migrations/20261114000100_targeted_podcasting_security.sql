-- CrowRules Podcasting targeted security remediation
-- Safe to apply after reviewing the current production schema.
-- Preserves existing rows, creator ownership, and the existing product SELECT policy.

begin;

-- A creator may read their own profile, or another creator's profile only
-- when that creator has explicitly opted into discovery.
drop policy if exists creator_profiles_select_authenticated on public.creator_profiles;
create policy creator_profiles_select_authenticated
on public.creator_profiles
for select
to authenticated
using (user_id = (select auth.uid()) or is_discoverable is true);

-- Enforce podcast-to-creator ownership even for service-role Edge Functions.
-- This trigger is deliberately independent of RLS and rejects mismatched links.
create or replace function public.enforce_podcast_monetization_product_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  podcast_creator uuid;
begin
  if new.podcast_id is null then
    return new;
  end if;

  select p.creator_id
    into podcast_creator
  from public.podcasts as p
  where p.id = new.podcast_id;

  if not found or podcast_creator is distinct from new.creator_id then
    raise exception 'Monetization product must belong to the owner of the linked podcast'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_podcast_monetization_product_owner
on public.cr_podcast_monetization_products;

create trigger enforce_podcast_monetization_product_owner
before insert or update of creator_id, podcast_id
on public.cr_podcast_monetization_products
for each row
execute function public.enforce_podcast_monetization_product_owner();

-- Retain the existing creator ownership rule and additionally require
-- any linked podcast to belong to the same creator.
drop policy if exists "creators manage own monetization products"
on public.cr_podcast_monetization_products;

create policy "creators manage own monetization products"
on public.cr_podcast_monetization_products
for all
to authenticated
using (
  creator_id in (
    select c.id
    from public.creators as c
    join public.members as m on m.id = c.member_id
    where m.user_id = (select auth.uid())
  )
  and (
    podcast_id is null
    or exists (
      select 1
      from public.podcasts as p
      where p.id = cr_podcast_monetization_products.podcast_id
        and p.creator_id = cr_podcast_monetization_products.creator_id
    )
  )
)
with check (
  creator_id in (
    select c.id
    from public.creators as c
    join public.members as m on m.id = c.member_id
    where m.user_id = (select auth.uid())
  )
  and (
    podcast_id is null
    or exists (
      select 1
      from public.podcasts as p
      where p.id = cr_podcast_monetization_products.podcast_id
        and p.creator_id = cr_podcast_monetization_products.creator_id
    )
  )
);

commit;
