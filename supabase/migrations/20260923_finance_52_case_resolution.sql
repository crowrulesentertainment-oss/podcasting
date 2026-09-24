create or replace function public.resolve_my_podcast_finance_case(
 p_case_id uuid,p_resolution_notes text,p_correction_cents bigint default 0,p_currency text default 'usd'
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_creator uuid; r record; v_adj uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return false; end if;
 select * into r from public.cr_podcast_finance_cases where id=p_case_id and creator_id=v_creator for update;
 if not found then return false; end if;
 if r.status='resolved' then return true; end if;
 if coalesce(p_correction_cents,0)<>0 then
   insert into public.cr_podcast_finance_adjustments(creator_id,transaction_id,adjustment_type,amount_cents,currency,source_event_id,reason)
   values(v_creator,r.transaction_id,'correction',p_correction_cents,lower(coalesce(p_currency,r.currency,'usd')),
     'case:'||p_case_id::text,'Correction recorded while resolving finance case '||p_case_id::text)
   returning id into v_adj;
 end if;
 update public.cr_podcast_finance_cases set status='resolved',resolution_notes=p_resolution_notes,updated_at=now(),resolved_at=coalesce(resolved_at,now()) where id=p_case_id and creator_id=v_creator;
 insert into public.cr_podcast_finance_case_events(case_id,creator_id,event_type,from_status,to_status,note)
 values(p_case_id,v_creator,'resolved',r.status,'resolved',
   coalesce(p_resolution_notes,'Case resolved.')||case when v_adj is not null then ' Correction adjustment: '||v_adj::text else '' end);
 return true;
end $$;
revoke all on function public.resolve_my_podcast_finance_case(uuid,text,bigint,text) from public;
grant execute on function public.resolve_my_podcast_finance_case(uuid,text,bigint,text) to authenticated;