create or replace function public.get_my_podcast_revenue_intelligence(p_months integer default 12)
returns table(currency text,total_gross_cents bigint,total_net_cents bigint,total_paid_out_cents bigint,total_transactions bigint,avg_transaction_cents bigint,refund_cents bigint,dispute_cents bigint,refund_rate_bps bigint,dispute_rate_bps numeric,payout_coverage_bps bigint,peak_month date,peak_month_gross_cents bigint)
language sql security definer set search_path=public as $$
with me as (select c.id creator_id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1),
r as (
 select rs.currency::text currency,rs.created_at,rs.gross_cents,rs.creator_net_cents,rs.refund_cents,rs.dispute_cents
 from public.cr_podcast_revenue_splits rs join me on me.creator_id=rs.creator_id
 where rs.created_at >= date_trunc('month',current_date)-(greatest(1,least(coalesce(p_months,12),36))-1)*interval '1 month'
), agg as (
 select currency,sum(gross_cents) gross,sum(creator_net_cents) net,sum(refund_cents) refunds,sum(dispute_cents) disputes,count(*) tx
 from r group by currency
), pay as (
 select p.currency::text currency,coalesce(sum(case when p.status in ('paid','completed','succeeded') then p.amount_cents else 0 end),0) paid
 from public.cr_podcast_payouts p join me on me.creator_id=p.creator_id
 where p.created_at >= date_trunc('month',current_date)-(greatest(1,least(coalesce(p_months,12),36))-1)*interval '1 month'
 group by p.currency
), peak as (
 select currency,date_trunc('month',created_at)::date month_start,sum(gross_cents) gross,
 row_number() over(partition by currency order by sum(gross_cents) desc) rn from r group by 1,2
)
select a.currency,a.gross,a.net,coalesce(p.paid,0),a.tx,
case when a.tx=0 then 0 else round(a.gross/a.tx)::bigint end,
a.refunds,a.disputes,
case when a.gross=0 then 0 else round(a.refunds*10000.0/a.gross)::bigint end,
case when a.gross=0 then 0 else round(a.disputes*10000.0/a.gross) end,
case when a.net=0 then 0 else least(10000,round(coalesce(p.paid,0)*10000.0/a.net))::bigint end,
k.month_start,k.gross
from agg a left join pay p using(currency) left join peak k on k.currency=a.currency and k.rn=1;
$$;
revoke all on function public.get_my_podcast_revenue_intelligence(integer) from public;
grant execute on function public.get_my_podcast_revenue_intelligence(integer) to authenticated;