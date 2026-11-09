create table if not exists public.podcast_ranking_chart_history (
 id uuid primary key default gen_random_uuid(),
 ranking_type text not null,
 period_type text not null check (period_type in ('7_days','30_days','all_time')),
 entity_type text not null check (entity_type in ('show','host','listener','episode')),
 entity_id uuid not null,
 rank integer not null check (rank > 0),
 score numeric not null default 0,
 metric_count bigint not null default 0,
 captured_at timestamptz not null default now()
);
create index if not exists podcast_ranking_chart_history_lookup
 on public.podcast_ranking_chart_history (ranking_type,period_type,captured_at desc,rank);
alter table public.podcast_ranking_chart_history enable row level security;
drop policy if exists "Public can read ranking chart history" on public.podcast_ranking_chart_history;
create policy "Public can read ranking chart history" on public.podcast_ranking_chart_history for select to anon,authenticated using (true);
drop policy if exists "Admins manage ranking chart history" on public.podcast_ranking_chart_history;
create policy "Admins manage ranking chart history" on public.podcast_ranking_chart_history for all to authenticated using (private.crowrules_is_admin_impl()) with check (private.crowrules_is_admin_impl());
grant select on public.podcast_ranking_chart_history to anon,authenticated;
grant insert,update,delete on public.podcast_ranking_chart_history to authenticated;

create table if not exists public.podcast_ranking_featured (
 ranking_type text primary key,
 period_type text not null default '7_days' check (period_type in ('7_days','30_days','all_time')),
 is_featured boolean not null default true,
 display_order integer not null default 0,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.podcast_ranking_featured enable row level security;
drop policy if exists "Public can read featured rankings" on public.podcast_ranking_featured;
create policy "Public can read featured rankings" on public.podcast_ranking_featured for select to anon,authenticated using (is_featured=true);
drop policy if exists "Admins manage featured rankings" on public.podcast_ranking_featured;
create policy "Admins manage featured rankings" on public.podcast_ranking_featured for all to authenticated using (private.crowrules_is_admin_impl()) with check (private.crowrules_is_admin_impl());
grant select on public.podcast_ranking_featured to anon,authenticated;
grant insert,update,delete on public.podcast_ranking_featured to authenticated;

create or replace function public.podcasting_admin_capture_ranking_snapshot(p_period_type text default '7_days')
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
 v_period text := case p_period_type when 'weekly' then '7_days' when 'monthly' then '30_days' else p_period_type end;
 v_count integer := 0;
begin
 if not private.crowrules_is_admin_impl() then
   raise exception 'Administrator access required';
 end if;
 if v_period not in ('7_days','30_days','all_time') then
   raise exception 'Unsupported ranking period';
 end if;
 insert into public.podcast_ranking_chart_history
  (ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
 select 'podcasts',v_period,'show',v.podcast_id,v.ranking,v.ranking_score,v.listens,now()
 from public.podcast_rankings_period_live v
 where v.period_type=v_period
 order by v.ranking
 on conflict do nothing;
 get diagnostics v_count = row_count;
 return v_count;
end;
$$;
revoke all on function public.podcasting_admin_capture_ranking_snapshot(text) from public,anon;
grant execute on function public.podcasting_admin_capture_ranking_snapshot(text) to authenticated;

insert into public.podcast_ranking_featured(ranking_type,period_type,is_featured,display_order)
values ('podcasts','7_days',true,0),('episodes','7_days',false,1),('hosts','all_time',false,2),('listeners','all_time',false,3)
on conflict (ranking_type) do nothing;
