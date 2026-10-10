create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.notify_member_post_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner uuid;
  v_actor_name text;
  v_type text;
  v_title text;
  v_body text;
  v_action_url text;
  v_metadata jsonb;
begin
  select p.user_id into v_owner
  from public.podcast_member_posts p
  where p.id = new.post_id;

  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  select coalesce(nullif(m.display_name, ''), nullif(m.username, ''), 'A CrowRules member')
    into v_actor_name
  from public.members m
  where m.user_id = new.user_id;

  v_actor_name := coalesce(v_actor_name, 'A CrowRules member');
  v_action_url := 'member-profile.html?user=' || v_owner::text || '#posts';

  if tg_table_name = 'podcast_member_post_likes' then
    v_type := 'social_like';
    v_title := 'Someone liked your post';
    v_body := v_actor_name || ' liked your community post.';
    v_metadata := jsonb_build_object('post_id', new.post_id, 'actor_user_id', new.user_id);
  else
    v_type := 'social_comment';
    v_title := 'New comment on your post';
    v_body := v_actor_name || ' commented on your community post.';
    v_metadata := jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'actor_user_id', new.user_id);
  end if;

  insert into public.crowrules_notifications
    (user_id, actor_user_id, type, title, body, division, action_url, metadata, is_read, priority)
  values
    (v_owner, new.user_id, v_type, v_title, v_body, 'podcasting', v_action_url, v_metadata, false, 1);

  return new;
end;
$$;

revoke all on function private.notify_member_post_activity() from public, anon, authenticated;

drop trigger if exists trg_cr_social_like_notification on public.podcast_member_post_likes;
create trigger trg_cr_social_like_notification
after insert on public.podcast_member_post_likes
for each row execute function private.notify_member_post_activity();

drop trigger if exists trg_cr_social_comment_notification on public.podcast_member_post_comments;
create trigger trg_cr_social_comment_notification
after insert on public.podcast_member_post_comments
for each row execute function private.notify_member_post_activity();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'crowrules_notifications'
  ) then
    alter publication supabase_realtime add table public.crowrules_notifications;
  end if;
end $$;