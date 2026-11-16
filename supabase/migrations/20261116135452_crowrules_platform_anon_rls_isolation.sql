-- Keep private admin-check helpers out of anonymous query plans.
drop policy if exists "Read published own or admin platform reviews" on public.podcast_platform_reviews;
create policy "Public read published platform reviews"
 on public.podcast_platform_reviews for select to anon
 using (status='published');
create policy "Members read published own or admin platform reviews"
 on public.podcast_platform_reviews for select to authenticated
 using (
  status='published'
  or (select auth.uid())=user_id
  or private.crowrules_is_admin_impl()
 );

drop policy if exists "Read published or admin platform review replies" on public.podcast_platform_review_replies;
create policy "Public read published platform review replies"
 on public.podcast_platform_review_replies for select to anon
 using (status='published');
create policy "Members read published or admin platform review replies"
 on public.podcast_platform_review_replies for select to authenticated
 using (status='published' or private.crowrules_is_admin_impl());
