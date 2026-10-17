-- YouTube OAuth connection support. OAuth state and tokens remain in the private schema.
create or replace function public.distribution_oauth_store_state(
  p_state_hash text, p_user_id uuid, p_podcast_id uuid, p_platform text,
  p_code_verifier text, p_redirect_uri text, p_provider_state text
) returns void
language plpgsql security definer
set search_path = pg_catalog, private, public
as $$
begin
  if p_platform <> 'youtube' then raise exception 'Unsupported OAuth platform'; end if;
  delete from private.podcast_distribution_oauth_states where expires_at < now();
  insert into private.podcast_distribution_oauth_states
    (state_hash,user_id,podcast_id,platform,created_at,expires_at,code_verifier,redirect_uri,provider_state)
  values (p_state_hash,p_user_id,p_podcast_id,p_platform,now(),now()+interval '10 minutes',p_code_verifier,p_redirect_uri,p_provider_state);
end; $$;

create or replace function public.distribution_oauth_consume_state(p_state_hash text)
returns table(user_id uuid,podcast_id uuid,platform text,code_verifier text,redirect_uri text,provider_state text)
language plpgsql security definer
set search_path = pg_catalog, private, public
as $$
begin
  return query
  delete from private.podcast_distribution_oauth_states s
  where s.state_hash=p_state_hash and s.expires_at > now()
  returning s.user_id,s.podcast_id,s.platform,s.code_verifier,s.redirect_uri,s.provider_state;
end; $$;

create or replace function public.distribution_oauth_store_youtube_token(
  p_account_id uuid, p_access_token_ciphertext text, p_refresh_token_ciphertext text,
  p_token_type text, p_scopes text[], p_expires_at timestamptz,
  p_provider_account_id text, p_account_label text, p_profile_url text
) returns void
language plpgsql security definer
set search_path = pg_catalog, private, public
as $$
begin
  update public.podcast_distribution_accounts
     set connection_status='connected', connection_method='oauth',
         account_label=p_account_label, profile_url=p_profile_url, updated_at=now()
   where id=p_account_id and platform='youtube';
  if not found then raise exception 'YouTube account record not found'; end if;

  insert into private.podcast_distribution_tokens
    (account_id,access_token_ciphertext,refresh_token_ciphertext,token_type,scopes,expires_at,provider_account_id,encryption_key_version,updated_at)
  values (p_account_id,p_access_token_ciphertext,p_refresh_token_ciphertext,p_token_type,p_scopes,p_expires_at,p_provider_account_id,1,now())
  on conflict (account_id) do update set
    access_token_ciphertext=excluded.access_token_ciphertext,
    refresh_token_ciphertext=coalesce(excluded.refresh_token_ciphertext,private.podcast_distribution_tokens.refresh_token_ciphertext),
    token_type=excluded.token_type, scopes=excluded.scopes, expires_at=excluded.expires_at,
    provider_account_id=excluded.provider_account_id,encryption_key_version=1,updated_at=now();
end; $$;

revoke all on function public.distribution_oauth_store_state(text,uuid,uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.distribution_oauth_consume_state(text) from public, anon, authenticated;
revoke all on function public.distribution_oauth_store_youtube_token(uuid,text,text,text,text[],timestamptz,text,text,text) from public, anon, authenticated;
grant execute on function public.distribution_oauth_store_state(text,uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.distribution_oauth_consume_state(text) to service_role;
grant execute on function public.distribution_oauth_store_youtube_token(uuid,text,text,text,text[],timestamptz,text,text,text) to service_role;
