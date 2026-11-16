-- CrowRules Podcasting Reviews Phase 4: reviewer recognition and rewards
insert into public.podcast_review_badge_catalog (badge_key,name,description,icon,is_active)
values ('first_review','First Review','Published your first listener review on CrowRules Podcasting.','✍️',true),('community_voice','Community Voice','Published five or more thoughtful listener reviews.','🎙️',true),('top_reviewer','Top Reviewer','Your published reviews have received ten or more helpful votes.','🏆',true)
on conflict (badge_key) do update set name=excluded.name,description=excluded.description,icon=excluded.icon,is_active=true;
create unique index if not exists podcast_review_badge_awards_badge_user_uidx on public.podcast_review_badge_awards (badge_key,user_id);
create index if not exists podcast_reviews_featured_created_idx on public.podcast_reviews (featured_at desc,created_at desc) where status='published' and featured_at is not null;
create index if not exists podcast_episode_reviews_featured_created_idx on public.podcast_episode_reviews (featured_at desc,created_at desc) where status='published' and featured_at is not null;
create or replace function private.award_podcast_reviewer_badges(p_user_id uuid,p_review_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare v_review_count bigint; v_helpful_count bigint;
begin
 if p_user_id is null then return; end if;
 select (select count(*) from public.podcast_reviews r where r.user_id=p_user_id and r.status='published')+(select count(*) from public.podcast_episode_reviews r where r.user_id=p_user_id and r.status='published') into v_review_count;
 select (select count(*) from public.podcast_review_votes v join public.podcast_reviews r on r.id=v.review_id where r.user_id=p_user_id and r.status='published')+(select count(*) from public.podcast_episode_review_votes v join public.podcast_episode_reviews r on r.id=v.review_id where r.user_id=p_user_id and r.status='published') into v_helpful_count;
 if v_review_count>=1 then insert into public.podcast_review_badge_awards(badge_key,user_id,review_id,note,is_public) values('first_review',p_user_id,p_review_id,'Automatically earned for publishing a first review.',true) on conflict(badge_key,user_id) do nothing; end if;
 if v_review_count>=5 then insert into public.podcast_review_badge_awards(badge_key,user_id,review_id,note,is_public) values('community_voice',p_user_id,p_review_id,'Automatically earned after five published reviews.',true) on conflict(badge_key,user_id) do nothing; end if;
 if v_helpful_count>=10 then insert into public.podcast_review_badge_awards(badge_key,user_id,review_id,note,is_public) values('top_reviewer',p_user_id,p_review_id,'Automatically earned after receiving ten helpful votes.',true) on conflict(badge_key,user_id) do nothing; end if;
end; $$;
create or replace function private.award_podcast_reviewer_badge_on_review() returns trigger language plpgsql security definer set search_path='' as $$ begin if new.status='published' then perform private.award_podcast_reviewer_badges(new.user_id,new.id); end if; return new; end; $$;
create or replace function private.award_podcast_reviewer_badge_on_show_vote() returns trigger language plpgsql security definer set search_path='' as $$ declare v_user_id uuid; begin select r.user_id into v_user_id from public.podcast_reviews r where r.id=new.review_id and r.status='published'; if v_user_id is not null then perform private.award_podcast_reviewer_badges(v_user_id,new.review_id); end if; return new; end; $$;
create or replace function private.award_podcast_reviewer_badge_on_episode_vote() returns trigger language plpgsql security definer set search_path='' as $$ declare v_user_id uuid; begin select r.user_id into v_user_id from public.podcast_episode_reviews r where r.id=new.review_id and r.status='published'; if v_user_id is not null then perform private.award_podcast_reviewer_badges(v_user_id,new.review_id); end if; return new; end; $$;
revoke all on function private.award_podcast_reviewer_badges(uuid,uuid) from public,anon,authenticated;
revoke all on function private.award_podcast_reviewer_badge_on_review() from public,anon,authenticated;
revoke all on function private.award_podcast_reviewer_badge_on_show_vote() from public,anon,authenticated;
revoke all on function private.award_podcast_reviewer_badge_on_episode_vote() from public,anon,authenticated;
drop trigger if exists podcast_review_badges_after_review on public.podcast_reviews;
create trigger podcast_review_badges_after_review after insert or update of status on public.podcast_reviews for each row execute function private.award_podcast_reviewer_badge_on_review();
drop trigger if exists podcast_episode_review_badges_after_review on public.podcast_episode_reviews;
create trigger podcast_episode_review_badges_after_review after insert or update of status on public.podcast_episode_reviews for each row execute function private.award_podcast_reviewer_badge_on_review();
drop trigger if exists podcast_review_badges_after_vote on public.podcast_review_votes;
create trigger podcast_review_badges_after_vote after insert on public.podcast_review_votes for each row execute function private.award_podcast_reviewer_badge_on_show_vote();
drop trigger if exists podcast_episode_review_badges_after_vote on public.podcast_episode_review_votes;
create trigger podcast_episode_review_badges_after_vote after insert on public.podcast_episode_review_votes for each row execute function private.award_podcast_reviewer_badge_on_episode_vote();
do $$ declare r record; begin for r in select user_id from (select user_id from public.podcast_reviews where status='published' union select user_id from public.podcast_episode_reviews where status='published') reviewers loop perform private.award_podcast_reviewer_badges(r.user_id,null); end loop; end; $$;
create or replace function public.get_podcast_monthly_reviewer_leaderboard(p_month date default date_trunc('month',now())::date)
returns table(username text,display_name text,avatar_url text,review_count bigint,helpful_votes bigint,leaderboard_rank bigint)
language sql stable security definer set search_path='' as $$
 with bounds as (select date_trunc('month',coalesce(p_month,current_date)::timestamp)::timestamptz start_at,(date_trunc('month',coalesce(p_month,current_date)::timestamp)+interval '1 month')::timestamptz end_at),
 reviews as (
  select r.id,r.user_id,'show'::text review_type from public.podcast_reviews r,bounds b where r.status='published' and r.created_at>=b.start_at and r.created_at<b.end_at
  union all select r.id,r.user_id,'episode'::text from public.podcast_episode_reviews r,bounds b where r.status='published' and r.created_at>=b.start_at and r.created_at<b.end_at
 ),
 helpful as (select r.user_id,
  (select count(*) from public.podcast_review_votes v join reviews x on x.id=v.review_id and x.review_type='show' where x.user_id=r.user_id and v.created_at>=(select start_at from bounds) and v.created_at<(select end_at from bounds))+
  (select count(*) from public.podcast_episode_review_votes v join reviews x on x.id=v.review_id and x.review_type='episode' where x.user_id=r.user_id and v.created_at>=(select start_at from bounds) and v.created_at<(select end_at from bounds)) votes
  from reviews r group by r.user_id),
 totals as (select r.user_id,count(*)::bigint reviews,coalesce(h.votes,0)::bigint helpful from reviews r left join helpful h on h.user_id=r.user_id group by r.user_id,h.votes)
 select p.username,coalesce(nullif(p.display_name,''),nullif(concat_ws(' ',p.first_name,p.last_name),''),p.username),p.avatar_url,t.reviews,t.helpful,row_number() over(order by t.helpful desc,t.reviews desc,p.username asc)
 from totals t join public.crowrules_public_profiles p on p.user_id=t.user_id where p.username is not null order by t.helpful desc,t.reviews desc,p.username asc limit 50;
$$;
revoke all on function public.get_podcast_monthly_reviewer_leaderboard(date) from public;
grant execute on function public.get_podcast_monthly_reviewer_leaderboard(date) to anon,authenticated;
