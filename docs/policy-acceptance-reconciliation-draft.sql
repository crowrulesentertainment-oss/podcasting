-- PREPARATION DRAFT ONLY: reconcile the merged policy foundation and expiry migration.
-- Apply only after the base ledger migration and the timestamped expiration migration,
-- and only to a disposable PostgreSQL/Supabase environment.
--
-- This is deliberately in docs/, not supabase/migrations/: the Supabase CLI is not
-- installed in this execution environment, so a formal migration file has not been
-- generated with "supabase migration new".
--
-- This corrective migration:
--   * closes authenticated access to the private helper/schema;
--   * gives the member-facing acceptance wrapper a non-login, NOBYPASSRLS owner;
--   * makes acceptance, publish, and withdrawal use parent-first document locks;
--   * prevents withdrawn/expired latest versions from reviving older versions;
--   * exposes explicit current-version and published-history read contracts;
--   * provides admin-only lifecycle RPCs using the existing private admin helper.
--
-- It does not seed/publish policies, change signup enforcement, or touch marketing
-- consent or cr_internal objects.

begin;

-- ---------------------------------------------------------------------------
-- 1. Dedicated function owner: never a login, superuser, or RLS bypass role.
-- ---------------------------------------------------------------------------

do $role$
declare
  v_role oid;
  v_executor oid;
  v_created boolean := false;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'crowrules_policy_owner') then
    create role crowrules_policy_owner
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
    v_created := true;
  end if;

  select oid into v_role
  from pg_catalog.pg_roles
  where rolname = 'crowrules_policy_owner';

  select oid into v_executor
  from pg_catalog.pg_roles
  where rolname = current_user;

  if exists (
    select 1 from pg_catalog.pg_auth_members m
    where m.member = v_role
  ) then
    raise exception 'crowrules_policy_owner must not be a member of another role';
  end if;

  if exists (
    select 1 from pg_catalog.pg_auth_members m
    where m.roleid = v_role
      and (not v_created or m.member <> v_executor)
  ) then
    raise exception 'crowrules_policy_owner has unexpected role members';
  end if;
end
$role$;

do $role_check$
declare
  v_role oid;
begin
  select oid into v_role
  from pg_catalog.pg_roles
  where rolname = 'crowrules_policy_owner';

  if exists (
    select 1
    from pg_catalog.pg_roles r
    where r.oid = v_role
      and (r.rolcanlogin or r.rolsuper or r.rolcreatedb or r.rolcreaterole
           or r.rolreplication or r.rolbypassrls or r.rolinherit)
  ) then
    raise exception 'crowrules_policy_owner has unsafe role attributes';
  end if;

  if to_regprocedure('private.crowrules_is_admin_impl()') is null then
    raise exception 'Required existing admin authorization helper private.crowrules_is_admin_impl() is missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('policy_documents', 'policy_versions', 'policy_acceptances')
      and c.relowner = v_role
  ) then
    raise exception 'crowrules_policy_owner must not own the policy tables; owned views rely on RLS';
  end if;
end
$role_check$;

grant usage on schema public, auth, private, crowrules_policy_private
  to crowrules_policy_owner;

-- A catalog sentinel prevents a document from being inserted concurrently
-- after acceptance has enumerated and locked the complete document set.
create table crowrules_policy_private.policy_catalog_guard (
  singleton boolean primary key default true check (singleton)
);
insert into crowrules_policy_private.policy_catalog_guard(singleton)
values (true)
on conflict (singleton) do nothing;
alter table crowrules_policy_private.policy_catalog_guard enable row level security;
create policy policy_catalog_guard_owner_access
  on crowrules_policy_private.policy_catalog_guard
  for all to crowrules_policy_owner
  using (true)
  with check (true);
grant select on crowrules_policy_private.policy_catalog_guard
  to crowrules_policy_owner;
grant update (singleton) on crowrules_policy_private.policy_catalog_guard
  to crowrules_policy_owner;
revoke all on crowrules_policy_private.policy_catalog_guard
  from public, anon, authenticated, service_role;

grant execute on function auth.uid() to crowrules_policy_owner;
grant execute on function private.crowrules_is_admin_impl()
  to crowrules_policy_owner;

