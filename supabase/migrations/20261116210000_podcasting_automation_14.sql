-- CrowRules Podcasting Automation 14.0
-- Expose existing automation telemetry to administrators without creating a second scheduler.
drop policy if exists "Podcast admins inspect automation runs" on public.podcast_automation_runs_v14;
create policy "Podcast admins inspect automation runs"
on public.podcast_automation_runs_v14
for select to authenticated
using (private.crowrules_is_admin_impl());

grant select on public.podcast_automation_runs_v14 to authenticated;

create or replace function public.podcast_admin_list_scheduled_automations_v14()
returns table(job_id bigint, job_name text, schedule text, active boolean)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, cron, private
as $function$
begin
  if not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select j.jobid::bigint, j.jobname::text, j.schedule::text, j.active::boolean
  from cron.job j
  where j.jobname ilike '%podcast%'
     or j.jobname ilike '%crowrules-podcast%'
  order by j.jobname;
end;
$function$;

revoke all on function public.podcast_admin_list_scheduled_automations_v14() from public, anon;
grant execute on function public.podcast_admin_list_scheduled_automations_v14() to authenticated;