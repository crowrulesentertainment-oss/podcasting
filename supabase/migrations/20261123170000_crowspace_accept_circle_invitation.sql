-- Groups 2.0: atomically accept an invitation and create membership.
-- Additive only. This migration is a review draft and has not been applied to production.

create or replace function private.crowspace_accept_circle_invite_impl(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_invite public.podcast_community_circle_invites%rowtype;
  v_circle public.podcast_community_circles%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
    into v_invite
    from public.podcast_community_circle_invites
   where id = p_invite_id
     and invitee_id = v_user_id
     and status = 'pending'
   for update;

  if not found then
    raise exception 'Invitation is invalid, unavailable, or already answered'
      using errcode = 'P0001';
  end if;

  select *
    into v_circle
    from public.podcast_community_circles
   where id = v_invite.circle_id;

  if not found then
    raise exception 'The group no longer exists' using errcode = 'P0001';
  end if;

  -- Invitation acceptance is the authorized path into a non-public group.
  -- Never accept a caller-supplied member ID or role.
  insert into public.podcast_community_circle_members (circle_id, member_id, role)
  values (v_invite.circle_id, v_user_id, 'member')
  on conflict (circle_id, member_id) do nothing;

  update public.podcast_community_circle_invites
     set status = 'accepted',
         responded_at = now()
   where id = v_invite.id
     and invitee_id = v_user_id
     and status = 'pending';

  if not found then
    raise exception 'Invitation could not be accepted' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'invite_id', v_invite.id,
    'circle_id', v_invite.circle_id,
    'membership_status', 'active',
    'invitation_status', 'accepted'
  );
end;
$function$;

revoke all on function private.crowspace_accept_circle_invite_impl(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.crowspace_accept_circle_invite_impl(uuid) to authenticated;

create or replace function public.crowspace_accept_circle_invite(p_invite_id uuid)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public
as $function$
  select private.crowspace_accept_circle_invite_impl(p_invite_id);
$function$;

revoke all on function public.crowspace_accept_circle_invite(uuid) from public;
revoke all on function public.crowspace_accept_circle_invite(uuid) from anon;
grant execute on function public.crowspace_accept_circle_invite(uuid) to authenticated;

comment on function public.crowspace_accept_circle_invite(uuid) is
  'Atomically accepts an invitation addressed to auth.uid() and creates member access, including for non-public circles.';


-- Public media is visible only when stored beneath the UUID folder of a public circle.
-- The previous policy used the circle text name instead of the Storage object path.
drop policy if exists "Public group media is viewable" on storage.objects;

create policy "Public group media is viewable"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'podcast-group-media'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.podcast_community_circles c
    where c.id = ((storage.foldername(objects.name))[1])::uuid
      and c.is_public = true
  )
);
