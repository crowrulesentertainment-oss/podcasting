create or replace function public.get_my_podcast_finance_command_center()
returns table(currency text, gross_cents bigint, platform_fee_cents bigint, refunds_cents bigint, disputes_cents bigint, creator_net_cents bigint, paid_out_cents bigint, pending_payout_cents bigint, transaction_count bigint)
language sql security definer set search_path=public as $$
with me as (select c.id creator_id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1),
rev as (
 select rs.currency::text currency,count(*) transaction_count,
 sum(rs.gross_cents) gross_cents,sum(rs.platform_fee_cents) platform_fee_cents,
 sum(rs.refund_cents) refunds_cents,sum(rs.dispute_cents) disputes_cents,
 sum(rs.creator_net_cents) creator_net_cents
 from public.cr_podcast_revenue_splits rs join me on me.creator_id=rs.creator_id
 group by rs.currency
), pay as (
 select p.currency::text currency,
 coalesce(sum(case when p.status in ('paid','completed','succeeded') then p.amount_cents else 0 end),0) paid_out_cents,
 coalesce(sum(case when p.status not in ('paid','completed','succeeded','failed','canceled','cancelled') then p.amount_cents else 0 end),0) pending_payout_cents
 from public.cr_podcast_payouts p join me on me.creator_id=p.creator_id
 group by p.currency
)
select coalesce(rev.currency,pay.currency),coalesce(rev.gross_cents,0),coalesce(rev.platform_fee_cents,0),
coalesce(rev.refunds_cents,0),coalesce(rev.disputes_cents,0),coalesce(rev.creator_net_cents,0),
coalesce(pay.paid_out_cents,0),coalesce(pay.pending_payout_cents,0),coalesce(rev.transaction_count,0)
from rev full join pay using(currency);
$$;
revoke all on function public.get_my_podcast_finance_command_center() from public;
grant execute on function public.get_my_podcast_finance_command_center() to authenticated;