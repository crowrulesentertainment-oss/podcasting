create or replace function public.get_my_podcast_finance_case_detail(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_creator uuid; v_case jsonb; v_tx jsonb; v_adj jsonb; v_events jsonb;
begin
 select c.id into v_creator from public.creators c join public.members m on m.id=c.member_id where m.user_id=auth.uid() limit 1;
 if v_creator is null then return null; end if;
 select to_jsonb(f) into v_case from public.cr_podcast_finance_cases f where f.id=p_case_id and f.creator_id=v_creator;
 if v_case is null then return null; end if;
 select coalesce(to_jsonb(s), '{}'::jsonb) into v_tx from public.cr_podcast_revenue_splits s where s.id=(v_case->>'transaction_id')::uuid and s.creator_id=v_creator;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb) into v_adj from public.cr_podcast_finance_adjustments a where a.transaction_id=(v_case->>'transaction_id')::uuid and a.creator_id=v_creator;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb) into v_events from public.cr_podcast_finance_case_events e where e.case_id=p_case_id and e.creator_id=v_creator;
 return jsonb_build_object('case',v_case,'transaction',v_tx,'adjustments',v_adj,'events',v_events);
end $$;
revoke all on function public.get_my_podcast_finance_case_detail(uuid) from public;
grant execute on function public.get_my_podcast_finance_case_detail(uuid) to authenticated;