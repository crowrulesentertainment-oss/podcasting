-- Add period-scoped participation and completion so daily, weekly, and monthly
-- challenges can be completed again in each period without duplicating rewards.
ALTER TABLE public.podcast_challenge_participants
  ADD COLUMN IF NOT EXISTS period_key text NOT NULL DEFAULT 'lifetime';
ALTER TABLE public.podcast_challenge_completions
  ADD COLUMN IF NOT EXISTS period_key text NOT NULL DEFAULT 'lifetime';

ALTER TABLE public.podcast_challenge_participants
  DROP CONSTRAINT IF EXISTS podcast_challenge_participants_challenge_id_user_id_key;
ALTER TABLE public.podcast_challenge_completions
  DROP CONSTRAINT IF EXISTS podcast_challenge_completions_challenge_id_user_id_key;

ALTER TABLE public.podcast_challenge_participants
  ADD CONSTRAINT podcast_challenge_participants_challenge_user_period_key
  UNIQUE (challenge_id, user_id, period_key);
ALTER TABLE public.podcast_challenge_completions
  ADD CONSTRAINT podcast_challenge_completions_challenge_user_period_key
  UNIQUE (challenge_id, user_id, period_key);

CREATE INDEX IF NOT EXISTS podcast_challenge_participants_user_period_idx
  ON public.podcast_challenge_participants (user_id, period_key, status);
CREATE INDEX IF NOT EXISTS podcast_challenge_completions_user_period_idx
  ON public.podcast_challenge_completions (user_id, period_key, completed_at DESC);

CREATE OR REPLACE FUNCTION public.join_podcast_challenge(p_challenge_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_challenge public.podcast_challenges;
  v_row public.podcast_challenge_participants;
  v_period_key text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT c.* INTO v_challenge
  FROM public.podcast_challenges c
  WHERE c.id = p_challenge_id
    AND c.is_published
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.ends_at IS NULL OR c.ends_at > now());
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found or not currently active'; END IF;

  v_period_key := CASE v_challenge.category
    WHEN 'daily' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    WHEN 'weekly' THEN to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW')
    WHEN 'monthly' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')
    ELSE 'lifetime'
  END;

  INSERT INTO public.podcast_challenge_participants(challenge_id, user_id, period_key)
  VALUES (p_challenge_id, v_user, v_period_key)
  ON CONFLICT (challenge_id, user_id, period_key)
  DO UPDATE SET updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'participant_id', v_row.id,
    'challenge_id', v_row.challenge_id,
    'period_key', v_row.period_key,
    'status', v_row.status,
    'progress', v_row.progress,
    'completed_at', v_row.completed_at
  );
END
$function$


