begin;

create table if not exists public.podcasting_livekit_sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  podcast_id uuid null references public.podcasts(id) on delete set null,
  mode text not null check (mode in ('audio','video')),
  status text not null default 'active' check (status in ('active','ended','revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz null
);

create index if not exists podcasting_livekit_sessions_owner_active_idx
  on public.podcasting_livekit_sessions(owner_user_id, status, expires_at);

create table if not exists public.podcasting_livekit_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.podcasting_livekit_sessions(id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('guest','listener')),
  invited_user_id uuid null references auth.users(id) on delete cascade,
  invited_email text null,
  max_uses integer not null default 1 check (max_uses between 1 and 10),
  uses_count integer not null default 0 check (uses_count between 0 and max_uses),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists podcasting_livekit_invitations_session_idx
  on public.podcasting_livekit_invitations(session_id, expires_at)
  where revoked_at is null;

alter table public.podcasting_livekit_sessions enable row level security;
alter table public.podcasting_livekit_invitations enable row level security;

revoke all on public.podcasting_livekit_sessions from anon, authenticated;
revoke all on public.podcasting_livekit_invitations from anon, authenticated;
grant all on public.podcasting_livekit_sessions to service_role;
grant all on public.podcasting_livekit_invitations to service_role;

create or replace function public.podcasting_livekit_redeem_invitation(
  p_token_hash text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.podcasting_livekit_invitations%rowtype;
  v_session public.podcasting_livekit_sessions%rowtype;
begin
  select i.* into v_invitation
  from public.podcasting_livekit_invitations i
  where i.token_hash = p_token_hash
  for update;

  if not found
     or v_invitation.revoked_at is not null
     or v_invitation.expires_at <= now()
     or v_invitation.uses_count >= v_invitation.max_uses then
    return null;
  end if;

  select s.* into v_session
  from public.podcasting_livekit_sessions s
  where s.id = v_invitation.session_id
    and s.status = 'active'
    and s.expires_at > now();

  if not found then
    return null;
  end if;

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

  if v_invitation.role = 'guest'
     and not exists (
       select 1 from public.podcast_guest_profiles gp
       where gp.user_id = p_user_id and gp.status = 'approved'
     ) then
    return null;
  end if;

  update public.podcasting_livekit_invitations
  set uses_count = uses_count + 1
  where id = v_invitation.id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'room_name', v_session.room_name,
    'mode', v_session.mode,
    'role', v_invitation.role
  );
end;
$$;

revoke all on function public.podcasting_livekit_redeem_invitation(text, uuid) from public, anon, authenticated;
grant execute on function public.podcasting_livekit_redeem_invitation(text, uuid) to service_role;

commit;
