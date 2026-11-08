# Creator Production Pipeline and Release Scheduler

Applied to Supabase project cevylpnoexugwgygvtgu on 2026-11-08.

## Database changes

    alter table public.podcast_episodes
      add column if not exists production_stage text not null default 'idea';

    alter table public.podcast_episodes
      add constraint podcast_episodes_production_stage_check
      check (production_stage in ('idea','planning','recording','editing','review','scheduled','published'));

    create index if not exists podcast_episodes_due_release_idx
      on public.podcast_episodes (scheduled_at)
      where status='scheduled';

The constraint was created conditionally after checking pg_constraint; it is shown unconditionally above for readability. Existing rows were backfilled from status (published → published, scheduled → scheduled, otherwise idea). Existing row-level security policies were retained.

## Private scheduler

The scheduled publishing worker is private.publish_due_podcast_episodes(). It runs with a fixed search path and is executable by the database scheduler role, not by anon or authenticated. It only publishes rows where:
- status='scheduled' and scheduled_at <= now();
- the episode is active;
- the parent show is published;
- an audio or video URL is present.

On publication it sets status, is_published, production_stage, published_at and updated_at, and inserts a scheduled_publish event into podcast_episode_pipeline_events.

Cron job: crowrules-podcasting-publish-due-v14, every minute, command: select private.publish_due_podcast_episodes();

The former v13 auto-publish job was unscheduled and its legacy public function execute privilege was restricted to postgres. The publication block in private.podcast_workflow_tick() was removed to avoid a second publisher; the remainder of that workflow function continues to run.

## Operational verification

- Cron job exists and is active.
- Recent Cron history showed successful executions.
- Manual invocation returned 0 published rows because no episodes were due during the test.
- Supabase Security and Health Advisors returned no lints.
- A real future-dated episode with media must still be scheduled in a signed-in browser and verified after its due time before end-to-end automatic publishing can be marked complete.

## Limitations

This publishes to the CrowRules Podcasting catalog only. External platform distribution, YouTube uploads, notifications and RSS feed delivery are separate integrations and are not implied by this worker.
