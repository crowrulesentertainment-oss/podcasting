-- Listener achievement catalog and durable per-account unlocks.
CREATE TABLE IF NOT EXISTS public.podcast_listener_achievement_definitions (
  achievement_key text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT '🏆',
  threshold_type text NOT NULL CHECK (threshold_type IN ('completed_episodes','unique_shows','active_days')),
  threshold_value integer NOT NULL CHECK (threshold_value > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.podcast_listener_achievement_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL REFERENCES public.podcast_listener_achievement_definitions(achievement_key) ON DELETE RESTRICT,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  metric_value integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE public.podcast_listener_achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.podcast_listener_achievement_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Listener achievement definitions are readable" ON public.podcast_listener_achievement_definitions;
CREATE POLICY "Listener achievement definitions are readable"
  ON public.podcast_listener_achievement_definitions FOR SELECT TO anon, authenticated USING (is_active);
DROP POLICY IF EXISTS "Users read own listener achievements" ON public.podcast_listener_achievement_unlocks;
CREATE POLICY "Users read own listener achievements"
  ON public.podcast_listener_achievement_unlocks FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.podcast_listener_achievement_definitions FROM anon, authenticated;
GRANT SELECT ON public.podcast_listener_achievement_definitions TO anon, authenticated;
REVOKE ALL ON public.podcast_listener_achievement_unlocks FROM anon, authenticated;
GRANT SELECT ON public.podcast_listener_achievement_unlocks TO authenticated;

INSERT INTO public.podcast_listener_achievement_definitions
  (achievement_key,name,description,icon,threshold_type,threshold_value,sort_order)
VALUES
  ('first_listen','First Listen','Complete your first eligible published episode.','🎧','completed_episodes',1,10),
  ('explorer','Explorer','Complete eligible episodes from five different published shows.','🧭','unique_shows',5,20),
  ('on_a_roll','On a Roll','Complete eligible episodes on three separate UTC calendar days.','🔥','active_days',3,30),
  ('podcast_pro','Podcast Pro','Reach 50 eligible completed published episodes.','🎙️','completed_episodes',50,40)
ON CONFLICT (achievement_key) DO UPDATE SET
  name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon,
  threshold_type=EXCLUDED.threshold_type, threshold_value=EXCLUDED.threshold_value,
  sort_order=EXCLUDED.sort_order, is_active=true;

CREATE OR REPLACE FUNCTION public.refresh_podcast_listener_achievements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_episodes integer := 0;
  v_shows integer := 0;
  v_days integer := 0;
  v_new integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;

  SELECT count(DISTINCT l.episode_id)::integer,
         count(DISTINCT e.podcast_id)::integer,
         count(DISTINCT (l.started_at AT TIME ZONE 'UTC')::date)::integer
    INTO v_episodes, v_shows, v_days
  FROM public.podcast_listens l
  JOIN public.podcast_episodes e ON e.id=l.episode_id
  JOIN public.podcasts s ON s.id=e.podcast_id
  WHERE l.user_id=v_user
    AND l.completed IS TRUE
    AND l.seconds_listened >= greatest(60,ceil(coalesce(e.duration_seconds,300)*0.8)::integer)
    AND e.status='published' AND e.is_published IS TRUE AND e.is_active IS TRUE
    AND s.status='published';

  WITH metrics AS (
    SELECT 'first_listen'::text AS achievement_key, v_episodes AS metric_value
    UNION ALL SELECT 'explorer',v_shows
    UNION ALL SELECT 'on_a_roll',v_days
    UNION ALL SELECT 'podcast_pro',v_episodes
  ), eligible AS (
    SELECT d.achievement_key,m.metric_value
    FROM public.podcast_listener_achievement_definitions d
    JOIN metrics m USING (achievement_key)
    WHERE d.is_active AND m.metric_value >= d.threshold_value
  ), inserted AS (
    INSERT INTO public.podcast_listener_achievement_unlocks(user_id,achievement_key,metric_value)
    SELECT v_user,e.achievement_key,e.metric_value FROM eligible e
    ON CONFLICT (user_id,achievement_key) DO NOTHING
    RETURNING achievement_key
  )
  SELECT count(*)::integer INTO v_new FROM inserted;

  RETURN jsonb_build_object(
    'refreshed',true,
    'new_unlocks',v_new,
    'metrics',jsonb_build_object(
      'completed_episodes',v_episodes,
      'unique_shows',v_shows,
      'active_days',v_days
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION public.refresh_podcast_listener_achievements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_podcast_listener_achievements() TO authenticated;
