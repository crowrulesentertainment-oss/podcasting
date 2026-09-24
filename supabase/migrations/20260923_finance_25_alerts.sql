create table if not exists public.cr_podcast_finance_alerts (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.creators(id) on delete cascade,
 alert_type text not null check (alert_type in ('milestone','payout','refund','dispute','account','system')),
 title text not null,
 message text not null,
 threshold_cents bigint,
 currency text,
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists cr_podcast_finance_alerts_creator_created_idx on public.cr_podcast_finance_alerts(creator_id,created_at desc);
alter table public.cr_podcast_finance_alerts enable row level security;
drop policy if exists "creators read own finance alerts" on public.cr_podcast_finance_alerts;
create policy "creators read own finance alerts" on public.cr_podcast_finance_alerts for select to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
drop policy if exists "creators update own finance alerts" on public.cr_podcast_finance_alerts;
create policy "creators update own finance alerts" on public.cr_podcast_finance_alerts for update to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid())) with check (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
revoke all on table public.cr_podcast_finance_alerts from anon;
grant select,update on table public.cr_podcast_finance_alerts to authenticated;
create or replace function public.get_my_podcast_finance_alerts(p_limit integer default 50)
returns setof public.cr_podcast_finance_alerts
language sql security definer set search_path=public as $$
 select a.* from public.cr_podcast_finance_alerts a
 where a.creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid())
 order by a.created_at desc limit greatest(1,least(coalesce(p_limit,50),100));
$$;
revoke all on function public.get_my_podcast_finance_alerts(integer) from public;
grant execute on function public.get_my_podcast_finance_alerts(integer) to authenticated;