-- Atomic, idempotent listening-session tracking for signed-in and anonymous listeners.
-- The production migration also preserves the existing RPC signature used by the shared player.
CREATE UNIQUE INDEX IF NOT EXISTS podcast_listens_session_episode_user_uidx
ON public.podcast_listens (session_key, episode_id, user_id) NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.record_podcast_listen_session(
  p_episode_id uuid,
  p_session_key text,
  p_seconds_listened integer DEFAULT 0,
  p_completed boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_seconds integer := greatest(0, least(coalesce(p_seconds_listened, 0), 86400));
  v_podcast_id uuid;
BEGIN
  IF p_episode_id IS NULL THEN RAISE EXCEPTION 'episode_id is required'; END IF;
  IF p_session_key IS NULL OR length(p_session_key) < 16 OR length(p_session_key) > 200 THEN
    RAISE EXCEPTION 'session_key must be between 16 and 200 characters';
  END IF;

  SELECT e.podcast_id INTO v_podcast_id
  FROM public.podcast_episodes e WHERE e.id = p_episode_id;
  IF v_podcast_id IS NULL THEN RAISE EXCEPTION 'episode not found'; END IF;

  INSERT INTO public.podcast_listens(user_id, episode_id, session_key, seconds_listened, completed)
  VALUES (v_user_id, p_episode_id, p_session_key, v_seconds, coalesce(p_completed, false))
  ON CONFLICT (session_key, episode_id, user_id)
  DO UPDATE SET
    seconds_listened = greatest(coalesce(public.podcast_listens.seconds_listened, 0), EXCLUDED.seconds_listened),
    completed = coalesce(public.podcast_listens.completed, false) OR coalesce(EXCLUDED.completed, false)
  RETURNING id INTO v_id;

  UPDATE public.podcasts
  SET listener_count = (
    SELECT count(DISTINCT l.user_id)::integer
    FROM public.podcast_listens l
    JOIN public.podcast_episodes e ON e.id = l.episode_id
    WHERE e.podcast_id = v_podcast_id AND l.user_id IS NOT NULL
  ), updated_at = now()
  WHERE id = v_podcast_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_podcast_listen_session(uuid, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_podcast_listen_session(uuid, text, integer, boolean) TO anon, authenticated;
