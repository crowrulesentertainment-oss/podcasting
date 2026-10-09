-- The creator-alert trigger uses ON CONFLICT (creator_id, source_key).
-- Its existing partial unique index cannot be inferred by that target without a
-- matching WHERE predicate. A non-partial unique index with normal NULLS DISTINCT
-- semantics preserves multiple NULL source keys while making inference reliable.
DROP INDEX IF EXISTS public.cr_creator_alerts_creator_source_key_uidx;
CREATE UNIQUE INDEX cr_creator_alerts_creator_source_key_uidx
ON public.cr_creator_alerts (creator_id, source_key);
