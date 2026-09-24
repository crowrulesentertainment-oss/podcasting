alter table public.cr_podcast_finance_alert_rules add column if not exists reset_period text not null default 'lifetime' check (reset_period in ('lifetime','monthly','annual'));
alter table public.cr_podcast_finance_alert_rule_triggers add column if not exists period_key text;
create index if not exists cr_podcast_rule_triggers_period_idx on public.cr_podcast_finance_alert_rule_triggers(rule_id,period_key,triggered_at desc);
create or replace function public.evaluate_creator_finance_rule_event(p_creator_id uuid,p_event_type text,p_event_record_id text,p_actual_cents bigint,p_currency text,p_occurred_at timestamptz default now())
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_count integer:=0; v_period text; v_exists boolean;
begin
 if p_creator_id is null or p_actual_cents is null or p_actual_cents<=0 then return 0; end if;
 for r in select * from public.cr_podcast_finance_alert_rules where creator_id=p_creator_id and enabled and lower(currency)=lower(coalesce(p_currency,'usd')) loop
   if not ((r.rule_type='payment_milestone' and p_event_type='payment') or (r.rule_type='revenue_milestone' and p_event_type='revenue') or (r.rule_type='payout_milestone' and p_event_type='payout')) then continue; end if;
   v_period:=case r.reset_period when 'monthly' then to_char(p_occurred_at at time zone 'UTC','YYYY-MM') when 'annual' then to_char(p_occurred_at at time zone 'UTC','YYYY') else 'lifetime' end;
   v_exists:=exists(select 1 from public.cr_podcast_finance_alert_rule_triggers t where t.rule_id=r.id and t.period_key=v_period);
   if not v_exists or r.repeatable then
     insert into public.cr_podcast_finance_alert_rule_triggers(rule_id,creator_id,event_type,event_record_id,threshold_cents,actual_cents,currency,period_key)
     values(r.id,p_creator_id,p_event_type,p_event_record_id,r.threshold_cents,p_actual_cents,lower(coalesce(p_currency,'usd')),v_period)
     on conflict(rule_id,event_type,event_record_id) do nothing;
     if found then
       insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,threshold_cents,currency)
       values(p_creator_id,'milestone',r.rule_name,'Smart finance rule reached for '||v_period||'.',r.threshold_cents,lower(coalesce(p_currency,'usd')));
       update public.cr_podcast_finance_alert_rules set last_triggered_at=p_occurred_at,updated_at=now() where id=r.id;
       v_count:=v_count+1;
     end if;
   end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.evaluate_creator_finance_rule_event(uuid,text,text,bigint,text,timestamptz) from public;
grant execute on function public.evaluate_creator_finance_rule_event(uuid,text,text,bigint,text,timestamptz) to service_role;