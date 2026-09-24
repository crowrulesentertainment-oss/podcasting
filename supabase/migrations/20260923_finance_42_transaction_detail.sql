create or replace function public.get_my_podcast_finance_transaction_detail(p_transaction_id uuid)
returns table(id uuid,creator_id uuid,stripe_checkout_session_id text,stripe_payment_intent_id text,gross_cents bigint,stripe_fee_cents bigint,platform_fee_cents bigint,creator_net_cents bigint,refund_cents bigint,dispute_cents bigint,currency text,status text,reconciled_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 return query select s.id,s.creator_id,s.stripe_checkout_session_id,s.stripe_payment_intent_id,s.gross_cents,s.stripe_fee_cents,s.platform_fee_cents,s.creator_net_cents,s.refund_cents,s.dispute_cents,s.currency,s.status,s.reconciled_at,s.created_at
 from public.cr_podcast_revenue_splits s where s.id=p_transaction_id and s.creator_id=v_creator;
end $$;
revoke all on function public.get_my_podcast_finance_transaction_detail(uuid) from public;
grant execute on function public.get_my_podcast_finance_transaction_detail(uuid) to authenticated;