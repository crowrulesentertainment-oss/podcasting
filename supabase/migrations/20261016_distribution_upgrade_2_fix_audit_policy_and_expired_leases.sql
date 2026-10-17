-- Fix audit RLS predicate and recover expired worker leases without duplicate claims.
drop policy if exists "Creators append own distribution audit events" on public.podcast_distribution_delivery_logs;
create policy "Creators append own distribution audit events"
on public.podcast_distribution_delivery_logs
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and event_type in ('draft_saved','approved','queued','cancelled','connection_started','connection_updated')
  and exists (
    select 1 from public.podcast_distribution_posts p
    where p.id = post_id and p.user_id = (select auth.uid())
  )
);

create or replace function public.distribution_claim_jobs(p_worker_id text, p_limit integer default 20, p_lease_seconds integer default 300)
returns setof public.podcast_distribution_posts
language plpgsql security definer set search_path=''
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 8 then
    raise exception 'A worker ID of at least 8 characters is required';
  end if;
  with expired as (
    update public.podcast_distribution_posts p
    set status='failed',locked_at=null,worker_id=null,
        last_error='Worker lease expired after the final permitted attempt.',updated_at=now()
    where p.status='publishing'
      and p.locked_at < now()-make_interval(secs=>greatest(p_lease_seconds,60))
      and p.attempt_count >= greatest(p.max_attempts,1)
    returning p.id,p.user_id,p.platform
  )
  insert into public.podcast_distribution_delivery_logs(post_id,user_id,platform,event_type,outcome,message,provider_code)
  select e.id,e.user_id,e.platform,'failed','error','Worker lease expired after the final permitted attempt.','lease_expired'
  from expired e;
  return query
  with candidates as (
    select p.id from public.podcast_distribution_posts p
    where (
      (p.status='queued' and coalesce(p.next_attempt_at,p.scheduled_at,now()) <= now())
      or
      (p.status='publishing' and p.locked_at < now()-make_interval(secs=>greatest(p_lease_seconds,60))
       and p.attempt_count < greatest(p.max_attempts,1))
    )
    order by coalesce(p.next_attempt_at,p.scheduled_at,p.created_at),p.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit,20),1),50)
  ), claimed as (
    update public.podcast_distribution_posts p
    set status='publishing',locked_at=now(),worker_id=p_worker_id,
        attempt_count=p.attempt_count+1,last_attempt_at=now(),updated_at=now()
    from candidates c where p.id=c.id
    returning p.*
  )
  select * from claimed;
end;
$$;
revoke all on function public.distribution_claim_jobs(text,integer,integer) from public,anon,authenticated;
grant execute on function public.distribution_claim_jobs(text,integer,integer) to service_role;
