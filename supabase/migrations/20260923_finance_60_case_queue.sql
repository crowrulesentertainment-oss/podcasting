create or replace function public.get_my_podcast_finance_case_queue()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_data jsonb;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return '[]'::jsonb; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.priority_rank desc,x.sla_due_at nulls last,x.created_at desc),'[]'::jsonb) into v_data
 from (
   select f.id,f.title,f.case_type,f.status,f.priority,f.amount_cents,f.currency,f.created_at,f.updated_at,f.sla_due_at,f.escalated_at,
   extract(epoch from (now()-f.created_at))/86400.0 as age_days,
   case when f.status='resolved' then 0 when f.sla_due_at is not null and f.sla_due_at<now() then 4 when f.priority='critical' then 3 when f.priority='high' then 2 when f.priority='normal' then 1 else 0 end as priority_rank
   from public.cr_podcast_finance_cases f where f.creator_id=v_creator
 ) x;
 return v_data;
end $$;
revoke all on function public.get_my_podcast_finance_case_queue() from public;
grant execute on function public.get_my_podcast_finance_case_queue() to authenticated;