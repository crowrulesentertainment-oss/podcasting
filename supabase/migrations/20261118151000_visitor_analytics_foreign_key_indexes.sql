create index if not exists podcasting_visitor_daily_rollups_location_idx
  on public.podcasting_visitor_daily_rollups (location_id);
create index if not exists podcasting_visitor_daily_sessions_location_idx
  on public.podcasting_visitor_daily_sessions (location_id);
create index if not exists podcasting_visitor_daily_uniques_location_idx
  on public.podcasting_visitor_daily_uniques (location_id);
