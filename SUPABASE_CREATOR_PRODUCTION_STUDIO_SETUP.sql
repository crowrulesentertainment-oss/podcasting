-- CrowRules Podcasting: Creator Production Studio
-- Run once in Supabase SQL Editor. Uses existing podcast ownership helpers and RLS.
create table if not exists public.podcast_production_projects (
 id uuid primary key default gen_random_uuid(),
 podcast_id uuid not null references public.podcasts(id) on delete cascade,
 source_collaboration_id uuid references public.podcast_community_circle_collaborations(id) on delete set null,
 created_by uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 2 and 180),
 summary text not null default '' check (char_length(summary) <= 5000),
 stage text not null default 'Planning' check (stage in ('Planning','Research','Guest Coordination','Recording','Editing','Review','Scheduled','Published','On Hold')),
 target_release_at timestamptz,
 guest_info text not null default '' check (char_length(guest_info) <= 5000),
 contributors text not null default '' check (char_length(contributors) <= 5000),
 script_outline text not null default '' check (char_length(script_outline) <= 12000),
 production_notes text not null default '' check (char_length(production_notes) <= 12000),
 community_idea text not null default '' check (char_length(community_idea) <= 5000),
 checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 8),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.podcast_production_projects add column if not exists source_collaboration_id uuid references public.podcast_community_circle_collaborations(id) on delete set null;
create index if not exists podcast_production_projects_podcast_updated_idx on public.podcast_production_projects(podcast_id,updated_at desc);
create index if not exists podcast_production_projects_creator_idx on public.podcast_production_projects(created_by,updated_at desc);
alter table public.podcast_production_projects enable row level security;
revoke all on public.podcast_production_projects from anon,public;
grant select,insert,update,delete on public.podcast_production_projects to authenticated;
drop policy if exists "production projects creator read" on public.podcast_production_projects;
drop policy if exists "production projects creator insert" on public.podcast_production_projects;
drop policy if exists "production projects creator update" on public.podcast_production_projects;
drop policy if exists "production projects creator delete" on public.podcast_production_projects;
drop policy if exists "production projects admin all" on public.podcast_production_projects;
create policy "production projects creator read" on public.podcast_production_projects for select to authenticated using (crowrules_is_admin() or private.can_manage_podcast(podcast_id));
create policy "production projects creator insert" on public.podcast_production_projects for insert to authenticated with check (crowrules_is_admin() or (created_by=(select auth.uid()) and private.can_manage_podcast(podcast_id)));
create policy "production projects creator update" on public.podcast_production_projects for update to authenticated using (crowrules_is_admin() or private.can_manage_podcast(podcast_id)) with check (crowrules_is_admin() or private.can_manage_podcast(podcast_id));
create policy "production projects creator delete" on public.podcast_production_projects for delete to authenticated using (crowrules_is_admin() or private.can_manage_podcast(podcast_id));
