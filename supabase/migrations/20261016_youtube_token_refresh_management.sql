-- Distribution Upgrade 3: server-only token refresh and connection status management.
create or replace function public.distribution_oauth_get_youtube_token(p_account_id uuid, p_user_id uuid)
returns table(access_token_ciphertext text, refresh_token_ciphertext text, expires_at timestamptz, encryption_key_version integer, connection_status text)
language sql security definer
set search_path = pg_catalog, private, public
as $$
  select t.access_token_ciphertext, t.refresh_token_ciphertext, t.expires_at,
         t.encryption_key_version, a.connection_status
  from private.podcast_distribution_tokens t
  join public.podcast_distribution_accounts a on a.id=t.account_id
  where t.account_id=p_account_id and a.user_id=p_user_id and a.platform='youtube'
  limit 1;
$$;

create or replace function public.distribution_oauth_update_youtube_token(
  p_account_id uuid, p_user_id uuid, p_access_token_ciphertext text,
  p_refresh_token_ciphertext text, p_expires_at timestamptz, p_token_type text, p_scopes text[]
) returns void
language plpgsql security definer
set search_path = pg_catalog, private, public
as $$
begin
  update private.podcast_distribution_tokens t
     set access_token_ciphertext=p_access_token_ciphertext,
         refresh_token_ciphertext=coalesce(p_refresh_token_ciphertext,t.refresh_token_ciphertext),
         expires_at=p_expires_at, token_type=coalesce(nullif(p_token_type,''),t.token_type),
         scopes=coalesce(p_scopes,t.scopes), updated_at=now()
    from public.podcast_distribution_accounts a
   where t.account_id=p_account_id and a.id=t.account_id
     and a.user_id=p_user_id and a.platform='youtube';
  if not found then raise exception 'YouTube token record not found for this user'; end if;
end; $$;

create or replace function public.distribution_oauth_set_youtube_status(
  p_account_id uuid, p_user_id uuid, p_status text
) returns void
language plpgsql security definer
set search_path = pg_catalog, private, public
as $$
begin
  if p_status not in ('connected','expired','needs_review','not_connected') then
    raise exception 'Invalid YouTube connection status';
  end if;
  update public.podcast_distribution_accounts
     set connection_status=p_status, updated_at=now()
   where id=p_account_id and user_id=p_user_id and platform='youtube';
  if not found then raise exception 'YouTube account record not found for this user'; end if;
end; $$;

revoke all on function public.distribution_oauth_get_youtube_token(uuid,uuid) from public, anon, authenticated;
revoke all on function public.distribution_oauth_update_youtube_token(uuid,uuid,text,text,timestamptz,text,text[]) from public, anon, authenticated;
revoke all on function public.distribution_oauth_set_youtube_status(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.distribution_oauth_get_youtube_token(uuid,uuid) to service_role;
grant execute on function public.distribution_oauth_update_youtube_token(uuid,uuid,text,text,timestamptz,text,text[]) to service_role;
grant execute on function public.distribution_oauth_set_youtube_status(uuid,uuid,text) to service_role;
