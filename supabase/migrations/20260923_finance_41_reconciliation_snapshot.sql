create or replace function public.get_my_podcast_finance_reconciliation_snapshot()
returns table(currency text,transaction_count bigint,unreconciled_transactions bigint,refund_cents bigint,dispute_cents bigint,creator_net_cents bigint,payout_count bigint,paid_payout_cents bigint,pending_payout_cents bigint)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return; end if;
 return query
 select s.currency,count(*)::bigint,
        count(*) filter(where s.reconciled_at is null and (coalesce(s.refund_cents,0)>0 or coalesce(s.dispute_cents,0)>0))::bigint,
        coalesce(sum(s.refund_cents),0)::bigint,coalesce(sum(s.dispute_cents),0)::bigint,
        coalesce(sum(s.creator_net_cents),0)::bigint,
        (select count(*) from public.cr_podcast_payouts p where p.creator_id=v_creator and p.currency=s.currency)::bigint,
        (select coalesce(sum(p.amount_cents),0) from public.cr_podcast_payouts p where p.creator_id=v_creator and p.currency=s.currency and lower(coalesce(p.status,'')) in ('paid','completed'))::bigint,
        (select coalesce(sum(p.amount_cents),0) from public.cr_podcast_payouts p where p.creator_id=v_creator and p.currency=s.currency and lower(coalesce(p.status,'')) not in ('paid','completed','failed','canceled','cancelled'))::bigint
 from public.cr_podcast_revenue_splits s where s.creator_id=v_creator group by s.currency order by s.currency;
end $$;
revoke all on function public.get_my_podcast_finance_reconciliation_snapshot() from public;
grant execute on function public.get_my_podcast_finance_reconciliation_snapshot() to authenticated;