-- ---------------------------------------------------------------------------
-- 2. RLS policies and narrow privileges for the non-login function owner.
--    The owner is not the table owner and has NOBYPASSRLS, so these policies
--    remain active inside its SECURITY DEFINER wrappers and owned views.
-- ---------------------------------------------------------------------------

create policy policy_documents_policy_owner_access
  on public.policy_documents
  for all to crowrules_policy_owner
  using (true)
  with check (true);

create policy policy_versions_policy_owner_access
  on public.policy_versions
  for all to crowrules_policy_owner
  using (true)
  with check (true);

create policy policy_acceptances_policy_owner_insert
  on public.policy_acceptances
  for insert to crowrules_policy_owner
  with check (true);

create policy policy_acceptances_policy_owner_read
  on public.policy_acceptances
  for select to crowrules_policy_owner
  using (true);

grant select on public.policy_documents, public.policy_versions
  to crowrules_policy_owner;
grant insert on public.policy_documents, public.policy_versions,
  public.policy_acceptances to crowrules_policy_owner;
-- ON CONFLICT idempotency checks the existing unique-key row internally.
grant select on public.policy_acceptances to crowrules_policy_owner;

-- SELECT ... FOR UPDATE requires UPDATE privilege. Only the immutable parent
-- key is granted on documents; version UPDATE is needed by the controlled
-- lifecycle RPCs and for the post-parent-lock version row lock.
grant update (id) on public.policy_documents to crowrules_policy_owner;
grant update on public.policy_versions to crowrules_policy_owner;

revoke insert, update, delete, truncate, references, trigger
  on public.policy_documents, public.policy_versions
  from public, anon, authenticated, service_role;

revoke all on public.policy_acceptances
  from public, anon, authenticated, service_role;
grant insert, select on public.policy_acceptances to crowrules_policy_owner;
grant select on public.policy_acceptances to authenticated;

-- Keep the private schema and helper unavailable to every API/client role.
revoke all on schema crowrules_policy_private
  from public, anon, authenticated, service_role;
grant usage on schema crowrules_policy_private to crowrules_policy_owner;

-- ---------------------------------------------------------------------------
-- 3. Version integrity: draft content can be corrected; published content and
--    expiry are immutable. Only draft -> published -> withdrawn is supported.
-- ---------------------------------------------------------------------------

do $expiry_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.policy_versions'::regclass
      and conname = 'policy_versions_expiration_after_effective_check'
  ) then
    alter table public.policy_versions
      add constraint policy_versions_expiration_after_effective_check
      check (
        expires_at is null
        or (effective_at is not null and expires_at > effective_at)
      );
  end if;
end
$expiry_constraint$;

create index if not exists policy_versions_lifecycle_lookup_idx
  on public.policy_versions
    (document_id, effective_at desc, published_at desc, id desc)
  where status in ('published', 'withdrawn');

create or replace function public.guard_policy_version_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.document_id is distinct from old.document_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Policy version identity is immutable'
      using errcode = '55000';
  end if;

  if old.status = 'draft' then
    if new.status = 'draft' then
      if new.published_at is not null then
        raise exception 'A draft cannot have published_at'
          using errcode = '55000';
      end if;
      return new;
    elsif new.status = 'published' then
      if new.effective_at is null or new.published_at is null then
        raise exception 'Publishing requires effective_at and published_at'
          using errcode = '55000';
      end if;
      if row(
        new.version_label, new.content_url, new.content_sha256,
        new.requires_acceptance, new.effective_at, new.expires_at
      ) is distinct from row(
        old.version_label, old.content_url, old.content_sha256,
        old.requires_acceptance, old.effective_at, old.expires_at
      ) then
        raise exception 'Finalize draft fields before publishing'
          using errcode = '55000';
      end if;
      return new;
    end if;

    raise exception 'Invalid policy version lifecycle transition'
      using errcode = '55000';
  elsif old.status = 'published' then
    if new.status <> 'withdrawn'
       or new.published_at is distinct from old.published_at
       or row(
         new.version_label, new.content_url, new.content_sha256,
         new.requires_acceptance, new.effective_at, new.expires_at
       ) is distinct from row(
         old.version_label, old.content_url, old.content_sha256,
         old.requires_acceptance, old.effective_at, old.expires_at
       ) then
      raise exception 'Published policy content and expiration are immutable; only withdrawal is allowed'
        using errcode = '55000';
    end if;
    return new;
  end if;

  raise exception 'Withdrawn policy versions cannot be changed or republished'
    using errcode = '55000';
