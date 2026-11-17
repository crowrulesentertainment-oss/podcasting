create or replace function public.crowrules_notify_creator_followers(
  p_creator_id uuid,
  p_type text,
  p_message text,
  p_reference_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
begin
  if p_creator_id is null then return 0; end if;

  if to_regclass('public.crowspace_notifications') is not null
     and to_regclass('public.crowspace_follows') is not null then
    execute $sql$
      insert into public.crowspace_notifications
        (recipient_id, notification_type, actor_id, entity_type, entity_id, message)
      select f.follower_id, $2, $1, 'podcast', $4, $3
      from public.crowspace_follows as f
      where f.following_id = $1 and f.follower_id <> $1
      on conflict do nothing
    $sql$
    using p_creator_id, p_type, p_message, p_reference_id;
    get diagnostics v_count = row_count;
  end if;

  if to_regclass('public.crowspace_activity') is not null
     and to_regclass('public.crowspace_follows') is not null then
    begin
      execute $sql$
        insert into public.crowspace_activity
          (user_id, actor_id, type, message, reference_id, metadata)
        select f.follower_id, $2, $1, $3, $4,
               coalesce($5, '{}'::jsonb) || jsonb_build_object('creator_id', $1)
        from public.crowspace_follows as f
        where f.following_id = $1 and f.follower_id <> $1
      $sql$
      using p_creator_id, p_type, p_message, p_reference_id, p_metadata;
    exception when undefined_column or undefined_table then
      raise notice 'Optional CrowSpace activity feed schema unavailable; notification saved.';
    end;
  end if;
  return v_count;
end;
$function$;
