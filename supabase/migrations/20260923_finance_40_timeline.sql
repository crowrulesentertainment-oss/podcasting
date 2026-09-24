create or replace function public.get_my_podcast_finance_timeline(p_limit integer default 40,p_event_type text default null)
returns table(event_id text,event_kind text,event_type text,title text,message text,amount_cents bigint,currency text,occurred_at timestamptz,is_read boolean,period_key text)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_limit integer:=least(greatest(coalesce(p_limit,40),1),100);
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return; end if;
 return query
 select * from (
   select 'alert:'||a.id::text,a.alert_type::text,a.alert_type::text,a.title,a.message,a.threshold_cents,a.currency,a.created_at,a.is_read,null::text
   from public.cr_podcast_finance_alerts a
   where a.creator_id=v_creator and (p_event_type is null or a.alert_type=p_event_type)
   union all
   select 'trigger:'||t.id::text,'milestone_trigger',t.event_type,
          'Milestone triggered',
          'Rule milestone reached for period '||coalesce(t.period_key,'lifetime'),
          t.actual_cents,t.currency,t.triggered_at,true,t.period_key
   from public.cr_podcast_finance_alert_rule_triggers t
   where t.creator_id=v_creator and (p_event_type is null or t.event_type=p_event_type)
 ) z
 order by occurred_at desc limit v_limit;
end $$;
revoke all on function public.get_my_podcast_finance_timeline(integer,text) from public;
grant execute on function public.get_my_podcast_finance_timeline(integer,text) to authenticated;