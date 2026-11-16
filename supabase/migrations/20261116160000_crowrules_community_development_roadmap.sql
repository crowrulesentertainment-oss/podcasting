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


-- Seed the first visible milestones so members can see the feedback-to-release lifecycle.
insert into public.podcast_development_roadmap
 (title,summary,details,category,status,priority,sort_order,is_public,release_notes,completed_at)
select
 'Monthly Platform Feedback Reporting',
 'Recurring member suggestions, reported issues and platform ratings are summarized for CrowRules development planning.',
 'Monthly reporting brings together platform reviews, feature requests, bug reports and feedback status so recurring themes can inform development priorities.',
 'community feedback','completed','normal',10,true,
 'Monthly feedback reporting and the administrator report workspace are available in CrowRules Podcasting.',now()
where not exists(select 1 from public.podcast_development_roadmap where title='Monthly Platform Feedback Reporting');

insert into public.podcast_development_roadmap
 (title,summary,details,category,status,priority,sort_order,is_public)
select
 'Community-Driven Development Roadmap',
 'Members can follow platform suggestions from initial review through approval, active development and release.',
 'This public roadmap connects the CrowRules Platform Reviews feedback queue with visible development stages. CrowRules administrators can publish updates as work progresses.',
 'community feedback','in_progress','high',20,true
where not exists(select 1 from public.podcast_development_roadmap where title='Community-Driven Development Roadmap');

create index if not exists podcast_development_roadmap_created_by_idx
 on public.podcast_development_roadmap(created_by);
create index if not exists podcast_development_roadmap_updated_by_idx
 on public.podcast_development_roadmap(updated_by);
