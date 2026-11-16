-- CrowRules Podcasting Reviews: Platform Reviews and Monthly Feedback Reporting
-- Additive Phase 5 extension. Existing show and episode review tables remain unchanged.

create table if not exists public.podcast_platform_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experience_type text not null default 'listener'
    check (experience_type in ('listener','creator','both')),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  ease_of_use_rating smallint check (ease_of_use_rating between 1 and 5),
  design_rating smallint check (design_rating between 1 and 5),
  discovery_rating smallint check (discovery_rating between 1 and 5),
  listening_rating smallint check (listening_rating between 1 and 5),
  creator_studio_rating smallint check (creator_studio_rating between 1 and 5),
  community_rating smallint check (community_rating between 1 and 5),
  performance_rating smallint check (performance_rating between 1 and 5),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 3000),
  status text not null default 'published'
    check (status in ('published','pending','hidden','removed')),
  moderation_reason text,
  featured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint podcast_platform_reviews_one_per_member unique(user_id)
);

create index if not exists podcast_platform_reviews_public_feed_idx
  on public.podcast_platform_reviews(created_at desc)
  where status='published';
create index if not exists podcast_platform_reviews_status_created_idx
  on public.podcast_platform_reviews(status,created_at desc);
create index if not exists podcast_platform_reviews_featured_idx
  on public.podcast_platform_reviews(featured_at desc,created_at desc)
  where status='published' and featured_at is not null;

create table if not exists public.podcast_platform_review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.podcast_platform_reviews(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists podcast_platform_review_replies_review_status_idx
  on public.podcast_platform_review_replies(review_id,status);

create table if not exists public.podcast_platform_review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.podcast_platform_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(review_id,user_id)
);
create index if not exists podcast_platform_review_votes_review_created_idx
  on public.podcast_platform_review_votes(review_id,created_at desc);

