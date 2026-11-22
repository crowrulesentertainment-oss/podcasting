# CrowRules+ Original Requirements Recovery

**Status:** evidence report only — no database, application, or policy changes.
**Reviewed:** 2026-11-22
**Target branch:** `security/crowrulesplus-rls-review`

## Executive finding

The original CrowRules+ frontend/schema contract has **not** been recovered from the tracked `podcasting` repository. Repository-wide searches of the default branch did not find application queries for `crplus_content`, `crplus_project_submissions`, `crplus_play_events`, `crplus_follows`, `crplus_ratings`, or `crplus_content_sources`.

A related, live CrowRules product — **Dreamscapes** — does provide authoritative evidence for the existing creative-submission and collaborative-production workflow. It is a separate implementation using `ds_*` tables. Its schema must not be silently substituted for the missing CrowRules+ schema.

## Evidence recovered from Dreamscapes

Repository: [crowrulesentertainment-oss/dreamscapes](https://github.com/crowrulesentertainment-oss/dreamscapes)

| Evidence | File | Commit |
|---|---|---|
| Authenticated idea submission | [assets/js/submit.js](https://github.com/crowrulesentertainment-oss/dreamscapes/blob/main/assets/js/submit.js) | `16254278b2bccb3dba736d7fa39a43e6c2404937` |
| Creator submission dashboard and messaging | [assets/js/creator-dashboard.js](https://github.com/crowrulesentertainment-oss/dreamscapes/blob/main/assets/js/creator-dashboard.js) | `b91b3b57d334ac26e584d325a4e6c1eeb43af9ac` |
| Creator portal | [assets/js/creator-portal.js](https://github.com/crowrulesentertainment-oss/dreamscapes/blob/main/assets/js/creator-portal.js) | `cd67136e3856d6527cb95e183b594bf647fb9e8e` |
| Collaborative workspace | [assets/js/project-workspace.js](https://github.com/crowrulesentertainment-oss/dreamscapes/blob/main/assets/js/project-workspace.js) | `191c6da11b7bd5fcb407eeeacadcc6dafa12c6de` |
| Production dashboard | [assets/js/project-dashboard.js](https://github.com/crowrulesentertainment-oss/dreamscapes/blob/main/assets/js/project-dashboard.js) | `3c727f2e511a322d23736f9b5928d57fa15234ca` |
| Submission form and rights language | [submit.html](https://github.com/crowrulesentertainment-oss/dreamscapes/blob/main/submit.html) | `1aaa90d012b5f2559d2df97bbcead846ad628d7f` |

### Confirmed submission contract

The live form inserts into `public.ds_submissions` using:

- `submitter_id` from the authenticated Supabase user
- `submitter_name` and authenticated account email
- `title`, `submission_type`, `premise`, optional `genre`
- `involvement_preference`

The form requires a rights confirmation and explains that submission does not transfer ownership or create a development, option, purchase, compensation, or production commitment. It describes review as private.

The creator dashboard reads only the signed-in user's submissions, shows review status, and provides a message thread through `ds_submission_messages`. The creator can send a message as `sender_role='creator'`.

### Confirmed collaborative-production contract

The workspace and creator portal use these existing tables:

- `ds_projects`
- `ds_project_members`
- `ds_creator_profiles`
- `ds_production_tasks`
- `ds_workspace_milestones`
- `ds_workspace_documents`
- `ds_document_versions`
- `ds_document_comments`
- `ds_workspace_activity`
- `ds_media_assets`
- `ds_notifications`
- `ds_submission_messages`

The workflow includes project ownership, invitations and acceptance, project roles, tasks and assignments, stages and due dates, milestones, versioned story documents, document discussion, activity, and private project media. Dreamscapes media is uploaded to the `dreamscapes-media` bucket and opened through short-lived signed URLs. The UI limits an individual upload to 50 MB.

This is evidence of Dreamscapes requirements, not proof that CrowRules+ uses identical table shapes or permissions.

## Production database verification (read-only)

The production project `cevylpnoexugwgygvtgu` was queried read-only.

- `ds_submissions` exists with the fields used by the live form, plus review fields: `status`, `internal_notes`, `reviewer_id`, `reviewed_at`, `created_at`, and `updated_at`.
- `ds_projects.source_submission_id` is a foreign key to `ds_submissions(id)` with `ON DELETE SET NULL`.
- `ds_projects` includes `created_by`, `development_stage`, `project_status`, and `visibility`.
- `ds_project_members` includes `project_role`, `membership_status`, and `invited_by`, with a unique constraint on `(project_id,user_id)`.
- `ds_submissions`, `ds_submission_messages`, `ds_projects`, and `ds_project_members` have RLS enabled.
- Existing policies permit a submitter to insert a submission only when `submitter_id = auth.uid()`, read only their own submissions, and permit active administrators to manage submissions.
- Submission-message reads are restricted to the submitter or active administrators. Inserts require the authenticated sender ID and the appropriate creator/admin relationship.
- No triggers were found on `ds_submissions`, `ds_projects`, or `ds_submission_messages` in the current production schema.

**Security note:** the existing `ds_submissions` table-level INSERT grant plus an owner-only RLS check does not, by itself, constrain which columns a client may supply. Any future intake hardening must separately protect reviewer/status/internal fields (for example through column grants or a narrowly scoped RPC). This report does not alter that existing Dreamscapes behavior.

## CrowRules+ migration evidence

Production migration history records these CrowRules+ migrations:

- `20260920043519 crplus_v3_video_delivery_admin`
- `20260920043558 crplus_v3_entitlement_social_analytics`
- `20260920044352 crplus_v4_video_ratings_notifications`
- `20260920044538 crplus_v4_playback_types`
- `20260920044543 crplus_v4_live_sources`
- `20260920045059 crowrulesplus_creator_admin_studio`
- `20260920045242 crowrulesplus_ops_indexes_and_views`
- `20260920045302 crowrulesplus_admin_bootstrap_and_ops_rls`
- `20260920045544 crplus_creator_studio_pipeline_v4`
- `20260920045722 crplus_v5_dreamscapes_production_bridge`
- `20260920045912 crplus_v6_episode_pipeline`
- `20260920050036 crplus_v7_production_notifications_and_project_links`
- `20260920050135 crplus_v7_lock_notification_trigger_functions`

The migration ledger confirms that these migrations were recorded, but the original SQL bodies and complete original application contract were not recovered in the tracked repository. The production catalog inspection previously found no foundational `crplus_content`, `crplus_live_channels`, or `crplus_schedule` tables.

## Consequences for the recovery draft

1. Do **not** add public INSERT to `crplus_project_submissions` just because the table exists in the reconstruction. Dreamscapes already has a separate `ds_submissions` intake path.
2. The existing `ds_projects.source_submission_id -> ds_submissions.id` relationship is confirmed. The draft's additional `crplus_projects.source_submission_id -> crplus_project_submissions.id` is not confirmed by the recovered application evidence and must remain a blocker pending original migration SQL.
3. The Dreamscapes bridge should be reviewed against the actual `ds_submissions` fields and status values before restoration. Do not assume the reconstructed `crplus_project_submissions` is the bridge source.
4. The workspace demonstrates that production tasks, milestones, documents, comments, activity, team membership, and media are project-scoped and collaborator-controlled. The CR+ task/credit/status-history policies remain unverified against their original app contract.
5. No frontend use was found for the reconstructed CR+ follow, rating, play-event, or content-source tables. Their intended public read/write shape remains unverified; keep the privacy and analytics concerns open.
6. Do not infer public access to raw media paths. Dreamscapes uses private object storage and signed URLs for project media.

## Remaining blockers to recover the actual CrowRules+ contract

- Obtain the original CrowRules+ UI/source bundle or an archived deployment snapshot.
- Obtain original SQL bodies for the recorded CrowRules+ migrations, especially v3/v4/v5/v6/v7.
- Recover the intended relationship between CrowRules+ content, shows/episodes, Dreamscapes submissions/projects, creators, and media storage.
- Confirm rating aggregation, follow privacy, playback-event write semantics, and schedule/live-channel public fields from the original UI.
- Only then revise the draft, write exact regression tests, and consider a disposable Supabase branch.

## Safety boundary

This report is documentation only. No production SQL, schema, RLS policies, storage policies, application code, merges, or deployments were changed. The existing recovery draft remains a non-deployable draft.


## Additional production catalog findings (read-only, 2026-11-22)

A follow-up catalog search for all objects whose names contain `crplus` found only two objects in the `public` schema:

- `public.crplus_universal_membership` (view)
- `public.crplus_universal_membership_health` (view)

The view definitions show that the current CR+ membership-facing integration is backed by the shared `members` and `membership_plans` tables:

- `crplus_universal_membership` selects `user_id`, `membership_type`, `role`, `status`, and plan level/key/name. It joins `members.membership_type` to `membership_plans.plan_key` case-insensitively and excludes rows with a null `user_id`.
- `crplus_universal_membership_health` reports counts of member rows, rows without auth users, members without matching plans, CROW members, and active/inactive members.

The current `membership_plans` records are:

| Plan key | Display name | Level | Description |
|---|---|---:|---|
| `crow` | CROW | 1 | Free CrowRules membership. Join the community and follow the CrowRules universe. |
| `crowner` | CROWNER | 2 | Help build CrowRules from the ground floor. |
| `creator` | CREATOR | 3 | Get closer to how CrowRules productions are made. |
| `founder` | FOUNDER | 4 | Help build CrowRules Entertainment from the ground up. |

These findings establish a real shared membership/entitlement vocabulary and an existing view-level integration point. They do **not** establish the missing CrowRules+ catalog, episode, creator-studio, playback, ratings, follows, or live/schedule schema. The two views are not substitutes for the original migration bodies.

The catalog query was read-only. No view, membership row, plan, table, policy, or grant was changed.


### Membership view access check

The two membership views both have `security_invoker=true`. The read-only privilege check found that neither `anon` nor `authenticated` currently has SELECT privilege on either view. This means they are not presently exposed through those roles as direct client-readable views. No access grants were changed.

This narrows the confirmed integration to an existing internal/database-side membership reporting surface; it does not demonstrate a client-facing CrowRules+ entitlement API.
