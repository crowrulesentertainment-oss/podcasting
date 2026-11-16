-- Support Supabase JWT claim formats used by PostgREST service-role clients.
create or replace function public.podcasting_security_worker_token_valid(p_token text)
returns boolean language sql security definer set search_path='' as $$
 select coalesce(current_setting('request.jwt.claim.role',true),
                 (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'),'')='service_role'
   and length(coalesce(p_token,''))>=24
   and exists(select 1 from vault.decrypted_secrets where name='podcast_email_worker_secret' and decrypted_secret=p_token)
$$;
revoke all on function public.podcasting_security_worker_token_valid(text) from public,anon,authenticated;
grant execute on function public.podcasting_security_worker_token_valid(text) to service_role;
