create or replace function public.podcasting_admin_capture_ranking_snapshot(p_period_type text default '7_days')
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
 v_period text := case p_period_type when 'weekly' then '7_days' when 'monthly' then '30_days' else p_period_type end;
 v_count integer := 0;
 v_inserted integer := 0;
begin
 if not private.crowrules_is_admin_impl() then raise exception 'Administrator access required'; end if;
 if v_period not in ('7_days','30_days','all_time') then raise exception 'Unsupported ranking period'; end if;
 insert into public.podcast_ranking_chart_history (ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
 select 'podcasts',v_period,'show',v.podcast_id,v.ranking,v.ranking_score,v.listens,now() from public.podcast_rankings_period_live v where v.period_type=v_period order by v.ranking;
 get diagnostics v_inserted = row_count; v_count := v_count + v_inserted;
 insert into public.podcast_ranking_chart_history (ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
 select 'hosts',v_period,'host',v.host_key::uuid,v.ranking,v.ranking_score,v.listens,now() from public.host_rankings_period_live v where v.period_type=v_period and v.host_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' order by v.ranking;
 get diagnostics v_inserted = row_count; v_count := v_count + v_inserted;
 insert into public.podcast_ranking_chart_history (ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
 select 'episodes',v_period,'episode',v.episode_id,v.ranking,v.ranking_score,v.listens,now() from public.episode_rankings_period_live v where v.period_type=v_period order by v.ranking;
 get diagnostics v_inserted = row_count; v_count := v_count + v_inserted;
 if v_period='all_time' then
  insert into public.podcast_ranking_chart_history (ranking_type,period_type,entity_type,entity_id,rank,score,metric_count,captured_at)
  select 'listeners','all_time','listener',ranked.user_id,ranked.position,ranked.qualified_plays,ranked.qualified_plays,now()
  from (select l.user_id,l.qualified_plays,row_number() over(order by l.qualified_plays desc,l.unique_episodes desc,l.user_id) as position from public.get_public_podcast_listener_play_leaderboard() l where l.qualified_plays > 0) ranked;
  get diagnostics v_inserted = row_count; v_count := v_count + v_inserted;
 end if;
 return v_count;
end;
$function$;
revoke all on function public.podcasting_admin_capture_ranking_snapshot(text) from public, anon;
grant execute on function public.podcasting_admin_capture_ranking_snapshot(text) to authenticated;