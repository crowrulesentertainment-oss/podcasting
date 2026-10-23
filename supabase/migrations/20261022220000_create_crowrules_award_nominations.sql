-- CrowRules Podcast Awards: authenticated nominations, private by default.
create table if not exists public.crowrules_award_nominations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'Podcast of the Year','Outstanding Host','Best Episode',
    'Best Community Conversation','Most Original Concept',
    'Best Audio & Production','Breakout Voice',
    'Most Meaningful Conversation','Best Guest Appearance',
    'Listeners'' Choice','Outstanding Series','Community Impact Award'
  )),
  nominee text not null check (char_length(btrim(nominee)) between 1 and 150),
  public_url text null check (public_url is null or (char_length(public_url) <= 500 and public_url ~* '^https?://')),
  reason text not null check (char_length(btrim(reason)) between 1 and 1200),
  submitter_name text null check (submitter_name is null or char_length(submitter_name) <= 100),
  status text not null default 'pending' check (status in ('pending','in_review','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crowrules_award_nominations_user_created_idx
  on public.crowrules_award_nominations (user_id, created_at desc);
alter table public.crowrules_award_nominations enable row level security;
drop policy if exists "Users can submit their own award nominations" on public.crowrules_award_nominations;
create policy "Users can submit their own award nominations"
  on public.crowrules_award_nominations for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists "Users can view their own award nominations" on public.crowrules_award_nominations;
create policy "Users can view their own award nominations"
  on public.crowrules_award_nominations for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.crowrules_award_nominations from anon, authenticated;
grant insert, select on public.crowrules_award_nominations to authenticated;
