-- Distribution Upgrade 2: atomic queue leases, bounded retry/backoff, token-vault hardening.
-- Existing token table has no stored credentials; remove plaintext token columns before any OAuth rollout.
alter table private.podcast_distribution_oauth_states
  add column if not exists code_verifier text,
  add column if not exists redirect_uri text,
  add column if not exists provider_state text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='private' and table_name='podcast_distribution_tokens' and column_name='access_token')
     and not exists (select 1 from private.podcast_distribution_tokens where access_token is not null) then
    alter table private.podcast_distribution_tokens drop column access_token;
  elsif exists (select 1 from information_schema.columns where table_schema='private' and table_name='podcast_distribution_tokens' and column_name='access_token') then
    raise exception 'Plaintext access tokens exist; migrate them to encrypted storage before applying this migration.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='private' and table_name='podcast_distribution_tokens' and column_name='refresh_token')
     and not exists (select 1 from private.podcast_distribution_tokens where refresh_token is not null) then
    alter table private.podcast_distribution_tokens drop column refresh_token;
  elsif exists (select 1 from information_schema.columns where table_schema='private' and table_name='podcast_distribution_tokens' and column_name='refresh_token') then
    raise exception 'Plaintext refresh tokens exist; migrate them to encrypted storage before applying this migration.';
  end if;
end $$;

alter table private.podcast_distribution_tokens
  add column if not exists access_token_ciphertext text,
  add column if not exists refresh_token_ciphertext text,
  add column if not exists encryption_key_version integer not null default 1;
comment on table private.podcast_distribution_tokens is 'Private token vault. Store only application-encrypted OAuth tokens; never expose through browser/Data API. Encryption key must live in Edge Function secrets.';
comment on column private.podcast_distribution_tokens.access_token_ciphertext is 'AES-GCM ciphertext generated server-side using DISTRIBUTION_TOKEN_ENCRYPTION_KEY; never plaintext.';
comment on column private.podcast_distribution_tokens.refresh_token_ciphertext is 'AES-GCM ciphertext generated server-side using DISTRIBUTION_TOKEN_ENCRYPTION_KEY; never plaintext.';

alter table public.podcast_distribution_posts
  add column if not exists max_attempts integer not null default 5,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists published_provider_id text;

create index if not exists podcast_distribution_posts_due_queue_idx
  on public.podcast_distribution_posts(coalesce(next_attempt_at, scheduled_at), created_at)
  where status in ('queued','failed');

create or replace function public.distribution_claim_jobs(p_worker_id text, p_limit integer default 20, p_lease_seconds integer default 300)
returns setof public.podcast_distribution_posts
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 8 then
    raise exception 'A worker ID of at least 8 characters is required';
  end if;
  return query
  with candidates as (
    select p.id
    from public.podcast_distribution_posts p
    where p.status='queued'
      and coalesce(p.next_attempt_at,p.scheduled_at,now()) <= now()
      and (p.locked_at is null or p.locked_at < now() - make_interval(secs => greatest(p_lease_seconds,60)))
    order by coalesce(p.next_attempt_at,p.scheduled_at,p.created_at), p.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit,20),1),50)
  ), claimed as (
    update public.podcast_distribution_posts p
    set status='publishing',
        locked_at=now(),
        worker_id=p_worker_id,
        attempt_count=p.attempt_count+1,
        last_attempt_at=now(),
        updated_at=now()
    from candidates c
    where p.id=c.id
    returning p.*
  )
  select * from claimed;
end;
$$;
revoke all on function public.distribution_claim_jobs(text,integer,integer) from public, anon, authenticated;
grant execute on function public.distribution_claim_jobs(text,integer,integer) to service_role;

create or replace function public.distribution_mark_published(
  p_post_id uuid, p_worker_id text, p_provider_post_id text, p_external_url text
) returns boolean
language plpgsql security definer set search_path=''
as $$
declare v public.podcast_distribution_posts%rowtype;
begin
  update public.podcast_distribution_posts
    set status='published', published_at=now(), external_post_url=nullif(left(coalesce(p_external_url,''),2000),''),
        published_provider_id=nullif(left(coalesce(p_provider_post_id,''),300),''),
        locked_at=null,worker_id=null,last_error=null,updated_at=now()
    where id=p_post_id and status='publishing' and worker_id=p_worker_id
    returning * into v;
  if not found then return false; end if;
  insert into public.podcast_distribution_delivery_logs(post_id,user_id,platform,event_type,outcome,message,provider_code)
  values(v.id,v.user_id,v.platform,'published','success','Provider confirmed publication.',nullif(left(coalesce(p_provider_post_id,''),300),''));
  return true;
end;
$$;
revoke all on function public.distribution_mark_published(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.distribution_mark_published(uuid,text,text,text) to service_role;

create or replace function public.distribution_retry_or_fail(
  p_post_id uuid, p_worker_id text, p_error text, p_provider_code text default null, p_retryable boolean default true
) returns text
language plpgsql security definer set search_path=''
as $$
declare v public.podcast_distribution_posts%rowtype; v_next timestamptz; v_status text; v_msg text;
begin
  select * into v from public.podcast_distribution_posts
   where id=p_post_id and status='publishing' and worker_id=p_worker_id
   for update;
  if not found then return 'lease_lost'; end if;
  v_msg:=left(coalesce(p_error,'Unknown delivery error'),1000);
  if p_retryable and v.attempt_count < greatest(v.max_attempts,1) then
    v_next:=now()+make_interval(secs => least(21600,30 * power(2,greatest(v.attempt_count-1,0))::integer));
    v_status:='queued';
    update public.podcast_distribution_posts set status='queued',next_attempt_at=v_next,scheduled_at=v_next,
      last_error=v_msg,locked_at=null,worker_id=null,updated_at=now() where id=v.id;
    insert into public.podcast_distribution_delivery_logs(post_id,user_id,platform,event_type,outcome,message,provider_code)
      values(v.id,v.user_id,v.platform,'retry_scheduled','warning','Retry scheduled for '||v_next::text||'. '||v_msg,nullif(left(coalesce(p_provider_code,''),100),''));
  else
    v_status:=case when p_retryable then 'failed' else 'manual_required' end;
    update public.podcast_distribution_posts set status=v_status,last_error=v_msg,locked_at=null,worker_id=null,updated_at=now() where id=v.id;
    insert into public.podcast_distribution_delivery_logs(post_id,user_id,platform,event_type,outcome,message,provider_code)
      values(v.id,v.user_id,v.platform,case when v_status='failed' then 'failed' else 'manual_required' end,
        case when v_status='failed' then 'error' else 'warning' end,v_msg,nullif(left(coalesce(p_provider_code,''),100),''));
  end if;
  return v_status;
end;
$$;
revoke all on function public.distribution_retry_or_fail(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.distribution_retry_or_fail(uuid,text,text,text,boolean) to service_role;

-- Keep the delivery log append-only for browser users.
revoke insert,update,delete on public.podcast_distribution_delivery_logs from anon,authenticated;
