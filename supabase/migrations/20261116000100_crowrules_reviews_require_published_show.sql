-- Restrict new and edited show reviews to shows that are currently published.
drop policy if exists "Members can submit published podcast reviews" on public.podcast_reviews;
create policy "Members can submit published podcast reviews"
on public.podcast_reviews for insert to authenticated
with check (
 (select auth.uid())=user_id and status='published'
 and title is not null and char_length(trim(title)) between 1 and 120
 and body is not null and char_length(trim(body)) between 1 and 3000
 and exists(select 1 from public.podcasts p where p.id=podcast_id and p.status='published')
);
drop policy if exists "Members can update their own published podcast reviews" on public.podcast_reviews;
create policy "Members can update their own published podcast reviews"
on public.podcast_reviews for update to authenticated
using ((select auth.uid())=user_id and status='published')
with check (
 (select auth.uid())=user_id and status='published'
 and title is not null and char_length(trim(title)) between 1 and 120
 and body is not null and char_length(trim(body)) between 1 and 3000
 and exists(select 1 from public.podcasts p where p.id=podcast_id and p.status='published')
);