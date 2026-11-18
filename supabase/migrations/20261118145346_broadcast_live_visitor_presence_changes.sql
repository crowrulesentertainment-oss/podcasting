-- Push live presence changes to the private admin activity channel.
-- Heartbeat-only last_seen_at updates do not emit broadcasts.
create or replace function private.podcasting_broadcast_live_presence_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform realtime.send(
    jsonb_build_object('changed_at', now()),
    'presence_changed',
    'podcasting:admin:visitor-activity',
    true
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

revoke all on function private.podcasting_broadcast_live_presence_change() from public, anon, authenticated;

drop trigger if exists podcasting_live_presence_admin_insert_delete on private.podcasting_live_presence_sessions;
create trigger podcasting_live_presence_admin_insert_delete
after insert or delete on private.podcasting_live_presence_sessions
for each row execute function private.podcasting_broadcast_live_presence_change();

drop trigger if exists podcasting_live_presence_admin_location_page_update on private.podcasting_live_presence_sessions;
create trigger podcasting_live_presence_admin_location_page_update
after update of page_path, city, region, country_code on private.podcasting_live_presence_sessions
for each row
when (
  old.page_path is distinct from new.page_path
  or old.city is distinct from new.city
  or old.region is distinct from new.region
  or old.country_code is distinct from new.country_code
)
execute function private.podcasting_broadcast_live_presence_change();