CREATE OR REPLACE FUNCTION public.refresh_podcast_challenge_progress()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_part record;
  v_metric integer;
  v_awarded integer;
  v_period_key text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_count integer := 0;
  v_total_awarded integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  FOR v_part IN
    SELECT p.id AS participant_id, p.challenge_id, p.status, p.period_key,
           c.metric_key, c.goal, c.reward_points, c.category, c.starts_at, c.ends_at
    FROM public.podcast_challenge_participants p
    JOIN public.podcast_challenges c ON c.id = p.challenge_id
    WHERE p.user_id = v_user
      AND p.status IN ('active','completed')
      AND c.is_published
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
    FOR UPDATE OF p
  LOOP
    v_period_key := CASE v_part.category
      WHEN 'daily' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      WHEN 'weekly' THEN to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW')
      WHEN 'monthly' THEN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')
      ELSE 'lifetime'
    END;

    IF v_part.period_key <> v_period_key THEN CONTINUE; END IF;

    v_period_start := CASE v_part.category
      WHEN 'daily' THEN date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      WHEN 'weekly' THEN date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      WHEN 'monthly' THEN date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      ELSE v_part.starts_at
    END;
    IF v_period_start IS NULL THEN v_period_start := '-infinity'::timestamptz; END IF;
    IF v_part.starts_at IS NOT NULL AND v_part.starts_at > v_period_start THEN
      v_period_start := v_part.starts_at;
    END IF;

    v_period_end := CASE v_part.category
      WHEN 'daily' THEN (date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC'
      WHEN 'weekly' THEN (date_trunc('week', now() AT TIME ZONE 'UTC') + interval '1 week') AT TIME ZONE 'UTC'
      WHEN 'monthly' THEN (date_trunc('month', now() AT TIME ZONE 'UTC') + interval '1 month') AT TIME ZONE 'UTC'
      ELSE v_part.ends_at
    END;
    IF v_part.ends_at IS NOT NULL AND (v_period_end IS NULL OR v_part.ends_at < v_period_end) THEN
      v_period_end := v_part.ends_at;
    END IF;

    SELECT COALESCE(
      CASE v_part.metric_key
        WHEN 'completed_episodes' THEN (
          SELECT count(DISTINCT l.episode_id)::integer
          FROM public.podcast_listens l
          JOIN public.podcast_episodes e ON e.id = l.episode_id
          JOIN public.podcasts s ON s.id = e.podcast_id
          WHERE l.user_id = v_user
            AND l.started_at >= v_period_start
            AND (v_period_end IS NULL OR l.started_at < v_period_end)
            AND l.completed = true
            AND l.seconds_listened >= greatest(60, ceil(coalesce(e.duration_seconds,300) * 0.8)::integer)
            AND e.status = 'published' AND e.is_published AND e.is_active
            AND s.status = 'published'
        )
        WHEN 'unique_shows' THEN (
          SELECT count(DISTINCT e.podcast_id)::integer
          FROM public.podcast_listens l
          JOIN public.podcast_episodes e ON e.id = l.episode_id
          JOIN public.podcasts s ON s.id = e.podcast_id
          WHERE l.user_id = v_user
            AND l.started_at >= v_period_start
            AND (v_period_end IS NULL OR l.started_at < v_period_end)
            AND l.seconds_listened >= greatest(60, ceil(coalesce(e.duration_seconds,300) * 0.8)::integer)
            AND e.status = 'published' AND e.is_published AND e.is_active
            AND s.status = 'published'
        )
        WHEN 'listening_minutes' THEN (
          SELECT floor(coalesce(sum(least(l.seconds_listened, coalesce(e.duration_seconds,0))),0) / 60)::integer
          FROM public.podcast_listens l
          JOIN public.podcast_episodes e ON e.id = l.episode_id
          JOIN public.podcasts s ON s.id = e.podcast_id
          WHERE l.user_id = v_user
            AND l.started_at >= v_period_start
            AND (v_period_end IS NULL OR l.started_at < v_period_end)
            AND e.duration_seconds IS NOT NULL AND e.duration_seconds > 0
            AND e.status = 'published' AND e.is_published AND e.is_active
            AND s.status = 'published'
        )
        WHEN 'unique_categories' THEN (
          SELECT count(DISTINCT s.category)::integer
          FROM public.podcast_listens l
          JOIN public.podcast_episodes e ON e.id = l.episode_id
          JOIN public.podcasts s ON s.id = e.podcast_id
          WHERE l.user_id = v_user
            AND l.started_at >= v_period_start
            AND (v_period_end IS NULL OR l.started_at < v_period_end)
            AND l.seconds_listened >= greatest(60, ceil(coalesce(e.duration_seconds,300) * 0.8)::integer)
            AND e.status = 'published' AND e.is_published AND e.is_active
            AND s.status = 'published'
        )
      END, 0
    ) INTO v_metric;

    UPDATE public.podcast_challenge_participants
      SET progress = CASE WHEN v_part.category IN ('daily','weekly','monthly')
                          THEN v_metric ELSE greatest(progress, v_metric) END,
          updated_at = now()
      WHERE id = v_part.participant_id;

    IF v_metric >= v_part.goal AND v_part.status <> 'completed' THEN
      UPDATE public.podcast_challenge_participants
        SET status = 'completed', completed_at = now(), updated_at = now()
        WHERE id = v_part.participant_id;

      v_awarded := 0;
      IF v_part.reward_points > 0 THEN
        v_awarded := public.award_podcast_crowpoints(
          v_user, v_part.reward_points,
          'Podcast challenge completed: ' || v_part.challenge_id,
          'podcast_challenge', v_part.participant_id,
          jsonb_build_object('challenge_id', v_part.challenge_id,
                             'period_key', v_period_key,
                             'metric_value', v_metric)
        );
      END IF;

      INSERT INTO public.podcast_challenge_completions(
        challenge_id, user_id, participant_id, metric_value, reward_points, period_key
      )
      VALUES (
        v_part.challenge_id, v_user, v_part.participant_id, v_metric,
        greatest(v_awarded,0), v_period_key
      )
      ON CONFLICT (challenge_id, user_id, period_key) DO NOTHING;

      UPDATE public.podcast_challenge_participants
        SET reward_points_awarded = greatest(v_awarded,0)
        WHERE id = v_part.participant_id;

      v_count := v_count + 1;
      v_total_awarded := v_total_awarded + greatest(v_awarded,0);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('refreshed', true, 'new_completions', v_count,
                            'points_awarded', v_total_awarded);
END
$function$


REVOKE ALL ON FUNCTION public.join_podcast_challenge(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_podcast_challenge(text) TO authenticated;
REVOKE ALL ON FUNCTION public.refresh_podcast_challenge_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_podcast_challenge_progress() TO authenticated;
