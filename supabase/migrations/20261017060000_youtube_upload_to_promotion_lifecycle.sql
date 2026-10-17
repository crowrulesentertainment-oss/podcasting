-- YouTube upload-to-promotion lifecycle.
-- The deployed migration adds canonical episode linkage and approval fields.
ALTER TABLE public.podcast_episodes
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_processing_status text,
  ADD COLUMN IF NOT EXISTS youtube_privacy_status text,
  ADD COLUMN IF NOT EXISTS youtube_upload_status text,
  ADD COLUMN IF NOT EXISTS youtube_status_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS youtube_promotion_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS youtube_promotion_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS youtube_promotion_approval_upload_id uuid REFERENCES public.youtube_upload_history(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'podcast_episodes_youtube_processing_status_check') THEN
    ALTER TABLE public.podcast_episodes ADD CONSTRAINT podcast_episodes_youtube_processing_status_check
      CHECK (youtube_processing_status IS NULL OR youtube_processing_status IN ('unknown','processing','succeeded','failed','terminated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'podcast_episodes_youtube_privacy_status_check') THEN
    ALTER TABLE public.podcast_episodes ADD CONSTRAINT podcast_episodes_youtube_privacy_status_check
      CHECK (youtube_privacy_status IS NULL OR youtube_privacy_status IN ('private','unlisted','public'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS podcast_episodes_youtube_video_id_idx
  ON public.podcast_episodes (youtube_video_id) WHERE youtube_video_id IS NOT NULL;

COMMENT ON COLUMN public.podcast_episodes.youtube_video_id IS 'YouTube video ID confirmed by the YouTube Data API; never populated from a client-supplied ID alone.';
COMMENT ON COLUMN public.podcast_episodes.youtube_promotion_approved_at IS 'Creator approval to promote the YouTube video externally, only after verified YouTube processing and manual playback review.';
