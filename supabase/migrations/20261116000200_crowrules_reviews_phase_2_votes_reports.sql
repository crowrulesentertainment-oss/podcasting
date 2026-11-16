-- CrowRules Reviews Phase 2: helpful votes and member review reports.
create or replace function public.podcast_review_vote_summary(p_review_ids uuid[])
returns table(review_id uuid, helpful_count bigint, viewer_voted boolean)
language sql stable security definer set search_path = ''
as $$
 select r.id,count(v.id)::bigint,
        coalesce(bool_or(v.user_id=(select auth.uid())),false)
 from public.podcast_reviews r
 left join public.podcast_review_votes v on v.review_id=r.id
 where r.id=any(coalesce(p_review_ids,array[]::uuid[])) and r.status='published'
 group by r.id
$$;
create or replace function public.podcast_toggle_review_helpful(p_review_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid());
declare deleted_count integer;
begin
 if current_user_id is null then raise exception 'Sign in to vote on reviews.' using errcode='42501'; end if;
 if not exists(select 1 from public.podcast_reviews r where r.id=p_review_id and r.status='published') then
  raise exception 'This review is not available for voting.' using errcode='22023';
 end if;
 delete from public.podcast_review_votes where review_id=p_review_id and user_id=current_user_id;
 get diagnostics deleted_count=row_count;
 if deleted_count>0 then return false; end if;
 insert into public.podcast_review_votes(review_id,user_id) values(p_review_id,current_user_id)
 on conflict(review_id,user_id) do nothing;
 return true;
end;
$$;
revoke all on function public.podcast_review_vote_summary(uuid[]) from public;
grant execute on function public.podcast_review_vote_summary(uuid[]) to anon,authenticated;
revoke all on function public.podcast_toggle_review_helpful(uuid) from public,anon;
grant execute on function public.podcast_toggle_review_helpful(uuid) to authenticated;

drop policy if exists "Members submit show review reports" on public.podcast_review_reports;
create policy "Members submit show review reports" on public.podcast_review_reports
for insert to authenticated with check (
 (select auth.uid())=reporter_user_id and exists(
  select 1 from public.podcast_reviews r where r.id=review_id and r.status='published'
 )
);
