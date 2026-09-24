create table if not exists public.cr_podcast_finance_cases (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null,
 transaction_id uuid null,
 alert_id uuid null,
 case_type text not null default 'integrity' check(case_type in ('integrity','refund','dispute','payout','account','other')),
 status text not null default 'open' check(status in ('open','investigating','resolved')),
 title text not null,
 description text,
 amount_cents bigint not null default 0,
 currency text not null default 'usd',
 resolution_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolved_at timestamptz null
);
create index if not exists cr_podcast_finance_cases_creator_status_idx on public.cr_podcast_finance_cases(creator_id,status,updated_at desc);
alter table public.cr_podcast_finance_cases enable row level security;
drop policy if exists "creators read own finance cases" on public.cr_podcast_finance_cases;
create policy "creators read own finance cases" on public.cr_podcast_finance_cases for select to authenticated using(exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=creator_id and m.user_id=auth.uid()));
revoke all on public.cr_podcast_finance_cases from anon,authenticated;
grant select on public.cr_podcast_finance_cases to authenticated;

create table if not exists public.cr_podcast_finance_case_events (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.cr_podcast_finance_cases(id) on delete cascade,
 creator_id uuid not null,
 event_type text not null check(event_type in ('created','status_changed','note','resolved')),
 from_status text,
 to_status text,
 note text,
 created_at timestamptz not null default now()
);
create index if not exists cr_podcast_finance_case_events_case_idx on public.cr_podcast_finance_case_events(case_id,created_at desc);
alter table public.cr_podcast_finance_case_events enable row level security;
create policy "creators read own finance case events" on public.cr_podcast_finance_case_events for select to authenticated using(exists(select 1 from public.creators c join public.members m on m.id=c.member_id where c.id=creator_id and m.user_id=auth.uid()));
revoke all on public.cr_podcast_finance_case_events from anon,authenticated;
grant select on public.cr_podcast_finance_case_events to authenticated;

create or replace function public.create_my_podcast_finance_case(p_transaction_id uuid,p_case_type text,p_title text,p_description text,p_amount_cents bigint,p_currency text,p_alert_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_id uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator not found'; end if;
 if p_transaction_id is not null and not exists(select 1 from public.cr_podcast_revenue_splits s where s.id=p_transaction_id and s.creator_id=v_creator) then raise exception 'Transaction not found'; end if;
 insert into public.cr_podcast_finance_cases(creator_id,transaction_id,alert_id,case_type,title,description,amount_cents,currency)
 values(v_creator,p_transaction_id,p_alert_id,coalesce(p_case_type,'other'),p_title,p_description,coalesce(p_amount_cents,0),lower(coalesce(p_currency,'usd'))) returning id into v_id;
 insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,to_status,note) values(v_id,v_creator,'created','open',p_description);
 return v_id;
end $$;

create or replace function public.update_my_podcast_finance_case(p_case_id uuid,p_status text,p_resolution_notes text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_old text; v_resolved timestamptz;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 select status into v_old from public.cr_podcast_finance_cases where id=p_case_id and creator_id=v_creator;
 if v_old is null then return false; end if;
 if p_status not in ('open','investigating','resolved') then raise exception 'Invalid status'; end if;
 v_resolved:=case when p_status='resolved' then coalesce((select resolved_at from public.cr_podcast_finance_cases where id=p_case_id),now()) else null end;
 update public.cr_podcast_finance_cases set status=p_status,resolution_notes=p_resolution_notes,updated_at=now(),resolved_at=v_resolved where id=p_case_id and creator_id=v_creator;
 insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,from_status,to_status,note) values(p_case_id,v_creator,case when p_status='resolved' then 'resolved' else 'status_changed' end,v_old,p_status,p_resolution_notes);
 return true;
end $$;

create or replace function public.get_my_podcast_finance_cases()
returns table(id uuid,transaction_id uuid,alert_id uuid,case_type text,status text,title text,description text,amount_cents bigint,currency text,resolution_notes text,created_at timestamptz,updated_at timestamptz,resolved_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 return query select id,transaction_id,alert_id,case_type,status,title,description,amount_cents,currency,resolution_notes,created_at,updated_at,resolved_at from public.cr_podcast_finance_cases where creator_id=v_creator order by updated_at desc;
end $$;
revoke all on function public.create_my_podcast_finance_case(uuid,text,text,text,bigint,text,uuid) from public;
revoke all on function public.update_my_podcast_finance_case(uuid,text,text) from public;
revoke all on function public.get_my_podcast_finance_cases() from public;
grant execute on function public.create_my_podcast_finance_case(uuid,text,text,text,bigint,text,uuid) to authenticated;
grant execute on function public.update_my_podcast_finance_case(uuid,text,text) to authenticated;
grant execute on function public.get_my_podcast_finance_cases() to authenticated;