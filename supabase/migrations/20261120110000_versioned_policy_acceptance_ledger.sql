-- CrowRules Podcasting: versioned policy publication and member acceptance ledger.
-- Prepared on feature/professional-platform-pages; NOT applied to Supabase.
-- No existing tables or promotional-email consent records are modified.

begin;

create table if not exists public.policy_documents (
  id uuid primary key default gen_random_uuid(),
  document_key text not null unique
    check (document_key ~ '^[a-z][a-z0-9_]{2,79}$'),
  title text not null
    check (char_length(btrim(title)) between 2 and 160),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null
    references public.policy_documents(id) on delete restrict,
  version_label text not null
    check (char_length(btrim(version_label)) between 1 and 40),
  content_url text not null
    check (content_url ~ '^https://'),
  content_sha256 text not null
    check (content_sha256 ~ '^[a-f0-9]{64}$'),
  requires_acceptance boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'withdrawn')),
  effective_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version_label),
  unique (id, document_id),
  check (
    (status = 'draft' and published_at is null)
    or (status in ('published', 'withdrawn') and published_at is not null)
  ),
  check (status = 'draft' or effective_at is not null)
);

create index if not exists policy_versions_current_lookup_idx
  on public.policy_versions (document_id, effective_at desc)
  where status = 'published';

create table if not exists public.policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  policy_version_id uuid not null
    references public.policy_versions(id) on delete restrict,
  accepted_at timestamptz not null default now(),
  acceptance_context text not null default 'member_confirmation'
    check (acceptance_context in ('member_confirmation')),
  unique (user_id, policy_version_id)
);

create index if not exists policy_acceptances_user_history_idx
  on public.policy_acceptances (user_id, accepted_at desc);

alter table public.policy_documents enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_acceptances enable row level security;

-- Public visitors may read only policy documents with at least one effective,
-- published version. Drafts and withdrawn-only documents remain private.
drop policy if exists policy_documents_public_published_read
  on public.policy_documents;
create policy policy_documents_public_published_read
  on public.policy_documents
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.policy_versions v
      where v.document_id = policy_documents.id
        and v.status = 'published'
        and v.effective_at <= now()
    )
  );

drop policy if exists policy_versions_public_published_read
  on public.policy_versions;
create policy policy_versions_public_published_read
  on public.policy_versions
  for select to anon, authenticated
  using (status = 'published' and effective_at <= now());

drop policy if exists policy_acceptances_read_own
  on public.policy_acceptances;
create policy policy_acceptances_read_own
  on public.policy_acceptances
  for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.policy_documents to anon, authenticated;
grant select on public.policy_versions to anon, authenticated;
grant select on public.policy_acceptances to authenticated;
revoke insert, update, delete on public.policy_documents from anon, authenticated;
revoke insert, update, delete on public.policy_versions from anon, authenticated;
revoke insert, update, delete on public.policy_acceptances from anon, authenticated;

-- The ledger is append-only, including for privileged application code.
create or replace function public.prevent_policy_acceptance_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'Policy acceptance records are append-only'
    using errcode = '55000';
end;
$function$;

drop trigger if exists policy_acceptances_no_mutation
  on public.policy_acceptances;
create trigger policy_acceptances_no_mutation
before update or delete on public.policy_acceptances
for each row execute function public.prevent_policy_acceptance_mutation();

-- A version's identity and published content cannot be rewritten. Its lifecycle
-- may move draft -> published -> withdrawn; no reverse transition is allowed.
create or replace function public.guard_policy_version_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if row(
    new.document_id, new.version_label, new.content_url,
    new.content_sha256, new.requires_acceptance, new.effective_at,
    new.created_at
  ) is distinct from row(
    old.document_id, old.version_label, old.content_url,
    old.content_sha256, old.requires_acceptance, old.effective_at,
    old.created_at
  ) then
    raise exception 'Policy version content is immutable; create a new version'
      using errcode = '55000';
  end if;

  if old.status = 'draft' and new.status = 'published' then
    if new.published_at is null then
      raise exception 'Publishing requires published_at';
    end if;
  elsif old.status = 'published' and new.status = 'withdrawn' then
    if new.published_at is distinct from old.published_at then
      raise exception 'The original publication timestamp must be retained';
    end if;
  elsif new.status is distinct from old.status
     or new.published_at is distinct from old.published_at then
    raise exception 'Invalid policy version lifecycle transition'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;

drop trigger if exists policy_versions_revision_guard
  on public.policy_versions;
create trigger policy_versions_revision_guard
before update on public.policy_versions
for each row execute function public.guard_policy_version_revision();

-- Accept the complete set of currently effective required versions in one
-- authenticated action. The caller cannot choose another member or timestamp.
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
  v_required_count integer;
  v_supplied_count integer;
  v_inserted_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_policy_version_ids is null
     or cardinality(p_policy_version_ids) = 0 then
    raise exception 'At least one current policy version is required'
      using errcode = '22023';
  end if;

  select count(*) into v_required_count
  from (
    select distinct on (d.id) v.id
    from public.policy_documents d
    join public.policy_versions v on v.document_id = d.id
    where v.status = 'published'
      and v.requires_acceptance is true
      and v.effective_at <= now()
    order by d.id, v.effective_at desc, v.published_at desc, v.id
  ) required_versions;

  select count(distinct supplied.version_id)
    into v_supplied_count
  from unnest(p_policy_version_ids) as supplied(version_id)
  join public.policy_versions v on v.id = supplied.version_id
  join public.policy_documents d on d.id = v.document_id
  where v.status = 'published'
    and v.requires_acceptance is true
    and v.effective_at <= now()
    and v.id = (
      select v2.id
      from public.policy_versions v2
      where v2.document_id = v.document_id
        and v2.status = 'published'
        and v2.requires_acceptance is true
        and v2.effective_at <= now()
      order by v2.effective_at desc, v2.published_at desc, v2.id
      limit 1
    );

  if v_supplied_count <> cardinality(p_policy_version_ids)
     or v_supplied_count <> v_required_count then
    raise exception 'Please review and accept every currently required policy version'
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

revoke all on function public.accept_current_required_policy_versions(uuid[])
  from public, anon;
grant execute on function public.accept_current_required_policy_versions(uuid[])
  to authenticated;

revoke all on function public.prevent_policy_acceptance_mutation()
  from public, anon, authenticated;
revoke all on function public.guard_policy_version_revision()
  from public, anon, authenticated;

commit;
