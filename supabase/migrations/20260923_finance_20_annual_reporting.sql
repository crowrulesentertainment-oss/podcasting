-- CrowRules Podcasting Finance 20.0: annual reporting center
create or replace function public.get_my_podcast_annual_reporting()
returns table(
  tax_year integer,
  currency text,
  transaction_count bigint,
  gross_cents bigint,
  platform_fee_cents bigint,
  refunds_cents bigint,
  disputes_cents bigint,
  adjusted_creator_net_cents bigint,
  paid_out_cents bigint,
  pending_payout_cents bigint
)
language sql
security definer
set search_path=public
as $$
with me as (
 select c.id creator_id from public.creators c join public.members m on m.id=c.member_id
 where m.user_id=auth.uid() limit 1
), rev as (
 select extract(year from rs.created_at)::int tax_year, rs.currency::text currency,
 count(*) transaction_count, coalesce(sum(rs.gross_cents),0) gross_cents,
 coalesce(sum(rs.platform_fee_cents),0) platform_fee_cents,
 coalesce(sum(rs.refund_cents),0) refunds_cents,
 coalesce(sum(rs.dispute_cents),0) disputes_cents,
 coalesce(sum(greatest(0,rs.creator_net_cents-rs.refund_cents-rs.dispute_cents)),0) adjusted_creator_net_cents
 from public.cr_podcast_revenue_splits rs join me on me.creator_id=rs.creator_id
 group by 1,2
), pay as (
 select extract(year from p.created_at)::int tax_year,p.currency::text currency,
 coalesce(sum(case when p.status='paid' then p.amount_cents else 0 end),0) paid_out_cents,
 coalesce(sum(case when p.status in ('pending','in_transit') then p.amount_cents else 0 end),0) pending_payout_cents
 from public.cr_podcast_payouts p join me on me.creator_id=p.creator_id group by 1,2
)
select coalesce(r.tax_year,p.tax_year),coalesce(r.currency,p.currency),coalesce(r.transaction_count,0),
coalesce(r.gross_cents,0),coalesce(r.platform_fee_cents,0),coalesce(r.refunds_cents,0),
coalesce(r.disputes_cents,0),coalesce(r.adjusted_creator_net_cents,0),
coalesce(p.paid_out_cents,0),coalesce(p.pending_payout_cents,0)
from rev r full join pay p using(tax_year,currency) order by 1 desc,2;
$$;
revoke all on function public.get_my_podcast_annual_reporting() from public;
grant execute on function public.get_my_podcast_annual_reporting() to authenticated;