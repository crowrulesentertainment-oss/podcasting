-- Keep the report generator private and make its exposed wrapper SECURITY INVOKER.
-- The private function permits scheduler calls with no auth.uid(), but checks admin
-- membership whenever it is invoked in an authenticated user context.

create or replace function private.generate_podcast_platform_feedback_report(p_month date)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_start date := date_trunc('month',p_month::timestamp)::date;
 v_end date := (date_trunc('month',p_month::timestamp)+interval '1 month')::date;
 v_data jsonb;
begin
 if (select auth.uid()) is not null and not private.crowrules_is_admin_impl() then
  raise exception 'Administrator access required.' using errcode='42501';
 end if;
 select report_data into v_data
 from public.podcast_platform_feedback_monthly_reports
 where month_start=v_start;
 -- Rebuild the snapshot from the source rows every time it is requested.
 select jsonb_build_object(
  'month',to_char(v_start,'YYYY-MM'),
  'period_start',v_start,
  'period_end_exclusive',v_end,
  'generated_at',now(),
  'review_count',(select count(*) from public.podcast_platform_reviews r where r.status='published' and r.created_at>=v_start and r.created_at<v_end),
  'average_rating',(select round(avg(r.overall_rating)::numeric,2) from public.podcast_platform_reviews r where r.status='published' and r.created_at>=v_start and r.created_at<v_end),
  'rating_distribution',(select coalesce(jsonb_object_agg(q.rating::text,q.total),'{}'::jsonb) from (select r.overall_rating rating,count(*) total from public.podcast_platform_reviews r where r.status='published' and r.created_at>=v_start and r.created_at<v_end group by r.overall_rating) q),
  'feedback_submissions',(select count(*) from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end),
  'feedback_by_type',(select coalesce(jsonb_object_agg(q.feedback_type,q.total),'{}'::jsonb) from (select f.feedback_type,count(*) total from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end group by f.feedback_type) q),
  'feedback_by_category',(select coalesce(jsonb_object_agg(q.category,q.total),'{}'::jsonb) from (select f.category,count(*) total from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end group by f.category) q),
  'feedback_by_status',(select coalesce(jsonb_object_agg(q.status,q.total),'{}'::jsonb) from (select f.status,count(*) total from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end group by f.status) q),
  'top_suggestions',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select lower(trim(f.title)) title_key,min(f.title) title,min(f.category) category,count(*) submissions,
     array_agg(f.id order by f.created_at desc) feedback_ids
    from public.podcast_platform_feedback f
    where f.feedback_type='feature_request' and f.created_at>=v_start and f.created_at<v_end
    group by lower(trim(f.title)) order by count(*) desc,min(f.title) limit 10
  ) q),
  'top_issues',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select lower(trim(f.title)) title_key,min(f.title) title,min(f.category) category,count(*) submissions,
     array_agg(f.id order by f.created_at desc) feedback_ids
    from public.podcast_platform_feedback f
    where f.feedback_type='bug_report' and f.created_at>=v_start and f.created_at<v_end
    group by lower(trim(f.title)) order by count(*) desc,min(f.title) limit 10
  ) q)
 ) into v_data;
 insert into public.podcast_platform_feedback_monthly_reports(month_start,report_data,generated_at)
 values(v_start,v_data,now())
 on conflict(month_start) do update set report_data=excluded.report_data,generated_at=excluded.generated_at;
 return v_data;
end;
$$;
grant usage on schema private to authenticated;
grant execute on function private.generate_podcast_platform_feedback_report(date) to authenticated;

create or replace function public.admin_generate_podcast_platform_feedback_report(p_month date)
returns jsonb
language sql
security invoker
set search_path=''
as $$
 select private.generate_podcast_platform_feedback_report(p_month);
$$;
revoke all on function public.admin_generate_podcast_platform_feedback_report(date) from public,anon;
grant execute on function public.admin_generate_podcast_platform_feedback_report(date) to authenticated;
