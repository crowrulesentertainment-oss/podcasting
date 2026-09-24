create or replace function public.get_my_podcast_finance_transaction_settlement(p_transaction_id uuid)
returns table(currency text,gross_cents bigint,stripe_fee_cents bigint,platform_fee_cents bigint,refund_cents bigint,dispute_cents bigint,creator_net_cents bigint,adjusted_creator_net_cents bigint,paid_payout_cents bigint,pending_payout_cents bigint,settled_cents bigint,unsettled_cents bigint,reconciliation_status text)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select s.creator_id into v_creator from public.cr_podcast_revenue_splits s where s.id=p_transaction_id;
 if v_creator is null then return; end if;
 if not exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=v_creator and m.user_id=auth.uid()) then return; end if;
 return query
 with s as (
   select rs.currency,
          sum(rs.gross_cents)::bigint gross,
          sum(coalesce(rs.stripe_fee_cents,0))::bigint stripe_fee,
          sum(coalesce(rs.platform_fee_cents,0))::bigint platform_fee,
          sum(coalesce(rs.refund_cents,0))::bigint refunds,
          sum(coalesce(rs.dispute_cents,0))::bigint disputes,
          sum(coalesce(rs.creator_net_cents,0))::bigint creator_net
   from public.cr_podcast_revenue_splits rs where rs.id=p_transaction_id group by rs.currency
 ), p as (
   select lower(currency) currency,
     sum(case when status in ('paid','completed') then amount_cents else 0 end)::bigint paid,
     sum(case when status not in ('paid','completed','failed','failed_payout','canceled','cancelled') then amount_cents else 0 end)::bigint pending
   from public.cr_podcast_payouts where creator_id=v_creator and lower(currency)=(select lower(currency) from s)
   group by lower(currency)
 )
 select s.currency,s.gross,s.stripe_fee,s.platform_fee,s.refunds,s.disputes,s.creator_net,
        greatest(0,s.creator_net-s.refunds-s.disputes)::bigint adjusted,
        coalesce(p.paid,0),coalesce(p.pending,0),
        least(greatest(0,s.creator_net-s.refunds-s.disputes),coalesce(p.paid,0))::bigint settled,
        greatest(0,greatest(0,s.creator_net-s.refunds-s.disputes)-least(greatest(0,s.creator_net-s.refunds-s.disputes),coalesce(p.paid,0)))::bigint unsettled,
        case when greatest(0,s.creator_net-s.refunds-s.disputes)<=coalesce(p.paid,0) then 'settled' else 'partially_settled' end
 from s left join p on p.currency=lower(s.currency);
end $$;
revoke all on function public.get_my_podcast_finance_transaction_settlement(uuid) from public;
grant execute on function public.get_my_podcast_finance_transaction_settlement(uuid) to authenticated;