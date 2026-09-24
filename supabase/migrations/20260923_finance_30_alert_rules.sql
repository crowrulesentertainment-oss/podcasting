create table if not exists public.cr_podcast_finance_alert_rules (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.creators(id) on delete cascade,
 rule_name text not null check (char_length(rule_name) between 1 and 100),
 rule_type text not null check (rule_type in ('payment_milestone','revenue_milestone','payout_milestone')),
 threshold_cents bigint not null check (threshold_cents > 0),
 currency text not null default 'usd' check (char_length(currency) between 3 and 3),
 enabled boolean not null default true,
 repeatable boolean not null default false,
 last_triggered_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cr_podcast_finance_alert_rules_creator_idx on public.cr_podcast_finance_alert_rules(creator_id,enabled);
alter table public.cr_podcast_finance_alert_rules enable row level security;
drop policy if exists "creators read own finance alert rules" on public.cr_podcast_finance_alert_rules;
create policy "creators read own finance alert rules" on public.cr_podcast_finance_alert_rules for select to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
drop policy if exists "creators insert own finance alert rules" on public.cr_podcast_finance_alert_rules;
create policy "creators insert own finance alert rules" on public.cr_podcast_finance_alert_rules for insert to authenticated with check (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
drop policy if exists "creators update own finance alert rules" on public.cr_podcast_finance_alert_rules;
create policy "creators update own finance alert rules" on public.cr_podcast_finance_alert_rules for update to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid())) with check (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
drop policy if exists "creators delete own finance alert rules" on public.cr_podcast_finance_alert_rules;
create policy "creators delete own finance alert rules" on public.cr_podcast_finance_alert_rules for delete to authenticated using (creator_id in (select c.id from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid()));
revoke all on public.cr_podcast_finance_alert_rules from anon;
grant select,insert,update,delete on public.cr_podcast_finance_alert_rules to authenticated;
create or replace function public.get_my_podcast_finance_alert_rules()
returns setof public.cr_podcast_finance_alert_rules language sql security definer set search_path=public as $$
 select r.* from public.cr_podcast_finance_alert_rules r join public.creators c on c.id=r.creator_id join public.members m on m.id=c.member_id where m.user_id=auth.uid() order by r.created_at desc
$$;
revoke all on function public.get_my_podcast_finance_alert_rules() from public;
grant execute on function public.get_my_podcast_finance_alert_rules() to authenticated;
create or replace function public.create_my_podcast_finance_alert_rule(p_rule_name text,p_rule_type text,p_threshold_cents bigint,p_currency text default 'usd',p_repeatable boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_id uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 if char_length(trim(p_rule_name)) not between 1 and 100 then raise exception 'Invalid rule name'; end if;
 if p_rule_type not in ('payment_milestone','revenue_milestone','payout_milestone') then raise exception 'Invalid rule type'; end if;
 if p_threshold_cents is null or p_threshold_cents <= 0 then raise exception 'Threshold must be positive'; end if;
 insert into public.cr_podcast_finance_alert_rules(creator_id,rule_name,rule_type,threshold_cents,currency,repeatable) values(v_creator,trim(p_rule_name),p_rule_type,p_threshold_cents,lower(p_currency),p_repeatable) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_my_podcast_finance_alert_rule(text,text,bigint,text,boolean) from public;
grant execute on function public.create_my_podcast_finance_alert_rule(text,text,bigint,text,boolean) to authenticated;