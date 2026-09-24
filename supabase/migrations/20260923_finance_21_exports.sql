-- CrowRules Podcasting Finance 21.0: secure export center
create or replace function public.get_my_podcast_finance_export(p_start date default null,p_end date default null)
returns table(record_type text,record_id uuid,occurred_at timestamptz,currency text,gross_cents bigint,platform_fee_cents bigint,refund_cents bigint,dispute_cents bigint,creator_net_cents bigint,status text,reference text)
language sql security definer set search_path=public as $$
with me as (select c.id creator_id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1)
select 'revenue_split',rs.id,rs.created_at,rs.currency::text,rs.gross_cents,rs.platform_fee_cents,rs.refund_cents,rs.dispute_cents,rs.creator_net_cents,rs.status,coalesce(rs.stripe_checkout_session_id,rs.stripe_payment_intent_id)
from public.cr_podcast_revenue_splits rs join me on me.creator_id=rs.creator_id
where (p_start is null or rs.created_at >= p_start::timestamptz) and (p_end is null or rs.created_at < (p_end + 1)::timestamptz)
order by rs.created_at desc;
$$;
revoke all on function public.get_my_podcast_finance_export(date,date) from public;
grant execute on function public.get_my_podcast_finance_export(date,date) to authenticated;