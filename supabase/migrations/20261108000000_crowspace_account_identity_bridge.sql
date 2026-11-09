-- CrowSpace identity bridge: one Supabase Auth user <-> one existing Podcasting member.
-- Existing social tables remain the source of truth for their current features.
create unique index if not exists members_user_id_unique_idx
  on public.members (user_id)
  where user_id is not null;

create table if not exists public.crowspace_account_links (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  member_id uuid not null unique references public.members(id) on delete cascade,
  linked_at timestamptz not null default now()
);

alter table public.crowspace_account_links enable row level security;

revoke all on table public.crowspace_account_links from anon, authenticated;
grant select on table public.crowspace_account_links to authenticated;

drop policy if exists "Members can view their own CrowSpace account link" on public.crowspace_account_links;
create policy "Members can view their own CrowSpace account link"
  on public.crowspace_account_links
  for select
  to authenticated
  using ((select auth.uid()) = auth_user_id);

create or replace function public.sync_crowspace_account_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.user_id is not null
     and (new.user_id is null or new.user_id <> old.user_id) then
    delete from public.crowspace_account_links
    where auth_user_id = old.user_id;
  end if;

  if new.user_id is not null then
    insert into public.crowspace_account_links (auth_user_id, member_id, linked_at)
    values (new.user_id, new.id, now())
    on conflict (auth_user_id) do update
      set member_id = excluded.member_id,
          linked_at = now();
  end if;

  return new;
end;
$$;

revoke all on function public.sync_crowspace_account_link() from public, anon, authenticated;

drop trigger if exists members_sync_crowspace_account_link on public.members;
create trigger members_sync_crowspace_account_link
  after insert or update of user_id on public.members
  for each row execute function public.sync_crowspace_account_link();

insert into public.crowspace_account_links (auth_user_id, member_id, linked_at)
select m.user_id, m.id, now()
from public.members m
where m.user_id is not null
on conflict (auth_user_id) do update
  set member_id = excluded.member_id;

comment on table public.crowspace_account_links is
  'CrowSpace identity bridge to the existing CrowRules Podcasting member record; auth_user_id remains the account identity.';
