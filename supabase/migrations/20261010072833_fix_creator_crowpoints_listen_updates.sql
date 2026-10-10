-- Fix creator CrowPoints for listens that become qualifying after session creation.
-- The global player opens a listening row at zero seconds, then updates that
-- row as listening time accumulates. An INSERT-only trigger misses that award.
CREATE OR REPLACE FUNCTION public.crowrules_podcast_listen_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_creator uuid;
BEGIN
  IF COALESCE(NEW.seconds_listened, 0) < 300 OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.creator_id
    INTO v_creator
  FROM public.podcast_episodes AS e
  JOIN public.podcasts AS p ON p.id = e.podcast_id
  WHERE e.id = NEW.episode_id
    AND e.status = 'published'
    AND e.is_published = true
    AND e.is_active = true
    AND p.status = 'published';

  IF v_creator IS NOT NULL AND v_creator <> NEW.user_id THEN
    -- award_podcast_crowpoints is idempotent by user, source and reference.
    PERFORM public.award_podcast_crowpoints(
      v_creator,
      2,
      'Received a qualifying podcast listen',
      'podcast_listen',
      NEW.id,
      pg_catalog.jsonb_build_object(
        'episode_id', NEW.episode_id,
        'seconds_listened', NEW.seconds_listened
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.crowrules_podcast_listen_points() SET search_path = '';

DROP TRIGGER IF EXISTS trg_podcast_listen_points ON public.podcast_listens;
CREATE TRIGGER trg_podcast_listen_points
AFTER INSERT OR UPDATE OF seconds_listened ON public.podcast_listens
FOR EACH ROW
WHEN (NEW.seconds_listened >= 300)
EXECUTE FUNCTION public.crowrules_podcast_listen_points();
