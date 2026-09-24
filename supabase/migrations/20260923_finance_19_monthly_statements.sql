-- CrowRules Podcasting Finance 19.0: monthly statement center
create or replace function public.get_my_podcast_monthly_statement_center()
returns table(
  statement_month date,
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
set search_path = public
as $$
  with me as (
    select c.id as creator_id
    from public.creators c
    join public.members m on m.id = c.member_id
    where m.user_id = auth.uid()
    limit 1
  ),
  rev as (
    select date_trunc('month', rs.created_at)::date as statement_month,
           rs.currency::text as currency,
           count(*)::bigint transaction_count,
           coalesce(sum(rs.gross_cents),0)::bigint gross_cents,
           coalesce(sum(rs.platform_fee_cents),0)::bigint platform_fee_cents,
           coalesce(sum(rs.refund_cents),0)::bigint refunds_cents,
           coalesce(sum(rs.dispute_cents),0)::bigint disputes_cents,
           coalesce(sum(greatest(0,rs.creator_net_cents-rs.refund_cents-rs.dispute_cents)),0)::bigint adjusted_creator_net_cents
    from public.cr_podcast_revenue_splits rs
    join me on me.creator_id=rs.creator_id
    group by 1,2
  ),
  pay as (
    select date_trunc('month', p.created_at)::date statement_month,
           p.currency::text currency,
           coalesce(sum(case when p.status='paid' then p.amount_cents else 0 end),0)::bigint paid_out_cents,
           coalesce(sum(case when p.status in ('pending','in_transit') then p.amount_cents else 0 end),0)::bigint pending_payout_cents
    from public.cr_podcast_payouts p
    join me on me.creator_id=p.creator_id
    group by 1,2
  )
  select coalesce(r.statement_month,p.statement_month) statement_month,
         coalesce(r.currency,p.currency) currency,
         coalesce(r.transaction_count,0),
         coalesce(r.gross_cents,0),
         coalesce(r.platform_fee_cents,0),
         coalesce(r.refunds_cents,0),
         coalesce(r.disputes_cents,0),
         coalesce(r.adjusted_creator_net_cents,0),
         coalesce(p.paid_out_cents,0),
         coalesce(p.pending_payout_cents,0)
  from rev r full join pay p using(statement_month,currency)
  order by statement_month desc, currency;
$$;
revoke all on function public.get_my_podcast_monthly_statement_center() from public;
grant execute on function public.get_my_podcast_monthly_statement_center() to authenticated;
