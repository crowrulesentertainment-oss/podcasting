-- Repair deployed listen-session RPC: avoid ON CONFLICT inference failures on the
-- existing NULLS NOT DISTINCT unique index, while keeping writes idempotent.
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
  v_inserted boolean := false;
  v_seconds integer := greatest(0, least(coalesce(p_seconds_listened, 0), 86400));
  v_podcast_id uuid;
BEGIN
  IF p_episode_id IS NULL THEN RAISE EXCEPTION 'episode_id is required'; END IF;
  IF p_session_key IS NULL OR length(p_session_key) < 16 OR length(p_session_key) > 200 THEN
    RAISE EXCEPTION 'session_key must be between 16 and 200 characters';
  END IF;

  SELECT e.podcast_id INTO v_podcast_id
  FROM public.podcast_episodes e
  WHERE e.id = p_episode_id;
  IF v_podcast_id IS NULL THEN RAISE EXCEPTION 'episode not found'; END IF;

  UPDATE public.podcast_listens
  SET seconds_listened = greatest(coalesce(seconds_listened, 0), v_seconds),
      completed = coalesce(completed, false) OR coalesce(p_completed, false)
  WHERE session_key = p_session_key
    AND episode_id = p_episode_id
    AND user_id IS NOT DISTINCT FROM v_user_id
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    BEGIN
      INSERT INTO public.podcast_listens(user_id, episode_id, session_key, seconds_listened, completed)
      VALUES (v_user_id, p_episode_id, p_session_key, v_seconds, coalesce(p_completed, false))
      RETURNING id INTO v_id;
      v_inserted := true;
    EXCEPTION WHEN unique_violation THEN
      UPDATE public.podcast_listens
      SET seconds_listened = greatest(coalesce(seconds_listened, 0), v_seconds),
          completed = coalesce(completed, false) OR coalesce(p_completed, false)
      WHERE session_key = p_session_key
        AND episode_id = p_episode_id
        AND user_id IS NOT DISTINCT FROM v_user_id
      RETURNING id INTO v_id;
    END;
  END IF;

  IF v_inserted THEN
    UPDATE public.podcasts
    SET listener_count = (
      SELECT count(DISTINCT l.user_id)::integer
      FROM public.podcast_listens l
      JOIN public.podcast_episodes e ON e.id = l.episode_id
      WHERE e.podcast_id = v_podcast_id AND l.user_id IS NOT NULL
    ), updated_at = now()
    WHERE id = v_podcast_id;
  END IF;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_podcast_listen_session(uuid, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_podcast_listen_session(uuid, text, integer, boolean) TO anon, authenticated;