end;
$function$;

revoke all on function public.guard_policy_version_revision()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. One authoritative latest-candidate selector for discovery and acceptance.
--    Withdrawn/expired filtering occurs only after the latest candidate has
--    been selected. The views are owned by a restricted NOBYPASSRLS role:
--    their underlying table RLS is evaluated as that owner, not postgres.
-- ---------------------------------------------------------------------------

grant create on schema public to crowrules_policy_owner;

-- Supabase's migration executor may not be SUPERUSER. Temporarily grant it
-- membership so ALTER VIEW/FUNCTION OWNER TO can transfer ownership. The
-- membership is revoked after all ownership changes are complete.
do $membership$
begin
  if not pg_catalog.pg_has_role(current_user, 'crowrules_policy_owner', 'SET')
     and not exists (
       select 1 from pg_catalog.pg_roles
       where rolname = current_user and rolsuper
     ) then
    execute format('grant crowrules_policy_owner to %I with set true', current_user);
  end if;
end
$membership$;

create or replace view public.policy_current_versions
with (security_barrier = true)
as
with latest as materialized (
  select distinct on (v.document_id)
    v.document_id, v.id, v.version_label, v.content_url, v.content_sha256,
    v.requires_acceptance, v.status, v.effective_at, v.published_at, v.expires_at
  from public.policy_versions v
  where v.status in ('published', 'withdrawn')
    and v.effective_at <= transaction_timestamp()
  order by
    v.document_id,
    v.effective_at desc,
    v.published_at desc,
    v.id desc
)
select
  d.id as document_id,
  d.document_key,
  d.title,
  d.description,
  latest.id as policy_version_id,
  latest.version_label,
  latest.content_url,
  latest.content_sha256,
  latest.requires_acceptance,
  latest.effective_at,
  latest.published_at,
  latest.expires_at
from latest
join public.policy_documents d on d.id = latest.document_id
where latest.status = 'published'
  and (latest.expires_at is null or latest.expires_at > transaction_timestamp());

create or replace view public.policy_published_history
with (security_barrier = true)
as
with latest as materialized (
  select distinct on (v.document_id)
    v.document_id, v.id, v.status, v.expires_at
  from public.policy_versions v
  where v.status in ('published', 'withdrawn')
    and v.effective_at <= transaction_timestamp()
  order by
    v.document_id,
    v.effective_at desc,
    v.published_at desc,
    v.id desc
)
select
  d.id as document_id,
  d.document_key,
  d.title,
  v.id as policy_version_id,
  v.version_label,
  v.content_url,
  v.content_sha256,
  v.requires_acceptance,
  v.effective_at,
  v.published_at,
  v.expires_at,
  case
    when latest.id = v.id
      and latest.status = 'published'
      and (v.expires_at is null or v.expires_at > transaction_timestamp())
      then 'current'
    when latest.id = v.id and latest.status = 'withdrawn' then 'withdrawn'
    when latest.id = v.id
      and latest.status = 'published'
      and v.expires_at <= transaction_timestamp()
      then 'expired'
    else 'superseded'
  end as history_state,
  case
    when latest.status = 'withdrawn' then 'withdrawn'
    when latest.status = 'published'
      and latest.expires_at is not null
      and latest.expires_at <= transaction_timestamp()
      then 'expired'
    when latest.status = 'published' then 'active'
    else 'unavailable'
  end as document_state
from public.policy_versions v
join public.policy_documents d on d.id = v.document_id
join latest on latest.document_id = v.document_id
where v.status = 'published'
  and v.effective_at <= transaction_timestamp();

alter view public.policy_current_versions owner to crowrules_policy_owner;
alter view public.policy_published_history owner to crowrules_policy_owner;

