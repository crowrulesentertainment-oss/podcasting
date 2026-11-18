-- Keep the new analytics tables inaccessible through direct Data API table reads.
-- Admins use the authorization-checked RPC; the Edge Function uses service_role.
revoke all on table
  public.podcasting_page_view_events,
  public.podcasting_visitor_locations,
  public.podcasting_visitor_daily_uniques,
  public.podcasting_visitor_daily_sessions,
  public.podcasting_visitor_daily_rollups
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.podcasting_page_view_events,
  public.podcasting_visitor_locations,
  public.podcasting_visitor_daily_uniques,
  public.podcasting_visitor_daily_sessions,
  public.podcasting_visitor_daily_rollups
to service_role;

revoke all on function private.podcasting_broadcast_page_view_insert() from public, anon, authenticated;
