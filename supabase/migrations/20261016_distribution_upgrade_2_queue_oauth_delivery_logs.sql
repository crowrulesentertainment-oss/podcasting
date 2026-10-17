-- Upgrade 2: secure distribution queue, OAuth token vault, and delivery audit log.
create schema if not exists private;
create table if not exists private.podcast_distribution_oauth_states (
 state_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 podcast_id uuid not null references public.podcasts(id) on delete cascade,
 platform text not null check(platform in ('facebook','instagram','tiktok','youtube','x','threads')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create table if not exists private.podcast_distribution_tokens (
 account_id uuid primary key references public.podcast_distribution_accounts(id) on delete cascade,
 access_token text,
 refresh_token text,
 token_type text,
 scopes text[],
 expires_at timestamptz,
 provider_account_id text,
 updated_at timestamptz not null default now()
);
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
alter table public.podcast_distribution_posts add column if not exists attempt_count integer not null default 0;
alter table public.podcast_distribution_posts add column if not exists next_attempt_at timestamptz;
alter table public.podcast_distribution_posts add column if not exists idempotency_key text;
alter table public.podcast_distribution_posts add column if not exists locked_at timestamptz;
alter table public.podcast_distribution_posts add column if not exists worker_id text;
create unique index if not exists podcast_distribution_posts_idempotency_idx on public.podcast_distribution_posts(idempotency_key) where idempotency_key is not null;
create index if not exists podcast_distribution_posts_retry_idx on public.podcast_distribution_posts(status,next_attempt_at) where status in ('queued','failed');
create table if not exists public.podcast_distribution_delivery_logs (
 id bigint generated always as identity primary key,
 post_id uuid not null references public.podcast_distribution_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 platform text not null check(platform in ('facebook','instagram','tiktok','youtube','x','threads','crowrules')),
 event_type text not null check(event_type in ('draft_saved','approved','queued','attempt_started','published','retry_scheduled','manual_required','failed','cancelled','connection_started','connection_updated')),
 outcome text not null default 'info' check(outcome in ('info','success','warning','error')),
 message text not null default '', provider_code text, created_at timestamptz not null default now()
);
create index if not exists podcast_distribution_delivery_logs_post_idx on public.podcast_distribution_delivery_logs(post_id,created_at desc);
alter table public.podcast_distribution_delivery_logs enable row level security;
drop policy if exists "Creators read own distribution delivery logs" on public.podcast_distribution_delivery_logs;
create policy "Creators read own distribution delivery logs" on public.podcast_distribution_delivery_logs for select to authenticated using (
 user_id=(select auth.uid()) and exists(select 1 from public.podcasts p join public.creators c on c.id=p.creator_id join public.members m on m.id=c.member_id where p.id=(select d.podcast_id from public.podcast_distribution_posts d where d.id=post_id) and m.user_id=(select auth.uid()))
);
grant select on public.podcast_distribution_delivery_logs to authenticated;
revoke insert,update,delete on public.podcast_distribution_delivery_logs from anon,authenticated;
create or replace function public.distribution_log_event(p_post_id uuid,p_event_type text,p_outcome text,p_message text default '',p_provider_code text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare v public.podcast_distribution_posts%rowtype;
begin
 select * into v from public.podcast_distribution_posts where id=p_post_id;
 if not found or v.user_id <> (select auth.uid()) then raise exception 'Post not found or not authorized'; end if;
 insert into public.podcast_distribution_delivery_logs(post_id,user_id,platform,event_type,outcome,message,provider_code)
 values(v.id,v.user_id,v.platform,p_event_type,p_outcome,left(coalesce(p_message,''),1000),p_provider_code);
end; $$;
revoke all on function public.distribution_log_event(uuid,text,text,text,text) from public,anon;
grant execute on function public.distribution_log_event(uuid,text,text,text,text) to authenticated;
