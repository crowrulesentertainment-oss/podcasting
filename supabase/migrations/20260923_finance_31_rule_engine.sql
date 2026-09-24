create table if not exists public.cr_podcast_finance_alert_rule_triggers (
 id uuid primary key default gen_random_uuid(),
 rule_id uuid not null references public.cr_podcast_finance_alert_rules(id) on delete cascade,
 creator_id uuid not null references public.creators(id) on delete cascade,
 event_type text not null,
 event_record_id text,
 threshold_cents bigint not null,
 actual_cents bigint not null,
 currency text not null,
 triggered_at timestamptz not null default now(),
 unique(rule_id,event_type,event_record_id)
);
create index if not exists cr_podcast_finance_alert_rule_triggers_creator_idx on public.cr_podcast_finance_alert_rule_triggers(creator_id,triggered_at desc);
alter table public.cr_podcast_finance_alert_rule_triggers enable row level security;
drop policy if exists "creators read own rule triggers" on public.cr_podcast_finance_alert_rule_triggers;
create policy "creators read own rule triggers" on public.cr_podcast_finance_alert_rule_triggers for select to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
revoke all on public.cr_podcast_finance_alert_rule_triggers from anon;
grant select on public.cr_podcast_finance_alert_rule_triggers to authenticated;
create or replace function public.evaluate_my_podcast_finance_alert_rules(p_event_type text,p_event_record_id text,p_actual_cents bigint,p_currency text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_creator uuid; r record; v_count integer:=0; v_id uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 for r in select * from public.cr_podcast_finance_alert_rules where creator_id=v_creator and enabled and lower(currency)=lower(p_currency) and (
   (rule_type='payment_milestone' and p_event_type='payment') or
   (rule_type='revenue_milestone' and p_event_type='revenue') or
   (rule_type='payout_milestone' and p_event_type='payout')) and p_actual_cents>=threshold_cents loop
   if r.repeatable or not exists(select 1 from public.cr_podcast_finance_alert_rule_triggers t where t.rule_id=r.id) then
     insert into public.cr_podcast_finance_alert_rule_triggers(rule_id,creator_id,event_type,event_record_id,threshold_cents,actual_cents,currency)
     values(r.id,v_creator,p_event_type,p_event_record_id,r.threshold_cents,p_actual_cents,lower(p_currency)) on conflict do nothing returning id into v_id;
     if v_id is not null then
       insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,threshold_cents,currency)
       values(v_creator,'milestone',r.rule_name,'Smart finance rule reached: '||r.rule_name||'.',r.threshold_cents,lower(p_currency));
       update public.cr_podcast_finance_alert_rules set last_triggered_at=now(),updated_at=now() where id=r.id;
       v_count:=v_count+1;
     end if;
   end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.evaluate_my_podcast_finance_alert_rules(text,text,bigint,text) from public;
grant execute on function public.evaluate_my_podcast_finance_alert_rules(text,text,bigint,text) to authenticated;