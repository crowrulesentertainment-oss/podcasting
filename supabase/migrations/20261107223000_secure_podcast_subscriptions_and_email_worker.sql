-- CrowRules Podcasting security and notification worker repair.
-- Applied to Supabase project cevylpnoexugwgygvtgu on 2026-11-07.

-- Subscription rows are private billing records: only their owner or an
-- administrator may read them. Anonymous visitors must never see subscribers.
drop policy if exists podcast_subscriptions_select on public.podcast_subscriptions;
create policy podcast_subscriptions_select
on public.podcast_subscriptions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or crowrules_is_admin()
);

-- The email worker calls the public PostgREST RPC endpoint with the service
-- role. The original authorization function lives in the private schema,
-- so the old worker call to public.podcast_email_worker_authorized returned
-- 404. This wrapper is deliberately executable only by service_role.
create or replace function public.podcast_email_worker_authorized(p_secret text)
returns boolean
language sql
security definer
set search_path = pg_catalog, vault
as $function$
  select coalesce(p_secret, '') <> ''
     and exists (
       select 1
       from vault.decrypted_secrets
       where name = 'podcast_email_worker_secret'
         and decrypted_secret = p_secret
     );
$function$;

revoke all on function public.podcast_email_worker_authorized(text) from public;
revoke all on function public.podcast_email_worker_authorized(text) from anon;
revoke all on function public.podcast_email_worker_authorized(text) from authenticated;
grant execute on function public.podcast_email_worker_authorized(text) to service_role;
