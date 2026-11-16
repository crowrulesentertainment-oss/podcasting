create or replace function private.podcast_queue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $function$
declare p public.podcast_notification_preferences%rowtype; stage text;
begin
  select * into p from public.podcast_notification_preferences where user_id=new.user_id;
  if new.metadata->>'source'='platform_feedback_roadmap' then
    stage:=new.metadata->>'roadmap_stage';
    if coalesce(p.email_enabled,false) and coalesce(p.roadmap_email_enabled,false)
       and (not coalesce(p.roadmap_email_important_only,true) or stage in ('approved','in_progress','completed','declined')) then
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
         and coalesce(n.metadata->>'roadmap_stage','') not in ('approved','in_progress','completed','declined')));

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
