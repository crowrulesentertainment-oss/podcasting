create or replace function private.notify_feedback_owner_roadmap_progress()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  feedback_owner uuid;
  stage_label text;
  is_stage_change boolean;
begin
  if new.source_feedback_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    is_stage_change := true;
  else
    is_stage_change := old.status is distinct from new.status;
  end if;
  if not is_stage_change then
    return new;
  end if;

  select f.user_id into feedback_owner
    from public.podcast_platform_feedback f
   where f.id = new.source_feedback_id;

  if feedback_owner is null then
    return new;
  end if;

  stage_label := case new.status
    when 'suggested' then 'Suggested by members'
    when 'under_review' then 'Under CrowRules review'
    when 'approved' then 'Approved for development'
    when 'in_progress' then 'Currently being built'
    when 'completed' then 'Completed and released'
    when 'declined' then 'Not moving forward'
    else initcap(replace(new.status, '_', ' '))
  end;

  insert into public.podcast_notifications
    (user_id, actor_user_id, type, title, body, is_read, created_at)
  values
    (
      feedback_owner,
      auth.uid(),
      'development_roadmap_update',
      case when tg_op = 'INSERT'
        then 'Your suggestion has been added to the development roadmap'
        else 'Your platform feedback has an update'
      end,
      coalesce(new.title, 'Your platform suggestion') || ' — ' || stage_label ||
        '. View your feedback history in CrowRules Podcasting Platform Reviews.',
      false,
      now()
    );

  return new;
end;
$function$;

revoke all on function private.notify_feedback_owner_roadmap_progress() from public, anon, authenticated;
