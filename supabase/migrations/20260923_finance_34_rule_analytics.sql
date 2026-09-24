create or replace function public.get_my_podcast_finance_rule_analytics(p_days integer default 365)
returns table(total_rules bigint,active_rules bigint,triggered_rules bigint,total_triggers bigint,payment_triggers bigint,revenue_triggers bigint,payout_triggers bigint,latest_triggered_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_days integer:=greatest(1,least(coalesce(p_days,365),3650));
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 return query
 select (select count(*) from public.cr_podcast_finance_alert_rules r where r.creator_id=v_creator),
 (select count(*) from public.cr_podcast_finance_alert_rules r where r.creator_id=v_creator and r.enabled),
 (select count(distinct t.rule_id) from public.cr_podcast_finance_alert_rule_triggers t where t.creator_id=v_creator and t.triggered_at>=now()-(v_days||' days')::interval),
 (select count(*) from public.cr_podcast_finance_alert_rule_triggers t where t.creator_id=v_creator and t.triggered_at>=now()-(v_days||' days')::interval),
 (select count(*) from public.cr_podcast_finance_alert_rule_triggers t where t.creator_id=v_creator and t.event_type='payment' and t.triggered_at>=now()-(v_days||' days')::interval),
 (select count(*) from public.cr_podcast_finance_alert_rule_triggers t where t.creator_id=v_creator and t.event_type='revenue' and t.triggered_at>=now()-(v_days||' days')::interval),
 (select count(*) from public.cr_podcast_finance_alert_rule_triggers t where t.creator_id=v_creator and t.event_type='payout' and t.triggered_at>=now()-(v_days||' days')::interval),
 (select max(t.triggered_at) from public.cr_podcast_finance_alert_rule_triggers t where t.creator_id=v_creator and t.triggered_at>=now()-(v_days||' days')::interval);
end $$;
revoke all on function public.get_my_podcast_finance_rule_analytics(integer) from public;
grant execute on function public.get_my_podcast_finance_rule_analytics(integer) to authenticated;