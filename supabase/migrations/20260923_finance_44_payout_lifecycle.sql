create or replace function public.get_my_podcast_finance_transaction_payouts(p_transaction_id uuid)
returns table(payout_id uuid,stripe_payout_id text,amount_cents bigint,currency text,status text,arrival_date timestamptz,paid_at timestamptz,external_reference text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_currency text;
begin
 select s.creator_id,s.currency into v_creator,v_currency from public.cr_podcast_revenue_splits s where s.id=p_transaction_id;
 if v_creator is null then return; end if;
 if not exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=v_creator and m.user_id=auth.uid()) then return; end if;
 return query
 select p.id,p.stripe_payout_id,p.amount_cents,p.currency,p.status,p.arrival_date,p.paid_at,p.external_reference,p.created_at
 from public.cr_podcast_payouts p
 where p.creator_id=v_creator and lower(p.currency)=lower(v_currency)
 order by p.created_at desc limit 25;
end $$;
revoke all on function public.get_my_podcast_finance_transaction_payouts(uuid) from public;
grant execute on function public.get_my_podcast_finance_transaction_payouts(uuid) to authenticated;