create table if not exists public.podcast_platform_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.podcast_platform_reviews(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','hate','misinformation','conflict_of_interest','other')),
  details text check (details is null or char_length(details)<=1500),
  status text not null default 'new' check (status in ('new','reviewing','actioned','dismissed')),
  moderator_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create index if not exists podcast_platform_review_reports_review_status_idx
  on public.podcast_platform_review_reports(review_id,status,created_at desc);

-- Structured product feedback is separate from public platform reviews.
-- Submissions are private to the member and CrowRules administrators.
create table if not exists public.podcast_platform_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type text not null
    check (feedback_type in ('feature_request','bug_report','general_feedback')),
  category text not null
    check (category in ('ease_of_use','design','discovery','listening','creator_studio','community','performance','accessibility','other')),
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text not null check (char_length(trim(description)) between 1 and 4000),
  status text not null default 'new'
    check (status in ('new','under_review','planned','in_progress','completed','declined')),
  admin_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists podcast_platform_feedback_created_idx
  on public.podcast_platform_feedback(created_at desc);
create index if not exists podcast_platform_feedback_type_status_idx
  on public.podcast_platform_feedback(feedback_type,status,created_at desc);
create index if not exists podcast_platform_feedback_category_idx
  on public.podcast_platform_feedback(category,created_at desc);

create table if not exists public.podcast_platform_feedback_monthly_reports (
  month_start date primary key,
  report_data jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

alter table public.podcast_platform_reviews enable row level security;
alter table public.podcast_platform_review_replies enable row level security;
alter table public.podcast_platform_review_votes enable row level security;
alter table public.podcast_platform_review_reports enable row level security;
alter table public.podcast_platform_feedback enable row level security;
alter table public.podcast_platform_feedback_monthly_reports enable row level security;

drop policy if exists "Public read published platform reviews" on public.podcast_platform_reviews;
create policy "Public read published platform reviews"
  on public.podcast_platform_reviews for select to anon,authenticated
  using (status='published');
drop policy if exists "Members read own platform reviews" on public.podcast_platform_reviews;
create policy "Members read own platform reviews"
  on public.podcast_platform_reviews for select to authenticated
  using ((select auth.uid())=user_id);
drop policy if exists "Members create own platform review" on public.podcast_platform_reviews;
create policy "Members create own platform review"
  on public.podcast_platform_reviews for insert to authenticated
  with check ((select auth.uid())=user_id and status='published');
drop policy if exists "Members update own published platform review" on public.podcast_platform_reviews;
create policy "Members update own published platform review"
  on public.podcast_platform_reviews for update to authenticated
  using ((select auth.uid())=user_id and status='published')
  with check ((select auth.uid())=user_id and status='published');
drop policy if exists "Members delete own platform review" on public.podcast_platform_reviews;
create policy "Members delete own platform review"
  on public.podcast_platform_reviews for delete to authenticated
  using ((select auth.uid())=user_id);
drop policy if exists "Admins manage platform reviews" on public.podcast_platform_reviews;
create policy "Admins manage platform reviews"
  on public.podcast_platform_reviews for all to authenticated
  using (private.crowrules_is_admin_impl())
  with check (private.crowrules_is_admin_impl());

drop policy if exists "Public read published platform review replies" on public.podcast_platform_review_replies;
create policy "Public read published platform review replies"
  on public.podcast_platform_review_replies for select to anon,authenticated
  using (status='published');
drop policy if exists "Admins manage platform review replies" on public.podcast_platform_review_replies;
create policy "Admins manage platform review replies"
  on public.podcast_platform_review_replies for all to authenticated
  using (private.crowrules_is_admin_impl())
  with check (private.crowrules_is_admin_impl());

drop policy if exists "Members manage own platform review votes" on public.podcast_platform_review_votes;
create policy "Members manage own platform review votes"
  on public.podcast_platform_review_votes for all to authenticated
  using ((select auth.uid())=user_id)
  with check (
    (select auth.uid())=user_id
    and exists(select 1 from public.podcast_platform_reviews r where r.id=review_id and r.status='published')
    and exists(select 1 from public.podcast_platform_reviews r where r.id=review_id and r.user_id<>(select auth.uid()))
  );

drop policy if exists "Members submit platform review reports" on public.podcast_platform_review_reports;
create policy "Members submit platform review reports"
  on public.podcast_platform_review_reports for insert to authenticated
  with check (
    (select auth.uid())=reporter_user_id
    and exists(select 1 from public.podcast_platform_reviews r where r.id=review_id and r.status='published' and r.user_id<>(select auth.uid()))
  );
drop policy if exists "Members read own platform review reports" on public.podcast_platform_review_reports;
create policy "Members read own platform review reports"
  on public.podcast_platform_review_reports for select to authenticated
  using ((select auth.uid())=reporter_user_id);
drop policy if exists "Admins manage platform review reports" on public.podcast_platform_review_reports;
create policy "Admins manage platform review reports"
  on public.podcast_platform_review_reports for all to authenticated
  using (private.crowrules_is_admin_impl())
  with check (private.crowrules_is_admin_impl());

drop policy if exists "Members submit platform feedback" on public.podcast_platform_feedback;
create policy "Members submit platform feedback"
  on public.podcast_platform_feedback for insert to authenticated
  with check ((select auth.uid())=user_id and status='new' and admin_response is null and resolved_at is null);
drop policy if exists "Members read own platform feedback" on public.podcast_platform_feedback;
create policy "Members read own platform feedback"
  on public.podcast_platform_feedback for select to authenticated
  using ((select auth.uid())=user_id);
drop policy if exists "Admins manage platform feedback" on public.podcast_platform_feedback;
create policy "Admins manage platform feedback"
  on public.podcast_platform_feedback for all to authenticated
  using (private.crowrules_is_admin_impl())
  with check (private.crowrules_is_admin_impl());

drop policy if exists "Admins read monthly platform feedback reports" on public.podcast_platform_feedback_monthly_reports;
create policy "Admins read monthly platform feedback reports"
  on public.podcast_platform_feedback_monthly_reports for select to authenticated
  using (private.crowrules_is_admin_impl());
drop policy if exists "Admins manage monthly platform feedback reports" on public.podcast_platform_feedback_monthly_reports;
create policy "Admins manage monthly platform feedback reports"
  on public.podcast_platform_feedback_monthly_reports for all to authenticated
  using (private.crowrules_is_admin_impl())
  with check (private.crowrules_is_admin_impl());

-- Explicit Data API grants: public-schema tables are not auto-exposed on newer projects.
revoke all on table public.podcast_platform_reviews from anon,authenticated;
grant select on table public.podcast_platform_reviews to anon;
grant select,insert,update,delete on table public.podcast_platform_reviews to authenticated;
revoke all on table public.podcast_platform_review_replies from anon,authenticated;
grant select on table public.podcast_platform_review_replies to anon;
grant select,insert,update,delete on table public.podcast_platform_review_replies to authenticated;
revoke all on table public.podcast_platform_review_votes from anon,authenticated;
grant select,insert,delete on table public.podcast_platform_review_votes to authenticated;
revoke all on table public.podcast_platform_review_reports from anon,authenticated;
grant select,insert,update,delete on table public.podcast_platform_review_reports to authenticated;
revoke all on table public.podcast_platform_feedback from anon,authenticated;
grant select,insert,update,delete on table public.podcast_platform_feedback to authenticated;
revoke all on table public.podcast_platform_feedback_monthly_reports from anon,authenticated;
grant select,insert,update,delete on table public.podcast_platform_feedback_monthly_reports to authenticated;

create or replace function public.podcast_toggle_platform_review_helpful(p_review_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid := auth.uid(); v_existing uuid;
begin
  if v_user_id is null then raise exception 'Sign in to vote.' using errcode='42501'; end if;
  if not exists(select 1 from public.podcast_platform_reviews r where r.id=p_review_id and r.status='published' and r.user_id<>v_user_id) then
    raise exception 'This review is not available for voting.' using errcode='42501';
  end if;
  select v.id into v_existing from public.podcast_platform_review_votes v
   where v.review_id=p_review_id and v.user_id=v_user_id;
  if v_existing is not null then
    delete from public.podcast_platform_review_votes where id=v_existing;
    return false;
  end if;
  insert into public.podcast_platform_review_votes(review_id,user_id) values(p_review_id,v_user_id)
    on conflict(review_id,user_id) do nothing;
  return true;
end;
$$;
revoke all on function public.podcast_toggle_platform_review_helpful(uuid) from public,anon;
grant execute on function public.podcast_toggle_platform_review_helpful(uuid) to authenticated;

create or replace function public.podcast_platform_review_vote_summary(p_review_ids uuid[])
returns table(review_id uuid,helpful_count bigint,viewer_voted boolean)
language sql
stable
security definer
set search_path=''
as $$
  select r.id,count(v.id)::bigint,
    coalesce(bool_or(v.user_id=(select auth.uid())),false)
  from public.podcast_platform_reviews r
  left join public.podcast_platform_review_votes v on v.review_id=r.id
  where r.id=any(coalesce(p_review_ids,'{}'::uuid[])) and r.status='published'
  group by r.id;
$$;
revoke all on function public.podcast_platform_review_vote_summary(uuid[]) from public;
grant execute on function public.podcast_platform_review_vote_summary(uuid[]) to anon,authenticated;

-- Include platform reviews in the shared reviewer recognition counts.
create or replace function private.award_podcast_reviewer_badges(p_user_id uuid,p_review_id uuid default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_review_count bigint; v_helpful_count bigint;
begin
 if p_user_id is null then return; end if;
 select
   (select count(*) from public.podcast_reviews r where r.user_id=p_user_id and r.status='published')
  +(select count(*) from public.podcast_episode_reviews r where r.user_id=p_user_id and r.status='published')
  +(select count(*) from public.podcast_platform_reviews r where r.user_id=p_user_id and r.status='published')
 into v_review_count;
 select
   (select count(*) from public.podcast_review_votes v join public.podcast_reviews r on r.id=v.review_id where r.user_id=p_user_id and r.status='published')
  +(select count(*) from public.podcast_episode_review_votes v join public.podcast_episode_reviews r on r.id=v.review_id where r.user_id=p_user_id and r.status='published')
  +(select count(*) from public.podcast_platform_review_votes v join public.podcast_platform_reviews r on r.id=v.review_id where r.user_id=p_user_id and r.status='published')
 into v_helpful_count;
 if v_review_count>=1 then
  insert into public.podcast_review_badge_awards(badge_key,user_id,review_id,note,is_public)
  values('first_review',p_user_id,p_review_id,'Automatically earned for publishing a first review.',true)
  on conflict(badge_key,user_id) do nothing;
 end if;
 if v_review_count>=5 then
  insert into public.podcast_review_badge_awards(badge_key,user_id,review_id,note,is_public)
  values('community_voice',p_user_id,p_review_id,'Automatically earned after five published reviews.',true)
  on conflict(badge_key,user_id) do nothing;
 end if;
 if v_helpful_count>=10 then
  insert into public.podcast_review_badge_awards(badge_key,user_id,review_id,note,is_public)
  values('top_reviewer',p_user_id,p_review_id,'Automatically earned after receiving ten helpful votes.',true)
  on conflict(badge_key,user_id) do nothing;
 end if;
end;
$$;

create or replace function private.award_podcast_reviewer_badge_on_platform_review()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' then perform private.award_podcast_reviewer_badges(new.user_id,null); end if;
 return new;
end;
$$;
create or replace function private.award_podcast_reviewer_badge_on_platform_vote()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_user_id uuid;
begin
 select r.user_id into v_user_id from public.podcast_platform_reviews r
  where r.id=new.review_id and r.status='published';
 if v_user_id is not null then perform private.award_podcast_reviewer_badges(v_user_id,null); end if;
 return new;
end;
$$;
revoke all on function private.award_podcast_reviewer_badges(uuid,uuid) from public,anon,authenticated;
revoke all on function private.award_podcast_reviewer_badge_on_platform_review() from public,anon,authenticated;
revoke all on function private.award_podcast_reviewer_badge_on_platform_vote() from public,anon,authenticated;
drop trigger if exists podcast_platform_review_badges_after_review on public.podcast_platform_reviews;
create trigger podcast_platform_review_badges_after_review
 after insert or update of status on public.podcast_platform_reviews
 for each row execute function private.award_podcast_reviewer_badge_on_platform_review();
drop trigger if exists podcast_platform_review_badges_after_vote on public.podcast_platform_review_votes;
create trigger podcast_platform_review_badges_after_vote
 after insert on public.podcast_platform_review_votes
 for each row execute function private.award_podcast_reviewer_badge_on_platform_vote();

-- Monthly leaderboard now treats show, episode, and platform reviews as one reviewer record.
create or replace function public.get_podcast_monthly_reviewer_leaderboard(p_month date default date_trunc('month',now())::date)
returns table(username text,display_name text,avatar_url text,review_count bigint,helpful_votes bigint,leaderboard_rank bigint)
language sql stable security definer set search_path='' as $$
 with bounds as (
  select date_trunc('month',coalesce(p_month,current_date)::timestamp)::timestamptz start_at,
   (date_trunc('month',coalesce(p_month,current_date)::timestamp)+interval '1 month')::timestamptz end_at
 ),
 reviews as (
  select r.id,r.user_id,'show'::text review_type from public.podcast_reviews r,bounds b
   where r.status='published' and r.created_at>=b.start_at and r.created_at<b.end_at
  union all
  select r.id,r.user_id,'episode'::text from public.podcast_episode_reviews r,bounds b
   where r.status='published' and r.created_at>=b.start_at and r.created_at<b.end_at
  union all
  select r.id,r.user_id,'platform'::text from public.podcast_platform_reviews r,bounds b
   where r.status='published' and r.created_at>=b.start_at and r.created_at<b.end_at
 ),
 helpful as (
  select r.user_id,
   (select count(*) from public.podcast_review_votes v join reviews x on x.id=v.review_id and x.review_type='show'
     where x.user_id=r.user_id and v.created_at>=(select start_at from bounds) and v.created_at<(select end_at from bounds))
  +(select count(*) from public.podcast_episode_review_votes v join reviews x on x.id=v.review_id and x.review_type='episode'
     where x.user_id=r.user_id and v.created_at>=(select start_at from bounds) and v.created_at<(select end_at from bounds))
  +(select count(*) from public.podcast_platform_review_votes v join reviews x on x.id=v.review_id and x.review_type='platform'
     where x.user_id=r.user_id and v.created_at>=(select start_at from bounds) and v.created_at<(select end_at from bounds)) votes
  from reviews r group by r.user_id
 ),
 totals as (
  select r.user_id,count(*)::bigint reviews,coalesce(h.votes,0)::bigint helpful
  from reviews r left join helpful h on h.user_id=r.user_id group by r.user_id,h.votes
 )
 select p.username,
  coalesce(nullif(p.display_name,''),nullif(concat_ws(' ',p.first_name,p.last_name),''),p.username),
  p.avatar_url,t.reviews,t.helpful,
  row_number() over(order by t.helpful desc,t.reviews desc,p.username asc)
 from totals t join public.crowrules_public_profiles p on p.user_id=t.user_id
 where p.username is not null
 order by t.helpful desc,t.reviews desc,p.username asc limit 50;
$$;
revoke all on function public.get_podcast_monthly_reviewer_leaderboard(date) from public;
grant execute on function public.get_podcast_monthly_reviewer_leaderboard(date) to anon,authenticated;

-- Snapshot generation is private. The only exposed manual entry point checks admin access.
create or replace function private.generate_podcast_platform_feedback_report(p_month date)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_start date := date_trunc('month',p_month::timestamp)::date;
 v_end date := (date_trunc('month',p_month::timestamp)+interval '1 month')::date;
 v_data jsonb;
begin
 select jsonb_build_object(
  'month',to_char(v_start,'YYYY-MM'),
  'period_start',v_start,
  'period_end_exclusive',v_end,
  'generated_at',now(),
  'review_count',(select count(*) from public.podcast_platform_reviews r where r.status='published' and r.created_at>=v_start and r.created_at<v_end),
  'average_rating',(select round(avg(r.overall_rating)::numeric,2) from public.podcast_platform_reviews r where r.status='published' and r.created_at>=v_start and r.created_at<v_end),
  'rating_distribution',(select coalesce(jsonb_object_agg(q.rating::text,q.total),'{}'::jsonb) from (select r.overall_rating rating,count(*) total from public.podcast_platform_reviews r where r.status='published' and r.created_at>=v_start and r.created_at<v_end group by r.overall_rating) q),
  'feedback_submissions',(select count(*) from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end),
  'feedback_by_type',(select coalesce(jsonb_object_agg(q.feedback_type,q.total),'{}'::jsonb) from (select f.feedback_type,count(*) total from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end group by f.feedback_type) q),
  'feedback_by_category',(select coalesce(jsonb_object_agg(q.category,q.total),'{}'::jsonb) from (select f.category,count(*) total from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end group by f.category) q),
  'feedback_by_status',(select coalesce(jsonb_object_agg(q.status,q.total),'{}'::jsonb) from (select f.status,count(*) total from public.podcast_platform_feedback f where f.created_at>=v_start and f.created_at<v_end group by f.status) q),
  'top_suggestions',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select lower(trim(f.title)) title_key,min(f.title) title,min(f.category) category,count(*) submissions,
     array_agg(f.id order by f.created_at desc) feedback_ids
    from public.podcast_platform_feedback f
    where f.feedback_type='feature_request' and f.created_at>=v_start and f.created_at<v_end
    group by lower(trim(f.title)) order by count(*) desc,min(f.title) limit 10
  ) q),
  'top_issues',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select lower(trim(f.title)) title_key,min(f.title) title,min(f.category) category,count(*) submissions,
     array_agg(f.id order by f.created_at desc) feedback_ids
    from public.podcast_platform_feedback f
    where f.feedback_type='bug_report' and f.created_at>=v_start and f.created_at<v_end
    group by lower(trim(f.title)) order by count(*) desc,min(f.title) limit 10
  ) q)
 ) into v_data;
 insert into public.podcast_platform_feedback_monthly_reports(month_start,report_data,generated_at)
 values(v_start,v_data,now())
 on conflict(month_start) do update set report_data=excluded.report_data,generated_at=excluded.generated_at;
 return v_data;
end;
$$;
revoke all on function private.generate_podcast_platform_feedback_report(date) from public,anon,authenticated;

create or replace function public.admin_generate_podcast_platform_feedback_report(p_month date)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
 if not private.crowrules_is_admin_impl() then
  raise exception 'Administrator access required.' using errcode='42501';
 end if;
 return private.generate_podcast_platform_feedback_report(p_month);
end;
$$;
revoke all on function public.admin_generate_podcast_platform_feedback_report(date) from public,anon;
grant execute on function public.admin_generate_podcast_platform_feedback_report(date) to authenticated;

-- Generate a prior-month snapshot at 09:00 UTC on the first day of each month.
do $$
declare v_job_id bigint;
begin
 for v_job_id in select jobid from cron.job where jobname='crowrules-platform-feedback-monthly'
 loop perform cron.unschedule(v_job_id); end loop;
 perform cron.schedule(
  'crowrules-platform-feedback-monthly',
  '0 9 1 * *',
  $job$select private.generate_podcast_platform_feedback_report((date_trunc('month',now())-interval '1 month')::date);$job$
 );
end;
$$;
