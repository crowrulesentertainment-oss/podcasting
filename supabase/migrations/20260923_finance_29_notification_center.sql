create or replace function public.get_my_podcast_finance_notification_center(p_limit integer default 50,p_unread_only boolean default false)
returns table(id uuid,alert_type text,title text,message text,threshold_cents bigint,currency text,is_read boolean,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_creator uuid;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 return query select a.id,a.alert_type,a.title,a.message,a.threshold_cents,a.currency,a.is_read,a.created_at
 from public.cr_podcast_finance_alerts a
 where a.creator_id=v_creator and (not p_unread_only or not a.is_read)
 order by a.created_at desc limit greatest(1,least(coalesce(p_limit,50),100));
end $$;
revoke all on function public.get_my_podcast_finance_notification_center(integer,boolean) from public;
grant execute on function public.get_my_podcast_finance_notification_center(integer,boolean) to authenticated;
create or replace function public.mark_my_podcast_finance_alerts_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_count integer;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then raise exception 'Creator profile not found'; end if;
 if p_ids is null then
   update public.cr_podcast_finance_alerts set is_read=true where creator_id=v_creator and is_read=false;
 else
   update public.cr_podcast_finance_alerts set is_read=true where creator_id=v_creator and id=any(p_ids);
 end if;
 get diagnostics v_count=row_count; return v_count;
end $$;
revoke all on function public.mark_my_podcast_finance_alerts_read(uuid[]) from public;
grant execute on function public.mark_my_podcast_finance_alerts_read(uuid[]) to authenticated;