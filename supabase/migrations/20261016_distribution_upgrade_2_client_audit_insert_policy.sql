-- Permit only creator-originated audit events; provider/worker outcomes remain service-role only.
drop policy if exists "Creators append own distribution audit events" on public.podcast_distribution_delivery_logs;
create policy "Creators append own distribution audit events"
on public.podcast_distribution_delivery_logs
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and event_type in ('draft_saved','approved','queued','cancelled','connection_started','connection_updated')
  and exists (
    select 1 from public.podcast_distribution_posts p
    where p.id = post_id and p.user_id = (select auth.uid()) and p.platform = platform
  )
);
grant insert on public.podcast_distribution_delivery_logs to authenticated;
