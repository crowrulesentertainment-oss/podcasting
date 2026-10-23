-- Per-user Theme Studio settings, secured by Supabase Auth and synchronized with Realtime.
create table if not exists public.crowrules_theme_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint crowrules_theme_preferences_state_is_object
    check (jsonb_typeof(theme_state) = 'object'),
  constraint crowrules_theme_preferences_state_size
    check (octet_length(theme_state::text) <= 262144)
);

alter table public.crowrules_theme_preferences enable row level security;

drop policy if exists "Users can read their own theme preferences" on public.crowrules_theme_preferences;
create policy "Users can read their own theme preferences"
  on public.crowrules_theme_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own theme preferences" on public.crowrules_theme_preferences;
create policy "Users can insert their own theme preferences"
  on public.crowrules_theme_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own theme preferences" on public.crowrules_theme_preferences;
create policy "Users can update their own theme preferences"
  on public.crowrules_theme_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep browser permissions minimal; row ownership is enforced by RLS.
revoke all on table public.crowrules_theme_preferences from anon, authenticated;
grant select, insert, update on table public.crowrules_theme_preferences to authenticated;

-- Enable live cross-device updates when the standard Supabase Realtime publication exists.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'crowrules_theme_preferences'
     ) then
    alter publication supabase_realtime add table public.crowrules_theme_preferences;
  end if;
end $$;
