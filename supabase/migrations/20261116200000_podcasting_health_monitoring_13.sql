create table if not exists public.podcast_health_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 4 and 160),
  service text not null check (service in ('platform','database','auth','storage','media','notifications','edge_functions','other')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','investigating','monitoring','resolved')),
  description text,
  resolution_notes text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists podcast_health_incidents_status_created_idx on public.podcast_health_incidents(status,created_at desc);
create index if not exists podcast_health_incidents_service_created_idx on public.podcast_health_incidents(service,created_at desc);
alter table public.podcast_health_incidents enable row level security;
drop policy if exists "Podcast admins manage health incidents" on public.podcast_health_incidents;
create policy "Podcast admins manage health incidents" on public.podcast_health_incidents
for all to authenticated
using (private.crowrules_is_admin_impl())
with check (private.crowrules_is_admin_impl());
grant select,insert,update,delete on public.podcast_health_incidents to authenticated;
revoke all on public.podcast_health_incidents from anon;

drop policy if exists "Podcast admins inspect media uploads for health" on public.podcast_media_uploads;
create policy "Podcast admins inspect media uploads for health" on public.podcast_media_uploads
for select to authenticated using (private.crowrules_is_admin_impl());
drop policy if exists "Podcast admins inspect media jobs for health" on public.podcast_media_processing_jobs;
create policy "Podcast admins inspect media jobs for health" on public.podcast_media_processing_jobs
for select to authenticated using (private.crowrules_is_admin_impl());
drop policy if exists "Podcast admins inspect notification delivery queue for health" on public.podcast_notification_delivery_queue;
create policy "Podcast admins inspect notification delivery queue for health" on public.podcast_notification_delivery_queue
for select to authenticated using (private.crowrules_is_admin_impl());