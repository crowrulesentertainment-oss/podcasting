-- CrowRules Podcasting Guests Lounge backend tables and RLS
create table if not exists public.cr_guest_applications (
 id uuid primary key default gen_random_uuid(), name text not null check(char_length(btrim(name)) between 1 and 100),
 email text not null check(char_length(btrim(email)) between 3 and 200), links text not null default '' check(char_length(links)<=500),
 show_name text not null check(show_name in ('Back Deck Live','Tacoma Nights','Bird Brains','Open to suggestions')),
 appearance_type text not null default 'Not sure yet' check(appearance_type in ('Live conversation','Recorded interview','Video appearance','Audio-only appearance','Panel discussion','Recurring guest','Not sure yet')),
 availability text not null default '' check(char_length(availability)<=200), topics text not null check(char_length(btrim(topics)) between 1 and 5000),
 questions text not null default '' check(char_length(questions)<=3000), needs text not null default '' check(char_length(needs)<=1500),
 public_profile_opt_in boolean not null default false, status text not null default 'pending' check(status in ('pending','in_review','contacted','accepted','declined','archived')), created_at timestamptz not null default now()
);
alter table public.cr_guest_applications enable row level security;
revoke all on public.cr_guest_applications from anon, authenticated;
grant insert on public.cr_guest_applications to anon, authenticated;
drop policy if exists "Guests may submit applications" on public.cr_guest_applications;
create policy "Guests may submit applications" on public.cr_guest_applications for insert to anon, authenticated with check(char_length(btrim(name)) between 1 and 100 and char_length(btrim(email)) between 3 and 200 and char_length(btrim(topics)) between 1 and 5000 and status='pending');
create table if not exists public.cr_lounge_ideas (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(btrim(title)) between 1 and 120),
 category text not null default 'community' check(category in ('creators','community','culture')),
 description text not null check(char_length(btrim(description)) between 1 and 1500),
 status text not null default 'submitted' check(status in ('submitted','in_review','selected','declined','archived')), created_at timestamptz not null default now()
);
alter table public.cr_lounge_ideas enable row level security;
revoke all on public.cr_lounge_ideas from anon, authenticated;
grant select, insert on public.cr_lounge_ideas to anon, authenticated;
drop policy if exists "Anyone can read public lounge ideas" on public.cr_lounge_ideas;
create policy "Anyone can read public lounge ideas" on public.cr_lounge_ideas for select to anon, authenticated using(status in ('submitted','selected'));
drop policy if exists "Anyone can submit lounge ideas" on public.cr_lounge_ideas;
create policy "Anyone can submit lounge ideas" on public.cr_lounge_ideas for insert to anon, authenticated with check(char_length(btrim(title)) between 1 and 120 and char_length(btrim(description)) between 1 and 1500 and status='submitted');
create table if not exists public.cr_lounge_messages (
 id uuid primary key default gen_random_uuid(), room text not null check(room in ('community','episode')),
 show_name text not null default 'Community Hangout' check(show_name in ('Community Hangout','Back Deck Live','Tacoma Nights','Bird Brains')),
 display_name text not null check(char_length(btrim(display_name)) between 1 and 40), message text not null check(char_length(btrim(message)) between 1 and 500),
 status text not null default 'visible' check(status in ('visible','hidden','removed')), created_at timestamptz not null default now()
);
alter table public.cr_lounge_messages enable row level security;
revoke all on public.cr_lounge_messages from anon, authenticated;
grant select, insert on public.cr_lounge_messages to anon, authenticated;
drop policy if exists "Anyone can read visible lounge messages" on public.cr_lounge_messages;
create policy "Anyone can read visible lounge messages" on public.cr_lounge_messages for select to anon, authenticated using(status='visible');
drop policy if exists "Anyone can post lounge messages" on public.cr_lounge_messages;
create policy "Anyone can post lounge messages" on public.cr_lounge_messages for insert to anon, authenticated with check(char_length(btrim(display_name)) between 1 and 40 and char_length(btrim(message)) between 1 and 500 and status='visible');
create index if not exists cr_guest_applications_created_at_idx on public.cr_guest_applications(created_at desc);
create index if not exists cr_guest_applications_status_idx on public.cr_guest_applications(status,created_at desc);
create index if not exists cr_lounge_ideas_created_at_idx on public.cr_lounge_ideas(created_at desc);
create index if not exists cr_lounge_messages_room_created_idx on public.cr_lounge_messages(room,created_at desc);
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cr_lounge_messages') then alter publication supabase_realtime add table public.cr_lounge_messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cr_lounge_ideas') then alter publication supabase_realtime add table public.cr_lounge_ideas; end if;
 end if;
end $$;
