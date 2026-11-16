-- CrowRules community-driven development roadmap.
create table if not exists public.podcast_development_roadmap (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(trim(title)) between 4 and 140),
 summary text not null check (char_length(trim(summary)) between 8 and 280),
 details text,
 category text not null default 'platform',
 status text not null default 'suggested'
  check (status in ('suggested','under_review','approved','in_progress','completed','declined')),
 priority text not null default 'normal'
  check (priority in ('low','normal','high')),
 target_release text,
 release_notes text,
 source_feedback_id uuid references public.podcast_platform_feedback(id) on delete set null,
 sort_order integer not null default 100,
 is_public boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists podcast_development_roadmap_public_sort_idx
 on public.podcast_development_roadmap(is_public,status,sort_order,updated_at desc);
create index if not exists podcast_development_roadmap_source_feedback_idx
 on public.podcast_development_roadmap(source_feedback_id)
 where source_feedback_id is not null;
alter table public.podcast_development_roadmap enable row level security;
grant select on public.podcast_development_roadmap to anon,authenticated;
grant insert,update,delete on public.podcast_development_roadmap to authenticated;
drop policy if exists "Public read published development roadmap" on public.podcast_development_roadmap;
create policy "Public read published development roadmap"
 on public.podcast_development_roadmap for select to anon
 using (is_public=true and status<>'declined');
drop policy if exists "Members read public roadmap and admins read all" on public.podcast_development_roadmap;
create policy "Members read public roadmap and admins read all"
 on public.podcast_development_roadmap for select to authenticated
 using ((is_public=true and status<>'declined') or private.crowrules_is_admin_impl());
drop policy if exists "Admins create development roadmap items" on public.podcast_development_roadmap;
create policy "Admins create development roadmap items"
 on public.podcast_development_roadmap for insert to authenticated
 with check (private.crowrules_is_admin_impl());
drop policy if exists "Admins update development roadmap items" on public.podcast_development_roadmap;
create policy "Admins update development roadmap items"
 on public.podcast_development_roadmap for update to authenticated
 using (private.crowrules_is_admin_impl())
 with check (private.crowrules_is_admin_impl());
drop policy if exists "Admins delete development roadmap items" on public.podcast_development_roadmap;
create policy "Admins delete development roadmap items"
 on public.podcast_development_roadmap for delete to authenticated
 using (private.crowrules_is_admin_impl());
