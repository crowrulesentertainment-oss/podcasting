create or replace function public.get_my_podcast_finance_trends(p_months integer default 12)
returns table(month_start date,currency text,transaction_count bigint,gross_cents bigint,platform_fee_cents bigint,refund_cents bigint,dispute_cents bigint,creator_net_cents bigint,paid_out_cents bigint)
language sql security definer set search_path=public as $$
with me as (select c.id creator_id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1),
months as (select generate_series(date_trunc('month',current_date)-(greatest(1,least(coalesce(p_months,12),36))-1)*interval '1 month',date_trunc('month',current_date),interval '1 month')::date month_start),
rev as (
 select date_trunc('month',rs.created_at)::date month_start,rs.currency::text currency,count(*) transaction_count,
 sum(rs.gross_cents) gross_cents,sum(rs.platform_fee_cents) platform_fee_cents,
 sum(rs.refund_cents) refund_cents,sum(rs.dispute_cents) dispute_cents,sum(rs.creator_net_cents) creator_net_cents
 from public.cr_podcast_revenue_splits rs join me on me.creator_id=rs.creator_id
 where rs.created_at >= date_trunc('month',current_date)-(greatest(1,least(coalesce(p_months,12),36))-1)*interval '1 month'
 group by 1,2
), pay as (
 select date_trunc('month',p.created_at)::date month_start,p.currency::text currency,
 sum(case when p.status in ('paid','completed','succeeded') then p.amount_cents else 0 end) paid_out_cents
 from public.cr_podcast_payouts p join me on me.creator_id=p.creator_id
 where p.created_at >= date_trunc('month',current_date)-(greatest(1,least(coalesce(p_months,12),36))-1)*interval '1 month'
 group by 1,2
)
select coalesce(r.month_start,p.month_start),coalesce(r.currency,p.currency),coalesce(r.transaction_count,0),
coalesce(r.gross_cents,0),coalesce(r.platform_fee_cents,0),coalesce(r.refund_cents,0),coalesce(r.dispute_cents,0),
coalesce(r.creator_net_cents,0),coalesce(p.paid_out_cents,0)
from rev r full join pay p using(month_start,currency)
order by 1,2;
$$;
revoke all on function public.get_my_podcast_finance_trends(integer) from public;
grant execute on function public.get_my_podcast_finance_trends(integer) to authenticated;