create or replace function public.get_my_podcast_finance_transaction_events(p_transaction_id uuid)
returns table(event_id text,event_kind text,event_type text,title text,message text,amount_cents bigint,currency text,occurred_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if not exists(select 1 from public.cr_podcast_revenue_splits where id=p_transaction_id and creator_id=v_creator) then return; end if;
 return query
 select 'tx:'||s.id::text,'transaction','revenue','Transaction recorded','Revenue split recorded',s.gross_cents,s.currency,s.created_at
 from public.cr_podcast_revenue_splits s where s.id=p_transaction_id
 union all
 select 'refund:'||s.id::text,'adjustment','refund','Refund adjustment','Recorded refund against transaction',s.refund_cents,s.currency,s.updated_at
 from public.cr_podcast_revenue_splits s where s.id=p_transaction_id and coalesce(s.refund_cents,0)>0
 union all
 select 'dispute:'||s.id::text,'adjustment','dispute','Dispute adjustment','Recorded dispute against transaction',s.dispute_cents,s.currency,s.updated_at
 from public.cr_podcast_revenue_splits s where s.id=p_transaction_id and coalesce(s.dispute_cents,0)>0
 union all
 select 'trigger:'||t.id::text,'milestone','milestone', 'Milestone triggered','Finance milestone triggered for period '||coalesce(t.period_key,'lifetime'),t.actual_cents,t.currency,t.triggered_at
 from public.cr_podcast_finance_alert_rule_triggers t
 where t.creator_id=v_creator and t.event_record_id=(select stripe_checkout_session_id from public.cr_podcast_revenue_splits where id=p_transaction_id)
 order by occurred_at;
end $$;
revoke all on function public.get_my_podcast_finance_transaction_events(uuid) from public;
grant execute on function public.get_my_podcast_finance_transaction_events(uuid) to authenticated;