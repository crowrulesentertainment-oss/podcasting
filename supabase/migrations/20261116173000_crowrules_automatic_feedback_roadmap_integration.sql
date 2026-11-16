-- Automatic Platform Feedback <-> Development Roadmap integration.
-- Preserve the existing feedback queue and roadmap; this migration adds a
-- one-feedback-to-one-roadmap link and member-facing in-app notifications.

create unique index if not exists podcast_development_roadmap_source_feedback_uidx
 on public.podcast_development_roadmap(source_feedback_id)
 where source_feedback_id is not null;

create or replace function private.sync_feedback_status_from_development_roadmap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  mapped_status text;
begin
  mapped_status := case new.status
    when 'suggested' then 'new'
    when 'under_review' then 'under_review'
    when 'approved' then 'planned'
    when 'in_progress' then 'in_progress'
    when 'completed' then 'completed'
    when 'declined' then 'declined'
    else 'under_review'
  end;

  if new.source_feedback_id is not null then
    update public.podcast_platform_feedback
       set status = mapped_status,
           updated_at = now(),
           resolved_at = case
             when mapped_status in ('completed','declined') then coalesce(resolved_at, now())
             else null
           end
     where id = new.source_feedback_id
       and status is distinct from mapped_status;
  end if;
  return new;
end;
$function$;

revoke all on function private.sync_feedback_status_from_development_roadmap() from public, anon, authenticated;

drop trigger if exists podcast_roadmap_sync_feedback_status
 on public.podcast_development_roadmap;
create trigger podcast_roadmap_sync_feedback_status
after insert or update of status, source_feedback_id
on public.podcast_development_roadmap
for each row
execute function private.sync_feedback_status_from_development_roadmap();

create or replace function private.notify_feedback_owner_roadmap_progress()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  feedback_owner uuid;
  roadmap_title text;
  stage_label text;
  is_stage_change boolean;
begin
  if new.source_feedback_id is null then
    return new;
  end if;

  is_stage_change := tg_op = 'INSERT' or old.status is distinct from new.status;
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

drop trigger if exists podcast_roadmap_notify_feedback_owner
 on public.podcast_development_roadmap;
create trigger podcast_roadmap_notify_feedback_owner
after insert or update of status
on public.podcast_development_roadmap
for each row
execute function private.notify_feedback_owner_roadmap_progress();
