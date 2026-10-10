-- Enable cross-page live updates for the shared Podcasting community.
-- RLS remains responsible for controlling which rows each user can access.
alter publication supabase_realtime add table public.podcast_member_posts;
alter publication supabase_realtime add table public.podcast_member_post_likes;
alter publication supabase_realtime add table public.podcast_member_post_comments;
