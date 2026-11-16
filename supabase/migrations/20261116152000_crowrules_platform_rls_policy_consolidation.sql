-- Consolidate platform-review RLS policies to avoid overlapping permissive policies.
-- Admin authorization is folded into each relevant command policy.

drop policy if exists "Admins manage platform reviews" on public.podcast_platform_reviews;
drop policy if exists "Public read published platform reviews" on public.podcast_platform_reviews;
drop policy if exists "Members read own platform reviews" on public.podcast_platform_reviews;
create policy "Read published own or admin platform reviews"
 on public.podcast_platform_reviews for select to anon,authenticated
 using (
  status='published'
  or (select auth.uid())=user_id
  or ((select auth.uid()) is not null and private.crowrules_is_admin_impl())
 );
drop policy if exists "Members create own platform review" on public.podcast_platform_reviews;
create policy "Members or admins create platform reviews"
 on public.podcast_platform_reviews for insert to authenticated
 with check (
  ((select auth.uid())=user_id and status='published')
  or private.crowrules_is_admin_impl()
 );
drop policy if exists "Members update own published platform review" on public.podcast_platform_reviews;
create policy "Members or admins update platform reviews"
 on public.podcast_platform_reviews for update to authenticated
 using (
  ((select auth.uid())=user_id and status='published')
  or private.crowrules_is_admin_impl()
 )
 with check (
  ((select auth.uid())=user_id and status='published')
  or private.crowrules_is_admin_impl()
 );
drop policy if exists "Members delete own platform review" on public.podcast_platform_reviews;
create policy "Members or admins delete platform reviews"
 on public.podcast_platform_reviews for delete to authenticated
 using ((select auth.uid())=user_id or private.crowrules_is_admin_impl());

drop policy if exists "Admins manage platform review replies" on public.podcast_platform_review_replies;
drop policy if exists "Public read published platform review replies" on public.podcast_platform_review_replies;
create policy "Read published or admin platform review replies"
 on public.podcast_platform_review_replies for select to anon,authenticated
 using (status='published' or ((select auth.uid()) is not null and private.crowrules_is_admin_impl()));
create policy "Admins insert platform review replies"
 on public.podcast_platform_review_replies for insert to authenticated
 with check (private.crowrules_is_admin_impl());
create policy "Admins update platform review replies"
 on public.podcast_platform_review_replies for update to authenticated
 using (private.crowrules_is_admin_impl())
 with check (private.crowrules_is_admin_impl());
create policy "Admins delete platform review replies"
 on public.podcast_platform_review_replies for delete to authenticated
 using (private.crowrules_is_admin_impl());

drop policy if exists "Admins manage platform review reports" on public.podcast_platform_review_reports;
drop policy if exists "Members read own platform review reports" on public.podcast_platform_review_reports;
create policy "Members or admins read platform review reports"
 on public.podcast_platform_review_reports for select to authenticated
 using ((select auth.uid())=reporter_user_id or private.crowrules_is_admin_impl());
drop policy if exists "Members submit platform review reports" on public.podcast_platform_review_reports;
create policy "Members or admins submit platform review reports"
 on public.podcast_platform_review_reports for insert to authenticated
 with check (
  (
   (select auth.uid())=reporter_user_id
   and exists(select 1 from public.podcast_platform_reviews r where r.id=review_id and r.status='published' and r.user_id<>(select auth.uid()))
  )
  or private.crowrules_is_admin_impl()
 );
create policy "Admins update platform review reports"
 on public.podcast_platform_review_reports for update to authenticated
 using (private.crowrules_is_admin_impl())
 with check (private.crowrules_is_admin_impl());
create policy "Admins delete platform review reports"
 on public.podcast_platform_review_reports for delete to authenticated
 using (private.crowrules_is_admin_impl());

drop policy if exists "Admins manage platform feedback" on public.podcast_platform_feedback;
drop policy if exists "Members read own platform feedback" on public.podcast_platform_feedback;
create policy "Members or admins read platform feedback"
 on public.podcast_platform_feedback for select to authenticated
 using ((select auth.uid())=user_id or private.crowrules_is_admin_impl());
drop policy if exists "Members submit platform feedback" on public.podcast_platform_feedback;
create policy "Members or admins submit platform feedback"
 on public.podcast_platform_feedback for insert to authenticated
 with check (
  (
   (select auth.uid())=user_id and status='new'
   and admin_response is null and resolved_at is null
  )
  or private.crowrules_is_admin_impl()
 );
create policy "Admins update platform feedback"
 on public.podcast_platform_feedback for update to authenticated
 using (private.crowrules_is_admin_impl())
 with check (private.crowrules_is_admin_impl());
create policy "Admins delete platform feedback"
 on public.podcast_platform_feedback for delete to authenticated
 using (private.crowrules_is_admin_impl());

drop policy if exists "Admins manage monthly platform feedback reports" on public.podcast_platform_feedback_monthly_reports;
create policy "Admins insert monthly platform feedback reports"
 on public.podcast_platform_feedback_monthly_reports for insert to authenticated
 with check (private.crowrules_is_admin_impl());
create policy "Admins update monthly platform feedback reports"
 on public.podcast_platform_feedback_monthly_reports for update to authenticated
 using (private.crowrules_is_admin_impl())
 with check (private.crowrules_is_admin_impl());
create policy "Admins delete monthly platform feedback reports"
 on public.podcast_platform_feedback_monthly_reports for delete to authenticated
 using (private.crowrules_is_admin_impl());
