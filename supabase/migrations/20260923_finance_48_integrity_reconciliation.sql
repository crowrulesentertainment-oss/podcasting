create table if not exists public.cr_podcast_finance_reconciliation_results (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null,
 transaction_id uuid not null,
 currency text not null default 'usd',
 gross_cents bigint not null default 0,
 platform_fee_ledger_cents bigint not null default 0,
 platform_fee_recorded_cents bigint not null default 0,
 refund_ledger_cents bigint not null default 0,
 refund_recorded_cents bigint not null default 0,
 dispute_ledger_cents bigint not null default 0,
 dispute_recorded_cents bigint not null default 0,
 ledger_net_cents bigint not null default 0,
 recorded_net_cents bigint not null default 0,
 variance_cents bigint not null default 0,
 reconciliation_status text not null check(reconciliation_status in ('matched','review','unresolved')),
 checked_at timestamptz not null default now(),
 unique(creator_id,transaction_id)
);
create index if not exists cr_podcast_finance_recon_creator_status_idx on public.cr_podcast_finance_reconciliation_results(creator_id,reconciliation_status,checked_at desc);
alter table public.cr_podcast_finance_reconciliation_results enable row level security;
drop policy if exists "creators read own finance reconciliation results" on public.cr_podcast_finance_reconciliation_results;
create policy "creators read own finance reconciliation results" on public.cr_podcast_finance_reconciliation_results for select to authenticated using (
 exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=creator_id and m.user_id=auth.uid())
);
revoke all on public.cr_podcast_finance_reconciliation_results from anon,authenticated;
grant select on public.cr_podcast_finance_reconciliation_results to authenticated;

create or replace function public.reconcile_creator_podcast_finance(p_creator_id uuid,p_transaction_id uuid default null)
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0; v_platform bigint; v_refund bigint; v_dispute bigint; v_ledger_net bigint; v_status text; v_variance bigint;
begin
 if p_creator_id is null then return 0; end if;
 for r in select s.id,s.creator_id,s.gross_cents,s.platform_fee_cents,s.refund_cents,s.dispute_cents,s.creator_net_cents,s.currency
 from public.cr_podcast_revenue_splits s
 where s.creator_id=p_creator_id and (p_transaction_id is null or s.id=p_transaction_id)
 loop
   select coalesce(sum(amount_cents),0) into v_platform from public.cr_podcast_finance_adjustments where transaction_id=r.id and adjustment_type='platform_fee';
   select coalesce(sum(amount_cents),0) into v_refund from public.cr_podcast_finance_adjustments where transaction_id=r.id and adjustment_type='refund';
   select coalesce(sum(amount_cents),0) into v_dispute from public.cr_podcast_finance_adjustments where transaction_id=r.id and adjustment_type='dispute';
   v_ledger_net:=r.gross_cents-coalesce(v_platform,0)-coalesce(v_refund,0)-coalesce(v_dispute,0);
   v_variance:=v_ledger_net-coalesce(r.creator_net_cents,0);
   v_status:=case when v_variance=0 and v_platform=coalesce(r.platform_fee_cents,0) and v_refund=coalesce(r.refund_cents,0) and v_dispute=coalesce(r.dispute_cents,0) then 'matched' when abs(v_variance)<=1 then 'review' else 'unresolved' end;
   insert into public.cr_podcast_finance_reconciliation_results(creator_id,transaction_id,currency,gross_cents,platform_fee_ledger_cents,platform_fee_recorded_cents,refund_ledger_cents,refund_recorded_cents,dispute_ledger_cents,dispute_recorded_cents,ledger_net_cents,recorded_net_cents,variance_cents,reconciliation_status,checked_at)
   values(r.creator_id,r.id,r.currency,r.gross_cents,coalesce(v_platform,0),coalesce(r.platform_fee_cents,0),coalesce(v_refund,0),coalesce(r.refund_cents,0),coalesce(v_dispute,0),coalesce(r.dispute_cents,0),v_ledger_net,coalesce(r.creator_net_cents,0),v_variance,v_status,now())
   on conflict(creator_id,transaction_id) do update set currency=excluded.currency,gross_cents=excluded.gross_cents,platform_fee_ledger_cents=excluded.platform_fee_ledger_cents,platform_fee_recorded_cents=excluded.platform_fee_recorded_cents,refund_ledger_cents=excluded.refund_ledger_cents,refund_recorded_cents=excluded.refund_recorded_cents,dispute_ledger_cents=excluded.dispute_ledger_cents,dispute_recorded_cents=excluded.dispute_recorded_cents,ledger_net_cents=excluded.ledger_net_cents,recorded_net_cents=excluded.recorded_net_cents,variance_cents=excluded.variance_cents,reconciliation_status=excluded.reconciliation_status,checked_at=excluded.checked_at;
   n:=n+1;
 end loop; return n;
end $$;
revoke all on function public.reconcile_creator_podcast_finance(uuid,uuid) from public;
grant execute on function public.reconcile_creator_podcast_finance(uuid,uuid) to service_role;

create or replace function public.get_my_podcast_finance_integrity()
returns table(transaction_id uuid,currency text,gross_cents bigint,platform_fee_ledger_cents bigint,platform_fee_recorded_cents bigint,refund_ledger_cents bigint,refund_recorded_cents bigint,dispute_ledger_cents bigint,dispute_recorded_cents bigint,ledger_net_cents bigint,recorded_net_cents bigint,variance_cents bigint,reconciliation_status text,checked_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return; end if;
 perform public.reconcile_creator_podcast_finance(v_creator,null);
 return query select transaction_id,currency,gross_cents,platform_fee_ledger_cents,platform_fee_recorded_cents,refund_ledger_cents,refund_recorded_cents,dispute_ledger_cents,dispute_recorded_cents,ledger_net_cents,recorded_net_cents,variance_cents,reconciliation_status,checked_at from public.cr_podcast_finance_reconciliation_results where creator_id=v_creator order by checked_at desc;
end $$;
revoke all on function public.get_my_podcast_finance_integrity() from public;
grant execute on function public.get_my_podcast_finance_integrity() to authenticated;