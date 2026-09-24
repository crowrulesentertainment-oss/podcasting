create or replace function public.create_my_podcast_finance_alert(p_alert_type text,p_title text,p_message text,p_threshold_cents bigint default null,p_currency text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_id uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 if p_alert_type not in ('milestone','payout','refund','dispute','account','system') then raise exception 'Invalid alert type'; end if;
 if length(trim(p_title))=0 or length(trim(p_title))>160 then raise exception 'Invalid alert title'; end if;
 if length(trim(p_message))=0 or length(trim(p_message))>1000 then raise exception 'Invalid alert message'; end if;
 insert into public.cr_podcast_finance_alerts(creator_id,alert_type,title,message,threshold_cents,currency)
 values(v_creator,p_alert_type,trim(p_title),trim(p_message),p_threshold_cents,lower(nullif(trim(p_currency),'')))
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.create_my_podcast_finance_alert(text,text,text,bigint,text) from public;
grant execute on function public.create_my_podcast_finance_alert(text,text,text,bigint,text) to authenticated;
