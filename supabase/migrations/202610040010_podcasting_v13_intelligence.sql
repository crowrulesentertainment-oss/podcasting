create extension if not exists pgcrypto;
create table if not exists public.podcast_presence(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,session_id text not null,page text,mode text default 'browser',podcast_id uuid references public.podcasts(id) on delete set null,episode_id uuid references public.podcast_episodes(id) on delete set null,content_title text,last_seen_at timestamptz not null default now(),metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),unique(user_id,session_id));
create index if not exists podcast_presence_last_seen_idx on public.podcast_presence(last_seen_at desc);
create table if not exists public.podcast_creator_activity(id uuid primary key default gen_random_uuid(),creator_id uuid references public.creators(id) on delete set null,podcast_id uuid references public.podcasts(id) on delete set null,episode_id uuid references public.podcast_episodes(id) on delete set null,actor_user_id uuid references auth.users(id) on delete set null,activity_type text not null,title text,body text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index if not exists podcast_creator_activity_creator_idx on public.podcast_creator_activity(creator_id,created_at desc);
alter table public.podcast_presence enable row level security;
alter table public.podcast_creator_activity enable row level security;
drop policy if exists "own presence" on public.podcast_presence;
create policy "own presence" on public.podcast_presence for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists "creator activity readable" on public.podcast_creator_activity;
create policy "creator activity readable" on public.podcast_creator_activity for select to anon,authenticated using(true);
drop policy if exists "creator activity own insert" on public.podcast_creator_activity;
create policy "creator activity own insert" on public.podcast_creator_activity for insert to authenticated with check(actor_user_id=(select auth.uid()));
do $$ begin alter publication supabase_realtime add table public.podcast_presence; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.podcast_creator_activity; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.podcast_notifications; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.podcast_follows; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.podcast_subscriptions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.podcast_episode_progress; exception when duplicate_object then null; end $$;
create or replace view public.podcast_v13_search_index as
select 'podcast'::text result_type,p.id,p.slug,p.title,p.description,p.artwork_url image_url,p.category,p.creator_id,p.created_at from public.podcasts p where coalesce(p.status,'') not in ('deleted','archived')
union all
select 'episode'::text,e.id,e.slug,e.title,e.description,e.thumbnail_url,null::text,p.creator_id,e.created_at from public.podcast_episodes e left join public.podcasts p on p.id=e.podcast_id where coalesce(e.status,'') not in ('deleted','archived')
union all
select 'creator'::text,c.id,c.slug,coalesce(c.display_name,c.name),c.bio,c.avatar_url,c.discipline,c.id,c.created_at from public.creators c where coalesce(c.is_active,true)=true;
grant select on public.podcast_v13_search_index to anon,authenticated;