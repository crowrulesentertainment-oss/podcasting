-- CrowRules Podcasting: Security & Administrator Audit Logs 15.0.2
-- Extends the existing append-only audit table; does not replace or delete records.

create index if not exists cr_podcast_admin_audit_created_at_idx
  on public.cr_podcast_admin_audit (created_at desc);
create index if not exists cr_podcast_admin_audit_actor_created_idx
  on public.cr_podcast_admin_audit (admin_user_id, created_at desc);
create index if not exists cr_podcast_admin_audit_action_created_idx
  on public.cr_podcast_admin_audit (action, created_at desc);

comment on table public.cr_podcast_admin_audit is
  'Append-only administrator activity audit trail. Writes are performed by trusted database functions and audited-table triggers.';

create or replace function private.cr_podcast_admin_audit_capture()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_id_text text;
  v_entity_id uuid;
  v_changed jsonb;
  v_allowed text[] := array[
    'status','role','is_active','is_featured','is_published','is_live',
    'production_stage','verification_status','severity','service',
    'priority','featured_at','resolved_at','published_at','scheduled_at',
    'is_public','visibility','sort_order'
  ];
begin
  if v_actor is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select coalesce(jsonb_object_agg(k, jsonb_build_object(
      'before', v_old -> k,
      'after', v_new -> k
    )), '{}'::jsonb)
    into v_changed
  from jsonb_object_keys(v_old || v_new) as keys(k)
  where k = any(v_allowed)
    and (v_old -> k) is distinct from (v_new -> k);

  v_id_text := coalesce(v_new ->> 'id', v_old ->> 'id');
  if v_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_entity_id := v_id_text::uuid;
  else
    v_entity_id := null;
  end if;

  insert into public.cr_podcast_admin_audit
    (admin_user_id, action, entity_type, entity_id, details)
  values
    (v_actor,
     'database.' || lower(tg_op) || '.' || tg_table_name,
     tg_table_name,
     v_entity_id,
     jsonb_build_object(
       'operation', tg_op,
       'changed_fields', coalesce(v_changed, '{}'::jsonb),
       'record_id', v_id_text
     ));

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

revoke all on function private.cr_podcast_admin_audit_capture() from public, anon, authenticated;

create or replace function public.podcasting_admin_audit_list(
  p_limit integer default 100,
  p_offset integer default 0,
  p_action text default null,
  p_actor uuid default null
)
returns table (
  id uuid,
  admin_user_id uuid,
  admin_email text,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(private.crowrules_is_admin_impl(), false) then
    raise exception 'ADMIN_AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
  select a.id, a.admin_user_id, coalesce(u.email, 'Unknown administrator'),
         a.action, a.entity_type, a.entity_id, a.details, a.created_at
  from public.cr_podcast_admin_audit a
  left join auth.users u on u.id = a.admin_user_id
  where (p_action is null or a.action ilike '%' || left(p_action, 100) || '%')
    and (p_actor is null or a.admin_user_id = p_actor)
  order by a.created_at desc, a.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 200))
  offset greatest(0, least(coalesce(p_offset, 0), 100000));
end;
$$;

revoke all on function public.podcasting_admin_audit_list(integer, integer, text, uuid) from public, anon;
grant execute on function public.podcasting_admin_audit_list(integer, integer, text, uuid) to authenticated;

-- The audit table is read through the security-definer listing function only.
-- No browser role can insert, update, or delete audit rows directly.
revoke all on table public.cr_podcast_admin_audit from anon, authenticated;

-- Capture administrator-originated changes at the database boundary so
-- actions are recorded even when they originate outside the Command Center.
do $$
declare
  v_table text;
  v_tables text[] := array[
    'podcast_health_incidents',
    'podcast_platform_feedback',
    'podcast_platform_reviews',
    'podcast_development_roadmap',
    'podcast_episodes',
    'podcasts',
    'members',
    'creators',
    'podcast_media_uploads',
    'podcast_media_processing_jobs',
    'podcast_member_reports'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists cr_admin_audit_capture on public.%I', v_table);
      execute format(
        'create trigger cr_admin_audit_capture after insert or update or delete on public.%I for each row execute function private.cr_podcast_admin_audit_capture()',
        v_table
      );
    end if;
  end loop;
end;
$$;
