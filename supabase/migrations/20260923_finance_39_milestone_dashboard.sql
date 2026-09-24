create or replace function public.get_my_podcast_finance_milestone_dashboard()
returns table(rule_id uuid,rule_name text,rule_type text,reset_period text,threshold_cents bigint,currency text,enabled boolean,repeatable boolean,period_key text,total_cents bigint,event_count integer,progress_percent numeric,remaining_cents bigint,last_triggered_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return; end if;
 return query
 select r.id,r.rule_name,r.rule_type,r.reset_period,r.threshold_cents,r.currency,r.enabled,r.repeatable,
        coalesce(p.period_key,case r.reset_period when 'monthly' then to_char(now() at time zone 'UTC','YYYY-MM') when 'annual' then to_char(now() at time zone 'UTC','YYYY') else 'lifetime' end),
        coalesce(p.total_cents,0),coalesce(p.event_count,0),
        case when r.threshold_cents>0 then round(least(100::numeric,(coalesce(p.total_cents,0)::numeric/r.threshold_cents::numeric)*100),1) else 0 end,
        greatest(0::bigint,r.threshold_cents-coalesce(p.total_cents,0)),
        r.last_triggered_at
 from public.cr_podcast_finance_alert_rules r
 left join lateral (
   select * from public.cr_podcast_finance_rule_progress pp
   where pp.rule_id=r.id
     and pp.period_key=case r.reset_period when 'monthly' then to_char(now() at time zone 'UTC','YYYY-MM') when 'annual' then to_char(now() at time zone 'UTC','YYYY') else 'lifetime' end
   limit 1
 ) p on true
 where r.creator_id=v_creator
 order by r.enabled desc,r.updated_at desc;
end $$;
revoke all on function public.get_my_podcast_finance_milestone_dashboard() from public;
grant execute on function public.get_my_podcast_finance_milestone_dashboard() to authenticated;