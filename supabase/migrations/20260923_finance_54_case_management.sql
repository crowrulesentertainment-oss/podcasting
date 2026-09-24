create or replace function public.update_my_podcast_finance_case_status(p_case_id uuid,p_status text,p_note text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_old text;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null or p_status not in ('open','investigating','resolved') then return false; end if;
 select status into v_old from public.cr_podcast_finance_cases where id=p_case_id and creator_id=v_creator for update;
 if not found then return false; end if;
 if v_old=p_status then return true; end if;
 update public.cr_podcast_finance_cases set status=p_status,updated_at=now(),resolved_at=case when p_status='resolved' then coalesce(resolved_at,now()) else null end where id=p_case_id and creator_id=v_creator;
 insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,from_status,to_status,note)
 values(p_case_id,v_creator,case when p_status='resolved' then 'resolved' else 'status_changed' end,v_old,p_status,p_note);
 return true;
end $$;
revoke all on function public.update_my_podcast_finance_case_status(uuid,text,text) from public;
grant execute on function public.update_my_podcast_finance_case_status(uuid,text,text) to authenticated;