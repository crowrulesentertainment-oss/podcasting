begin;

create table if not exists public.crowspace_live_room_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.crowspace_live_rooms(id) on delete cascade,
  room_name text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('audio','video')),
  status text not null default 'active' check (status in ('active','ended','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists crowspace_live_room_one_active_session_idx
  on public.crowspace_live_room_sessions(room_id)
  where status = 'active';

create index if not exists crowspace_live_room_sessions_owner_idx
  on public.crowspace_live_room_sessions(owner_user_id,status,expires_at);

create table if not exists public.crowspace_live_room_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.crowspace_live_room_sessions(id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('guest','listener')),
  invited_user_id uuid references auth.users(id) on delete cascade,
  invited_email text,
  max_uses integer not null default 1 check (max_uses between 1 and 10),
  uses_count integer not null default 0 check (uses_count between 0 and max_uses),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (invited_user_id is not null or invited_email is null or length(trim(invited_email)) > 3)
);

create index if not exists crowspace_live_room_invites_session_idx
  on public.crowspace_live_room_invitations(session_id,expires_at)
  where revoked_at is null;

alter table public.crowspace_live_room_sessions enable row level security;
alter table public.crowspace_live_room_invitations enable row level security;
revoke all on public.crowspace_live_room_sessions from anon, authenticated;
revoke all on public.crowspace_live_room_invitations from anon, authenticated;
grant all on public.crowspace_live_room_sessions to service_role;
grant all on public.crowspace_live_room_invitations to service_role;

create or replace function public.crowspace_livekit_redeem_room_invitation(
  p_token_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.crowspace_live_room_invitations%rowtype;
  v_session public.crowspace_live_room_sessions%rowtype;
  v_room public.crowspace_live_rooms%rowtype;
begin
  if p_user_id is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select i.* into v_invitation
    from public.crowspace_live_room_invitations i
   where i.token_hash = p_token_hash
   for update;

  if not found
     or v_invitation.revoked_at is not null
     or v_invitation.expires_at <= now()
     or v_invitation.uses_count >= v_invitation.max_uses then
    return null;
  end if;

  select s.* into v_session
    from public.crowspace_live_room_sessions s
   where s.id = v_invitation.session_id
     and s.status = 'active'
     and s.expires_at > now();

  if not found then return null; end if;

  select r.* into v_room
    from public.crowspace_live_rooms r
   where r.id = v_session.room_id
     and r.status = 'live';

  if not found then return null; end if;

  if v_invitation.invited_user_id is not null
     and v_invitation.invited_user_id <> p_user_id then
    return null;
  end if;

  if v_invitation.invited_email is not null
     and lower(v_invitation.invited_email) <> lower(coalesce(
       (select u.email from auth.users u where u.id = p_user_id), ''
     )) then
    return null;
  end if;

  update public.crowspace_live_room_invitations
     set uses_count = uses_count + 1
   where id = v_invitation.id;

  return jsonb_build_object(
    'session_id',v_session.id,
    'room_id',v_session.room_id,
    'room_name',v_session.room_name,
    'mode',v_session.mode,
    'role',v_invitation.role
  );
end;
$function$;

revoke all on function public.crowspace_livekit_redeem_room_invitation(text,uuid) from public,anon,authenticated;
grant execute on function public.crowspace_livekit_redeem_room_invitation(text,uuid) to service_role;

commit;
