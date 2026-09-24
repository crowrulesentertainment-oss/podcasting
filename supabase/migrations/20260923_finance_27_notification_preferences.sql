create table if not exists public.cr_podcast_finance_notification_preferences (
 creator_id uuid primary key references public.creators(id) on delete cascade,
 payments boolean not null default true,
 payouts boolean not null default true,
 refunds boolean not null default true,
 disputes boolean not null default true,
 account boolean not null default true,
 milestones boolean not null default true,
 system boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.cr_podcast_finance_notification_preferences enable row level security;
drop policy if exists "creators read own finance notification preferences" on public.cr_podcast_finance_notification_preferences;
create policy "creators read own finance notification preferences" on public.cr_podcast_finance_notification_preferences for select to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
drop policy if exists "creators update own finance notification preferences" on public.cr_podcast_finance_notification_preferences;
create policy "creators update own finance notification preferences" on public.cr_podcast_finance_notification_preferences for update to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid())) with check (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
revoke all on public.cr_podcast_finance_notification_preferences from anon;
grant select,update on public.cr_podcast_finance_notification_preferences to authenticated;
create or replace function public.get_my_podcast_finance_notification_preferences()
returns table(payments boolean,payouts boolean,refunds boolean,disputes boolean,account boolean,milestones boolean,system boolean)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 insert into public.cr_podcast_finance_notification_preferences(creator_id) values(v_creator) on conflict do nothing;
 return query select p.payments,p.payouts,p.refunds,p.disputes,p.account,p.milestones,p.system from public.cr_podcast_finance_notification_preferences p where p.creator_id=v_creator;
end $$;
revoke all on function public.get_my_podcast_finance_notification_preferences() from public;
grant execute on function public.get_my_podcast_finance_notification_preferences() to authenticated;
create or replace function public.update_my_podcast_finance_notification_preferences(p_payments boolean,p_payouts boolean,p_refunds boolean,p_disputes boolean,p_account boolean,p_milestones boolean,p_system boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 insert into public.cr_podcast_finance_notification_preferences(creator_id,updated_at) values(v_creator,now()) on conflict(creator_id) do update set payments=p_payments,payouts=p_payouts,refunds=p_refunds,disputes=p_disputes,account=p_account,milestones=p_milestones,system=p_system,updated_at=now();
 return true;
end $$;
revoke all on function public.update_my_podcast_finance_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.update_my_podcast_finance_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;