revoke all on public.policy_current_versions, public.policy_published_history
  from public, anon, authenticated, service_role;
grant select on public.policy_current_versions, public.policy_published_history
  to anon, authenticated;

revoke create on schema public from crowrules_policy_owner;

-- ---------------------------------------------------------------------------
-- 5. Acceptance implementation. Parent rows are locked in ascending UUID order
--    before any version rows. The required set is re-evaluated after locks.
-- ---------------------------------------------------------------------------

create or replace function crowrules_policy_private.accept_current_required_policy_versions_impl(
  p_policy_version_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_withdrawn_required_exists boolean;
  v_expired_required_exists boolean;
  v_required_count integer;
  v_supplied_count integer;
  v_inserted_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Policy acceptance requires READ COMMITTED transaction isolation'
      using errcode = '25001';
  end if;

  if p_policy_version_ids is null then
    raise exception 'A policy version array is required'
      using errcode = '22023';
  end if;

  -- Common lock order: catalog sentinel; every parent document in ascending
  -- UUID order; then every version ordered by parent ID and version ID.
  -- Document creation locks the same sentinel before inserting a new parent.
  perform g.singleton
  from crowrules_policy_private.policy_catalog_guard g
  where g.singleton is true
  for update;

  if not found then
    raise exception 'Policy catalog lock row is missing'
      using errcode = '55000';
  end if;

  perform d.id
  from public.policy_documents d
  order by d.id
  for update;

  perform v.id
  from public.policy_versions v
  order by v.document_id, v.id
  for update;

  -- Latest effective withdrawn required version blocks completion. Never
  -- filter withdrawn rows before selecting the latest candidate.
  with latest as materialized (
    select distinct on (v.document_id)
      v.document_id, v.id, v.status, v.requires_acceptance, v.expires_at
    from public.policy_versions v
    where v.status in ('published', 'withdrawn')
      and v.effective_at <= transaction_timestamp()
    order by
      v.document_id, v.effective_at desc, v.published_at desc, v.id desc
  )
  select exists (
    select 1 from latest
    where status = 'withdrawn' and requires_acceptance is true
  )
  into v_withdrawn_required_exists;

  if v_withdrawn_required_exists then
    raise exception 'A required policy is withdrawn; a replacement must be published and effective before acceptance can continue'
      using errcode = '22023';
  end if;

  -- Latest effective expired required version blocks completion. A future
  -- replacement does not become current until its effective_at is reached.
  with latest as materialized (
    select distinct on (v.document_id)
      v.document_id, v.id, v.status, v.requires_acceptance, v.expires_at
    from public.policy_versions v
    where v.status in ('published', 'withdrawn')
      and v.effective_at <= transaction_timestamp()
    order by
      v.document_id, v.effective_at desc, v.published_at desc, v.id desc
  )
  select exists (
    select 1 from latest
    where status = 'published'
      and requires_acceptance is true
      and expires_at is not null
      and expires_at <= transaction_timestamp()
  )
  into v_expired_required_exists;

  if v_expired_required_exists then
    raise exception 'A required policy has expired; a replacement must be published and effective before acceptance can continue'
      using errcode = '22023';
  end if;

  with latest as materialized (
    select distinct on (v.document_id)
      v.document_id, v.id, v.status, v.requires_acceptance, v.expires_at
    from public.policy_versions v
    where v.status in ('published', 'withdrawn')
      and v.effective_at <= transaction_timestamp()
    order by
      v.document_id, v.effective_at desc, v.published_at desc, v.id desc
  )
  select count(*)
  into v_required_count
  from latest
  where status = 'published'
    and requires_acceptance is true
    and (expires_at is null or expires_at > transaction_timestamp());

  with latest as materialized (
    select distinct on (v.document_id)
      v.document_id, v.id, v.status, v.requires_acceptance, v.expires_at
    from public.policy_versions v
    where v.status in ('published', 'withdrawn')
      and v.effective_at <= transaction_timestamp()
    order by
      v.document_id, v.effective_at desc, v.published_at desc, v.id desc
  ),
  required_versions as (
    select id
    from latest
    where status = 'published'
      and requires_acceptance is true
      and (expires_at is null or expires_at > transaction_timestamp())
  )
  select count(distinct supplied.version_id)
  into v_supplied_count
  from unnest(p_policy_version_ids) as supplied(version_id)
  join required_versions r on r.id = supplied.version_id;

  if cardinality(p_policy_version_ids) <> v_required_count
     or v_supplied_count <> v_required_count then
    raise exception 'Please review and accept the complete set of current required policy versions'
      using errcode = '22023';
  end if;

  insert into public.policy_acceptances (
    user_id, policy_version_id, acceptance_context
  )
  select v_user_id, supplied.version_id, 'member_confirmation'
  from (
    select distinct unnest(p_policy_version_ids) as version_id
  ) supplied
  on conflict (user_id, policy_version_id) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$function$;

-- The public wrapper validates the Auth identity before delegating.
create or replace function public.accept_current_required_policy_versions(
  p_policy_version_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  return crowrules_policy_private.accept_current_required_policy_versions_impl(
    p_policy_version_ids
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Controlled admin lifecycle RPCs. Every version mutation obtains the parent
--    document lock before locking or changing the version row. Authorization
--    delegates to the repository's existing private admin helper.
-- ---------------------------------------------------------------------------

create or replace function public.policy_admin_create_document(
  p_document_key text,
  p_title text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null
     or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;

  -- Serialize catalog membership with acceptance's complete-set scan.
  perform g.singleton
  from crowrules_policy_private.policy_catalog_guard g
  where g.singleton is true
  for update;

  if not found then
    raise exception 'Policy catalog lock row is missing'
      using errcode = '55000';
  end if;

  insert into public.policy_documents(document_key, title, description)
  values (p_document_key, p_title, p_description)
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.policy_admin_create_draft_version(
  p_document_id uuid,
  p_version_label text,
  p_content_url text,
  p_content_sha256 text,
  p_requires_acceptance boolean,
  p_effective_at timestamptz,
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document_id uuid;
  v_id uuid;
begin
  if auth.uid() is null
     or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Policy lifecycle operations require READ COMMITTED transaction isolation'
      using errcode = '25001';
  end if;

  select d.id into v_document_id
  from public.policy_documents d
  where d.id = p_document_id
  for update;

  if not found then
    raise exception 'POLICY_DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.policy_versions(
    document_id, version_label, content_url, content_sha256,
    requires_acceptance, status, effective_at, expires_at
  )
  values (
    p_document_id, p_version_label, p_content_url, p_content_sha256,
    p_requires_acceptance, 'draft', p_effective_at, p_expires_at
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.policy_admin_update_draft_version(
  p_policy_version_id uuid,
  p_version_label text,
  p_content_url text,
  p_content_sha256 text,
  p_requires_acceptance boolean,
  p_effective_at timestamptz,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document_id uuid;
begin
  if auth.uid() is null
     or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Policy lifecycle operations require READ COMMITTED transaction isolation'
      using errcode = '25001';
  end if;

  -- Non-locking lookup only; the first row lock is always the parent document.
  select v.document_id into v_document_id
  from public.policy_versions v
  where v.id = p_policy_version_id;

  if not found then
    raise exception 'POLICY_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform d.id
  from public.policy_documents d
  where d.id = v_document_id
  for update;

  perform v.id
  from public.policy_versions v
  where v.id = p_policy_version_id
    and v.document_id = v_document_id
    and v.status = 'draft'
  for update;

  if not found then
    raise exception 'POLICY_DRAFT_NOT_FOUND_OR_NOT_EDITABLE' using errcode = '55000';
  end if;

  update public.policy_versions
  set version_label = p_version_label,
      content_url = p_content_url,
      content_sha256 = p_content_sha256,
      requires_acceptance = p_requires_acceptance,
      effective_at = p_effective_at,
      expires_at = p_expires_at
  where id = p_policy_version_id
    and document_id = v_document_id
    and status = 'draft';
end;
$function$;

create or replace function public.policy_admin_publish_version(
  p_policy_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document_id uuid;
begin
  if auth.uid() is null
     or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Policy lifecycle operations require READ COMMITTED transaction isolation'
      using errcode = '25001';
  end if;

  select v.document_id into v_document_id
  from public.policy_versions v
  where v.id = p_policy_version_id;

  if not found then
    raise exception 'POLICY_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform d.id
  from public.policy_documents d
  where d.id = v_document_id
  for update;

  perform v.id
  from public.policy_versions v
  where v.id = p_policy_version_id
    and v.document_id = v_document_id
    and v.status = 'draft'
  for update;

  if not found then
    raise exception 'POLICY_DRAFT_NOT_FOUND_OR_NOT_PUBLISHABLE' using errcode = '55000';
  end if;

  update public.policy_versions
  set status = 'published',
      published_at = transaction_timestamp()
  where id = p_policy_version_id
    and document_id = v_document_id
    and status = 'draft';
end;
$function$;

create or replace function public.policy_admin_withdraw_version(
  p_policy_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document_id uuid;
begin
  if auth.uid() is null
     or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Policy lifecycle operations require READ COMMITTED transaction isolation'
      using errcode = '25001';
  end if;

  select v.document_id into v_document_id
  from public.policy_versions v
  where v.id = p_policy_version_id;

  if not found then
    raise exception 'POLICY_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform d.id
  from public.policy_documents d
  where d.id = v_document_id
  for update;

  perform v.id
  from public.policy_versions v
  where v.id = p_policy_version_id
    and v.document_id = v_document_id
    and v.status = 'published'
  for update;

  if not found then
    raise exception 'POLICY_VERSION_NOT_FOUND_OR_NOT_WITHDRAWABLE' using errcode = '55000';
  end if;

  update public.policy_versions
  set status = 'withdrawn'
  where id = p_policy_version_id
    and document_id = v_document_id
    and status = 'published';
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Assign the restricted owner, then close every client/private grant.
-- ---------------------------------------------------------------------------

grant create on schema crowrules_policy_private to crowrules_policy_owner;
grant create on schema public to crowrules_policy_owner;

alter function crowrules_policy_private.accept_current_required_policy_versions_impl(uuid[])
  owner to crowrules_policy_owner;


alter function public.accept_current_required_policy_versions(uuid[])
  owner to crowrules_policy_owner;

alter function public.policy_admin_create_document(text, text, text)
  owner to crowrules_policy_owner;
alter function public.policy_admin_create_draft_version(uuid, text, text, text, boolean, timestamptz, timestamptz)
  owner to crowrules_policy_owner;
alter function public.policy_admin_update_draft_version(uuid, text, text, text, boolean, timestamptz, timestamptz)
  owner to crowrules_policy_owner;
alter function public.policy_admin_publish_version(uuid)
  owner to crowrules_policy_owner;
alter function public.policy_admin_withdraw_version(uuid)
  owner to crowrules_policy_owner;

revoke create on schema public from crowrules_policy_owner;
revoke create on schema crowrules_policy_private from crowrules_policy_owner;

do $membership_cleanup$
begin
  if pg_catalog.pg_has_role(current_user, 'crowrules_policy_owner', 'MEMBER')
     and not exists (
       select 1 from pg_catalog.pg_roles
       where rolname = current_user and rolsuper
     ) then
    execute format('revoke crowrules_policy_owner from %I', current_user);
  end if;
end
$membership_cleanup$;

revoke all on function crowrules_policy_private.accept_current_required_policy_versions_impl(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.accept_current_required_policy_versions(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.accept_current_required_policy_versions(uuid[])
  to authenticated;

revoke all on function public.policy_admin_create_document(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.policy_admin_create_draft_version(uuid, text, text, text, boolean, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.policy_admin_update_draft_version(uuid, text, text, text, boolean, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.policy_admin_publish_version(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.policy_admin_withdraw_version(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.policy_admin_create_document(text, text, text)
  to authenticated;
grant execute on function public.policy_admin_create_draft_version(uuid, text, text, text, boolean, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.policy_admin_update_draft_version(uuid, text, text, text, boolean, timestamptz, timestamptz)
  to authenticated;
grant execute on function public.policy_admin_publish_version(uuid)
  to authenticated;
grant execute on function public.policy_admin_withdraw_version(uuid)
  to authenticated;

revoke all on function public.prevent_policy_acceptance_mutation()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
