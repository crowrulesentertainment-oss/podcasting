create table if not exists public.cr_podcast_finance_rule_progress (
 id uuid primary key default gen_random_uuid(),
 rule_id uuid not null references public.cr_podcast_finance_alert_rules(id) on delete cascade,
 creator_id uuid not null,
 period_key text not null,
 total_cents bigint not null default 0,
 currency text not null default 'usd',
 event_count integer not null default 0,
 updated_at timestamptz not null default now(),
 unique(rule_id,period_key)
);
alter table public.cr_podcast_finance_rule_progress enable row level security;
drop policy if exists "creator read own finance rule progress" on public.cr_podcast_finance_rule_progress;
create policy "creator read own finance rule progress" on public.cr_podcast_finance_rule_progress for select using (creator_id in (select id from public.creators where member_id in (select id from public.members where user_id=auth.uid())));
revoke all on public.cr_podcast_finance_rule_progress from anon;
revoke all on public.cr_podcast_finance_rule_progress from authenticated;
grant select on public.cr_podcast_finance_rule_progress to authenticated;
create or replace function public.evaluate_creator_finance_rule_cumulative(p_creator_id uuid,p_event_type text,p_event_record_id text,p_actual_cents bigint,p_currency text default 'usd',p_occurred_at timestamptz default now())
returns integer language plpgsql security definer set search_path=public as $$
declare r record; v_period text; v_total bigint; v_id uuid; v_already boolean; v_count integer:=0;
begin
 if p_creator_id is null or p_actual_cents is null or p_actual_cents<=0 then return 0; end if;
 for r in select * from public.cr_podcast_finance_alert_rules where creator_id=p_creator_id and enabled and lower(currency)=lower(coalesce(p_currency,'usd')) loop
   if not ((r.rule_type='payment_milestone' and p_event_type='payment') or (r.rule_type='revenue_milestone' and p_event_type='revenue') or (r.rule_type='payout_milestone' and p_event_type='payout')) then continue; end if;
   v_period:=case r.reset_period when 'monthly' then to_char(p_occurred_at at time zone 'UTC','YYYY-MM') when 'annual' then to_char(p_occurred_at at time zone 'UTC','YYYY') else 'lifetime' end;
   insert into public.cr_podcast_finance_rule_progress(rule_id,creator_id,period_key,total_cents,currency,event_count)
   values(r.id,p_creator_id,v_period,p_actual_cents,lower(coalesce(p_currency,'usd')),1)
   on conflict(rule_id,period_key) do update set total_cents=public.cr_podcast_finance_rule_progress.total_cents+excluded.total_cents,event_count=public.cr_podcast_finance_rule_progress.event_count+1,updated_at=now()
   returning total_cents into v_total;
   v_already:=exists(select 1 from public.cr_podcast_finance_alert_rule_triggers t where t.rule_id=r.id and t.period_key=v_period);
   if v_total>=r.threshold_cents and (not v_already or r.repeatable) then
     insert into public.cr_podcast_finance_alert_rule_triggers(rule_id,creator_id,event_type,event_record_id,threshold_cents,actual_cents,currency,period_key)
     values(r.id,p_creator_id,p_event_type,p_event_record_id,r.threshold_cents,v_total,lower(coalesce(p_currency,'usd')),v_period)
     on conflict(rule_id,event_type,event_record_id) do nothing;
     if found then
       insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,threshold_cents,currency)
       values(p_creator_id,'milestone',r.rule_name,'Cumulative '||p_event_type||' total reached '||to_char(v_total/100.0,'FM999999990.00')||' '||upper(coalesce(p_currency,'usd'))||' for '||v_period||'.',r.threshold_cents,lower(coalesce(p_currency,'usd')));
       update public.cr_podcast_finance_alert_rules set last_triggered_at=p_occurred_at,updated_at=now() where id=r.id;
       v_count:=v_count+1;
     end if;
   end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.evaluate_creator_finance_rule_cumulative(uuid,text,text,bigint,text,timestamptz) from public;
grant execute on function public.evaluate_creator_finance_rule_cumulative(uuid,text,text,bigint,text,timestamptz) to service_role;
