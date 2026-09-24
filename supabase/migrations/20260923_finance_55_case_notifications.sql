alter table public.cr_podcast_finance_alerts add column if not exists case_id uuid references public.cr_podcast_finance_cases(id) on delete set null;
create index if not exists cr_podcast_finance_alerts_case_idx on public.cr_podcast_finance_alerts(case_id,created_at desc);
create or replace function public.link_my_podcast_finance_case_alert(p_case_id uuid,p_alert_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return false; end if;
 update public.cr_podcast_finance_alerts a set case_id=p_case_id
 where a.id=p_alert_id and a.creator_id=v_creator
   and exists(select 1 from public.cr_podcast_finance_cases f where f.id=p_case_id and f.creator_id=v_creator);
 return found;
end $$;
revoke all on function public.link_my_podcast_finance_case_alert(uuid,uuid) from public;
grant execute on function public.link_my_podcast_finance_case_alert(uuid,uuid) to authenticated;
create or replace function public.get_my_podcast_finance_case_alerts(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_data jsonb;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return '[]'::jsonb; end if;
 if not exists(select 1 from public.cr_podcast_finance_cases where id=p_case_id and creator_id=v_creator) then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc),'[]'::jsonb) into v_data from public.cr_podcast_finance_alerts a where a.creator_id=v_creator and a.case_id=p_case_id;
 return v_data;
end $$;
revoke all on function public.get_my_podcast_finance_case_alerts(uuid) from public;
grant execute on function public.get_my_podcast_finance_case_alerts(uuid) to authenticated;