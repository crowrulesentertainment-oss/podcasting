-- Universal Notification Center 15.0: additive notification enhancements.
alter table public.podcast_notification_preferences add column if not exists announcements_enabled boolean not null default true;
alter table public.podcast_live_notifications enable row level security;
alter table public.podcast_notifications enable row level security;
drop policy if exists "Podcast admins inspect live notifications 15" on public.podcast_live_notifications;
create policy "Podcast admins inspect live notifications 15" on public.podcast_live_notifications for select to authenticated using (private.crowrules_is_admin_impl());
drop policy if exists "Podcast admins inspect notifications 15" on public.podcast_notifications;
create policy "Podcast admins inspect notifications 15" on public.podcast_notifications for select to authenticated using (private.crowrules_is_admin_impl());
create table if not exists public.podcast_platform_announcements_v15 (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(trim(title)) between 4 and 160),
 body text not null check(char_length(trim(body)) between 1 and 5000),
 action_url text,
 priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz,
 created_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint podcast_platform_announcements_v15_valid_window check(ends_at is null or ends_at>starts_at)
);
create index if not exists podcast_platform_announcements_v15_active_idx on public.podcast_platform_announcements_v15(status,starts_at desc,ends_at);
alter table public.podcast_platform_announcements_v15 enable row level security;
revoke all on public.podcast_platform_announcements_v15 from anon;
grant select,insert,update,delete on public.podcast_platform_announcements_v15 to authenticated;
drop policy if exists "Members read active platform announcements 15" on public.podcast_platform_announcements_v15;
create policy "Members read active platform announcements 15" on public.podcast_platform_announcements_v15 for select to authenticated using(status='published' and starts_at<=now() and (ends_at is null or ends_at>now()));
drop policy if exists "Admins manage platform announcements 15" on public.podcast_platform_announcements_v15;
create policy "Admins manage platform announcements 15" on public.podcast_platform_announcements_v15 for all to authenticated using(private.crowrules_is_admin_impl()) with check(private.crowrules_is_admin_impl());
