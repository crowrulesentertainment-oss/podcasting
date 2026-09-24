create table if not exists public.cr_podcast_finance_adjustments (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null,
 transaction_id uuid null,
 adjustment_type text not null check(adjustment_type in ('stripe_fee','platform_fee','refund','dispute','correction')),
 amount_cents bigint not null,
 currency text not null default 'usd',
 source_event_id text,
 reason text,
 created_at timestamptz not null default now()
);
create index if not exists cr_podcast_finance_adjustments_creator_tx_idx on public.cr_podcast_finance_adjustments(creator_id,transaction_id,created_at desc);
alter table public.cr_podcast_finance_adjustments enable row level security;
drop policy if exists "creators read own finance adjustments" on public.cr_podcast_finance_adjustments;
create policy "creators read own finance adjustments" on public.cr_podcast_finance_adjustments for select to authenticated using (
 exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=creator_id and m.user_id=auth.uid())
);
revoke all on public.cr_podcast_finance_adjustments from anon,authenticated;
grant select on public.cr_podcast_finance_adjustments to authenticated;
create or replace function public.get_my_podcast_finance_adjustments(p_transaction_id uuid)
returns table(id uuid,adjustment_type text,amount_cents bigint,currency text,source_event_id text,reason text,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select s.creator_id into v_creator from public.cr_podcast_revenue_splits s where s.id=p_transaction_id;
 if v_creator is null or not exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=v_creator and m.user_id=auth.uid()) then return; end if;
 return query select a.id,a.adjustment_type,a.amount_cents,a.currency,a.source_event_id,a.reason,a.created_at
 from public.cr_podcast_finance_adjustments a where a.creator_id=v_creator and a.transaction_id=p_transaction_id order by a.created_at;
end $$;
revoke all on function public.get_my_podcast_finance_adjustments(uuid) from public;
grant execute on function public.get_my_podcast_finance_adjustments(uuid) to authenticated;