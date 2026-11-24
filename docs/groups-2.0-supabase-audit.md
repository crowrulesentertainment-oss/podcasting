# Groups 2.0 — Supabase compatibility audit

Date: 2026-11-23
Project: `cevylpnoexugwgygvtgu`
Status: Read-only audit; no database objects or policies changed.

## Existing capabilities to reuse

The live project already contains these Groups/CrowSpace tables:

- `podcast_community_circles`
- `podcast_community_circle_members`
- `podcast_community_circle_posts`
- `podcast_community_circle_replies`
- `podcast_community_circle_activity`
- `podcast_community_circle_join_requests`
- `podcast_community_circle_invites`
- `podcast_community_circle_events`
- `podcast_community_circle_event_rsvps`
- `podcast_community_circle_collaborations`
- `podcast_community_circle_collaboration_votes`
- `podcast_community_circle_helpful_votes`
- `podcast_community_circle_recognitions`
- `podcast_community_circle_reports`
- `podcast_community_circle_image_suggestions`
- `podcast_community_circle_notification_preferences`
- `crowspace_live_rooms`
- `podcast_production_projects`
- Storage bucket: `podcast-group-media`

All listed public-schema Groups tables inspected in the audit had RLS enabled.

## Schema compatibility findings

1. `podcast_community_circles` currently has `is_public`, `is_featured`, `branch_key`, `avatar_image_path`, and `banner_image_path`. It does not currently expose `visibility`, `slug`, or `cover_image_url` columns.
2. The current `groups-pages.js` rich group query requests some of those absent columns and has a fallback query. Keep the fallback until the schema and frontend are deliberately migrated together.
3. The current group model distinguishes public versus non-public through a boolean. It does not yet provide a distinct persisted `invite_only` visibility value. Invitation rows exist, but the membership policies and invite acceptance flow need to be reconciled before adding that mode.
4. Posts already support post types, episode links/artwork, media paths, edited/deleted timestamps, pinning, and locking. Replies already exist separately.
5. `crowspace_live_rooms` already stores title, description, room type, visibility, circle/event/group references, schedule, stream URL, status, and lifecycle timestamps. It does not itself prove that a LiveKit room lifecycle, participant model, or secure token flow is fully wired.
6. `podcast_production_projects` already supports podcast-scoped production projects and a `source_collaboration_id`; it is not yet a complete group collaboration workspace with project membership, tasks, and resource permissions.

## RLS findings requiring careful follow-up

- Group membership has multiple SELECT policies; their combined OR behavior should be reviewed against the intended roster privacy model.
- Group posts have multiple SELECT policies and multiple UPDATE policies. These must be compared for equivalence and unintended access before any cleanup.
- Circle discovery has separate anonymous and authenticated SELECT policies, which is expected to support public discovery.
- The current `crowspace_live_rooms` public visibility SELECT policy is scoped to the `authenticated` role. Confirm whether anonymous visitors should be allowed to discover public rooms before changing it.
- The Storage policy named `Public group media is viewable` appears to compare a circle ID against `storage.foldername(c.name)`. Since `c.name` is the circle's text name, this expression appears inconsistent with the other policies that inspect the storage object's folder path. Verify the exact intended folder convention and policy behavior before relying on public media reads. No policy was changed.

## Implementation decisions

- Preserve all existing tables, data, and policies.
- Reuse existing events, RSVP, collaboration, recognition, replies, and moderation systems.
- Do not add duplicate comments/replies, likes/reactions, events, or achievements tables until a gap is proven.
- Before adding messaging, inspect whether a compatible existing platform-wide messaging system exists.
- Before extending live rooms, audit the existing LiveKit token service and its authorization checks.
- Add schema only through reviewed, additive migrations with targeted RLS policies and tests.
- Do not deploy schema or policy changes to production as part of the visual foundation.

## Next technical tasks

1. Trace invitation acceptance end-to-end (frontend, SQL functions/triggers, and RLS).
2. Inspect LiveKit token service and room lifecycle integration.
3. Verify Storage bucket configuration and test public/private media access.
4. Trace all current page queries against actual column names.
5. Produce a minimal additive schema proposal only after these checks.
