-- DRAFT ONLY — DO NOT APPLY TO PRODUCTION.
-- CrowRules Groups social features: reply access and member directory RLS.
-- Prerequisite: reconcile migration history, replay locally, and review this patch.
-- This patch intentionally changes only the two identified reply policies and
-- adds a member-roster SELECT policy. It does not disable RLS or replace unrelated policies.

begin;

-- Replace the existing permissive INSERT policy whose circle comparisons are
-- tautologies (m.circle_id = m.circle_id and p.circle_id = p.circle_id).
drop policy if exists "Circle members can reply" on public.podcast_community_circle_replies;
create policy "Circle members can reply"
on public.podcast_community_circle_replies
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and private.crowspace_is_circle_member(circle_id)
  and exists (
    select 1
    from public.podcast_community_circle_posts p
    where p.id = podcast_community_circle_replies.post_id
      and p.circle_id = podcast_community_circle_replies.circle_id
  )
);

-- Replace the SELECT policy whose parent-circle comparison was also tautological.
-- The parent post's own RLS policy remains responsible for public/member visibility.
drop policy if exists "Replies visible wherever the parent post is visible"
on public.podcast_community_circle_replies;
create policy "Replies visible wherever the parent post is visible"
on public.podcast_community_circle_replies
for select
to authenticated
using (
  exists (
    select 1
    from public.podcast_community_circle_posts p
    where p.id = podcast_community_circle_replies.post_id
      and p.circle_id = podcast_community_circle_replies.circle_id
  )
);

-- Allow a member to view the roster of the same circle they belong to.
-- Keep own-membership, owner, moderator, and admin policies intact.
create policy "Circle members can view their circle roster"
on public.podcast_community_circle_members
for select
to authenticated
using (
  private.crowspace_is_circle_member(circle_id)
  or private.crowspace_is_circle_owner(circle_id)
  or private.crowrules_is_admin_impl()
);

commit;

-- Before promoting this draft to a timestamped migration, verify:
-- 1) These helper functions exist and are executable by authenticated users.
-- 2) Existing reply rows have matching parent post circle_id values:
--    select r.id, r.circle_id, p.circle_id as post_circle_id
--    from public.podcast_community_circle_replies r
--    left join public.podcast_community_circle_posts p on p.id = r.post_id
--    where p.id is null or p.circle_id <> r.circle_id;
-- 3) No duplicate policy names or unexpected policy variants exist on target.
-- 4) Cross-circle read/write tests pass for at least two independent circles.
