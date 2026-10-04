create or replace view public.podcast_public_episodes as
select id,podcast_id,title,slug,description,episode_number,season_number,published_at,duration_seconds,
 case when lower(coalesce(access_level,'free')) in ('premium','subscriber','members','paid') then null else audio_url end as audio_url,
 case when lower(coalesce(access_level,'free')) in ('premium','subscriber','members','paid') then null else video_url end as video_url,
 thumbnail_url,status,play_count,is_explicit,created_at,updated_at,access_level,monetization_enabled,monetization_product_id,scheduled_at,tags,chapters
from public.podcast_episodes
where status='published';

grant select on public.podcast_public_episodes to anon, authenticated;
