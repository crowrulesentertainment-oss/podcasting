begin;

-- Atomically accept a group invitation and create membership.
-- The invitee identity is always derived from auth.uid(); callers cannot
-- accept invitations on behalf of another account.
create or replace function public.crowspace_accept_circle_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.podcast_community_circle_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  select i.*
    into v_invitation
    from public.podcast_community_circle_invites as i
   where i.id = p_invite_id
     and i.invitee_id = v_user_id
     and i.status = 'pending'
   for update;

  if not found then
    raise exception 'Invitation is not available to this account'
      using errcode = 'P0002';
  end if;

  insert into public.podcast_community_circle_members
    (circle_id, member_id, role)
  values
    (v_invitation.circle_id, v_user_id, 'member')
  on conflict (circle_id, member_id) do nothing;

  update public.podcast_community_circle_invites
     set status = 'accepted',
         responded_at = now()
   where id = v_invitation.id
     and invitee_id = v_user_id
     and status = 'pending';

  return jsonb_build_object(
    'circle_id', v_invitation.circle_id,
    'status', 'accepted'
  );
end;
$function$;

revoke all on function public.crowspace_accept_circle_invite(uuid)
  from public, anon;
grant execute on function public.crowspace_accept_circle_invite(uuid)
  to authenticated;

commit;
