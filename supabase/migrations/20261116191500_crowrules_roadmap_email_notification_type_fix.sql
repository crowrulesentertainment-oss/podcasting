-- Use the existing allowed system notification type for roadmap email transport.
create or replace function private.podcast_apply_notification_preference()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
declare grp text; roadmap_in_app boolean := true;
begin
  grp := case
    when new.metadata->>'source' like '%broadcast%' or new.notification_type in ('safety_alert','schedule_reminder') then 'live'
    when new.metadata->>'source' like '%episode%' or new.metadata->>'source' like '%publ%' then 'content'
    when new.metadata->>'source' like '%membership%' or new.metadata->>'source' like '%subscription%' then 'membership'
    when new.metadata->>'source' like '%crowpoints%' then 'crowpoints'
    when new.notification_type in ('moderator_invitation','moderator_role','report_assignment','report_alert','escalation') then 'moderation'
    else 'content'
  end;
  new.notification_group := grp;

  if new.metadata->>'source' = 'platform_feedback_roadmap' then
    select coalesce(p.roadmap_in_app_enabled,true) into roadmap_in_app
      from public.podcast_notification_preferences p where p.user_id=new.user_id;
    if not found then roadmap_in_app:=true; end if;
    if not roadmap_in_app then new.delivery_state:='suppressed'; return new; end if;
  end if;

  if not private.podcast_notification_should_deliver(new.user_id,grp,new.priority) then
    new.delivery_state:='suppressed';
  else
    new.delivery_state:='in_app';
  end if;
  return new;
end;
$function$;

create or replace function private.podcast_queue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
declare p public.podcast_notification_preferences%rowtype; stage text;
begin
  select * into p from public.podcast_notification_preferences where user_id=new.user_id;

  if new.metadata->>'source' = 'platform_feedback_roadmap' then
    stage:=new.metadata->>'roadmap_stage';
    if coalesce(p.email_enabled,false) and coalesce(p.roadmap_email_enabled,false)
       and (not coalesce(p.roadmap_email_important_only,true) or stage in ('approved','in_progress','completed')) then
      insert into public.podcast_notification_delivery_queue(notification_id,channel,status)
      values(new.id,'email','queued') on conflict(notification_id,channel) do nothing;
    end if;
    return new;
  end if;

  if new.delivery_state='suppressed' then return new; end if;
  if p.email_enabled then
    insert into public.podcast_notification_delivery_queue(notification_id,channel,status)
    values(new.id,'email','provider_unconfigured') on conflict(notification_id,channel) do nothing;
  end if;
  if p.push_enabled then
    insert into public.podcast_notification_delivery_queue(notification_id,channel,status)
    values(new.id,'push','provider_unconfigured') on conflict(notification_id,channel) do nothing;
  end if;
  return new;
end;
$function$;

create or replace function public.podcast_claim_notification_email_job(p_max_attempts integer default 5)
returns table(id bigint,notification_id bigint,channel text,status text,attempts integer,next_attempt_at timestamptz,provider text)
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  update public.podcast_notification_delivery_queue q
     set status='suppressed',last_error='Member email preference changed before delivery.',
         locked_at=null,updated_at=now()
    from public.podcast_live_notifications n
    left join public.podcast_notification_preferences p on p.user_id=n.user_id
   where q.notification_id=n.id and q.channel='email'
     and q.status in ('queued','provider_unconfigured')
     and n.metadata->>'source'='platform_feedback_roadmap'
     and (coalesce(p.email_enabled,false)=false or coalesce(p.roadmap_email_enabled,false)=false
       or (coalesce(p.roadmap_email_important_only,true)
         and coalesce(n.metadata->>'roadmap_stage','') not in ('approved','in_progress','completed')));

  return query
  with candidate as (
    select q.id from public.podcast_notification_delivery_queue q
    join public.podcast_live_notifications n on n.id=q.notification_id
    left join public.podcast_notification_preferences p on p.user_id=n.user_id
    where q.channel='email' and q.status in ('queued','provider_unconfigured')
      and q.next_attempt_at<=now() and q.attempts<p_max_attempts
      and (n.metadata->>'source'<>'platform_feedback_roadmap'
        or (coalesce(p.email_enabled,false) and coalesce(p.roadmap_email_enabled,false)
          and private.podcast_notification_should_deliver(n.user_id,n.notification_group,n.priority)))
    order by q.next_attempt_at,q.id for update of q skip locked limit 1
  )
  update public.podcast_notification_delivery_queue q
     set status='processing',locked_at=now(),attempts=q.attempts+1,provider='gmail',updated_at=now()
    from candidate where q.id=candidate.id
  returning q.id,q.notification_id,q.channel,q.status,q.attempts,q.next_attempt_at,q.provider;
end;
$function$;

create or replace function private.notify_feedback_owner_roadmap_progress()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  feedback_owner uuid;
  stage_label text;
  is_stage_change boolean;
  in_app_enabled boolean := true;
  action_link text := 'https://crowrulesentertainment-oss.github.io/podcasting/platform-reviews.html#platformFeedback';
begin
  if new.source_feedback_id is null then return new; end if;
  if tg_op='INSERT' then is_stage_change:=true; else is_stage_change:=old.status is distinct from new.status; end if;
  if not is_stage_change then return new; end if;

  select f.user_id into feedback_owner from public.podcast_platform_feedback f where f.id=new.source_feedback_id;
  if feedback_owner is null then return new; end if;
  select coalesce(p.roadmap_in_app_enabled,true) into in_app_enabled
    from public.podcast_notification_preferences p where p.user_id=feedback_owner;
  if not found then in_app_enabled:=true; end if;

  stage_label:=case new.status
    when 'suggested' then 'Suggested by members'
    when 'under_review' then 'Under CrowRules review'
    when 'approved' then 'Approved for development'
    when 'in_progress' then 'Currently being built'
    when 'completed' then 'Completed and released'
    when 'declined' then 'Not moving forward'
    else initcap(replace(new.status,'_',' '))
  end;

  if in_app_enabled then
    insert into public.podcast_notifications(user_id,actor_user_id,type,title,body,is_read,created_at)
    values(feedback_owner,auth.uid(),'development_roadmap_update',
      case when tg_op='INSERT' then 'Your suggestion has been added to the development roadmap' else 'Your platform feedback has an update' end,
      coalesce(new.title,'Your platform suggestion')||' — '||stage_label||'. View your feedback history in CrowRules Podcasting Platform Reviews.',
      false,now());
  end if;

  insert into public.podcast_live_notifications
    (user_id,notification_type,title,body,action_url,related_id,metadata,priority)
  values(feedback_owner,'system',
    case when tg_op='INSERT' then 'Your suggestion is on the CrowRules development roadmap' else 'Your CrowRules development roadmap has an update' end,
    coalesce(new.title,'Your platform suggestion')||' — '||stage_label||'.',
    action_link,new.id::text,
    jsonb_build_object('source','platform_feedback_roadmap','roadmap_stage',new.status,'roadmap_id',new.id,'feedback_id',new.source_feedback_id),
    case when new.status in ('approved','in_progress','completed') then 'high' else 'normal' end);
  return new;
end;
$function$;

revoke all on function private.podcast_apply_notification_preference() from public,anon,authenticated;
revoke all on function private.podcast_queue_notification_delivery() from public,anon,authenticated;
revoke all on function private.notify_feedback_owner_roadmap_progress() from public,anon,authenticated;
revoke all on function public.podcast_claim_notification_email_job(integer) from public,anon,authenticated;
grant execute on function public.podcast_claim_notification_email_job(integer) to service_role;
