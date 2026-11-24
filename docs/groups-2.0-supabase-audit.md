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
3. The current group model distinguishes public versus non-public through `is_public`; it does not persist a distinct `invite_only` visibility value. Invitation rows are user-bound and RLS-protected, but the old browser acceptance flow only updated the status to accepted and did not create membership. The ordinary self-join policy only allows public circles. A new draft RPC locks and verifies the invite for `auth.uid()`, inserts the member role, and marks the invitation accepted in one transaction; it is in the branch migration and has not been applied to the database.
4. Posts already support post types, episode links/artwork, media paths, edited/deleted timestamps, pinning, and locking. Replies already exist separately.
5. `crowspace_live_rooms` already stores title, description, room type, visibility, circle/event/group references, schedule, stream URL, status, and lifecycle timestamps. It does not itself prove that a LiveKit room lifecycle, participant model, or secure token flow is fully wired.
6. `podcast_production_projects` already supports podcast-scoped production projects and a `source_collaboration_id`; it is not yet a complete group collaboration workspace with project membership, tasks, and resource permissions.

## RLS findings requiring careful follow-up

- Group membership has multiple SELECT policies; their combined OR behavior should be reviewed against the intended roster privacy model.
- Group posts have multiple SELECT policies and multiple UPDATE policies. These must be compared for equivalence and unintended access before any cleanup.
- Circle discovery has separate anonymous and authenticated SELECT policies, which is expected to support public discovery.
- The current `crowspace_live_rooms` public visibility SELECT policy is scoped to the `authenticated` role. Confirm whether anonymous visitors should be allowed to discover public rooms before changing it.
- The `podcast-group-media` bucket is private, limited to 8 MiB and image MIME types. Upload paths are `<circle-uuid>/<uploader-user-uuid>/<filename>`; upload authorization checks the first folder as the circle UUID and the second as the uploader ID.
- The existing `Public group media is viewable` SELECT policy used `storage.foldername(c.name)` (the circle's text name) instead of the Storage object path. This is inconsistent with the upload/member policies and prevents reliable public-object authorization. The branch migration replaces that policy with a check against `storage.foldername(objects.name)` and `c.id`; this policy change is draft-only and has not been applied to production.
- Private group media reads remain membership-gated through the existing member/moderator policy. The frontend uses short-lived signed URLs; those URLs should be treated as temporary access credentials and never persisted in the database.

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


## Follow-up audit — invitations, media, and live rooms

### Invitation acceptance

- The invite table contains `id`, `circle_id`, `inviter_id`, `invitee_id`, `status`, `created_at`, and `responded_at`; status is constrained to pending/accepted/declined/cancelled.
- RLS allows only the addressed invitee to respond while pending; the response check permits accepted or declined. The old frontend's direct UPDATE to accepted was allowed but did not create a membership row.
- Membership has a composite primary key `(circle_id, member_id)` and role check limited to owner/moderator/member. The normal self-join policy allows only public circles.
- The branch now calls `crowspace_accept_circle_invite(p_invite_id)` for acceptance. Its draft migration creates a locked, atomic implementation that derives the member from `auth.uid()`, requires the pending invite to be addressed to that user, inserts only the member role, and updates the invite. Declines remain a narrowly scoped direct update. The migration is not applied to production and still requires staging/RLS testing.

### Live audio/video

- The repository includes a LiveKit token service that creates server-generated room names, validates the authenticated Supabase user, checks that the caller owns the active session, and supports hashed, expiring, revocable invitations for guest/listener roles. The token service limits sessions to 10 participants and issues 10-minute tokens.
- This service uses the `podcasting_livekit_sessions` and `podcasting_livekit_invitations` model; it is not automatically integrated with the separate `crowspace_live_rooms` group/event room records. Group live rooms need a deliberate bridge from a group room record to an authorized LiveKit session, not a browser-generated room name or an untrusted role.
- The token service has a process-local IP rate limiter. Durable shared rate limiting remains a hardening item. Its host/guest/listener authorization path and invitation redemption should be covered by tests before group-room integration is enabled.

### Remaining validation

- Apply the branch migration only to an isolated staging Supabase project; test accepted invite → membership, wrong-user invite, duplicate membership, expired/non-pending invite, public/private group access, and anonymous/member public media reads.
- Validate signed URL generation for public and private group assets after the policy fix.
- Test LiveKit host, guest, and listener flows against the existing service; then design the group-room binding to the existing session model.
- Run the existing Groups Playwright/Axe suite plus invitation-specific browser and SQL/RLS tests before marking the PR ready.


## Groups 2.0 implementation — group LiveKit bridge

A branch-only implementation now adds a dedicated bridge from existing `crowspace_live_rooms` records to LiveKit:

- New migration `20261123230000_crowspace_group_livekit_bridge.sql` adds private, RLS-enabled session and invitation tables. Browser roles receive no direct table privileges; only `service_role` can access them.
- The invitation redemption RPC is service-role-only and atomically checks the hashed token, invitee ID/email, expiry, revocation, use limit, active session, and that the linked group room remains live.
- The existing Render Node token service now has group-specific session start/end, invitation create/revoke, host token, audience token, and invitation redemption paths. Existing creator podcast session routes and the separate Live Network Edge Function are left intact.
- Host authorization is checked server-side against the current room creator and the existing CrowRules community-circle model: `podcast_community_circles.owner_id` or `podcast_community_circle_members` with the `moderator` role. A separate `crowspace_group_members` model is not assumed or queried. Rooms referencing the legacy `group_id` field fail closed until a real schema contract is verified. A regular member cannot start a room session.
- Public room audience access is listener-only for signed-in users; community/group audience access requires current membership. Explicit guest/listener invitations can grant time-limited access to nonmembers without making a private room public. Only host and guest grants can publish media.
- LiveKit room names are generated by the server. Tokens are short-lived, and the existing ten-participant cap is retained.

### Not yet complete / not deployed

- This backend branch has not been deployed to Render. The new database migration has not been applied to staging or production.
- Added `groups/live-rooms.html` and `assets/js/groups-live-rooms.js`: room record creation (through existing RLS), host start/reconnect/end, public/member audience join, invitation join/create/revoke, audio/video stage, and a Groups navigation entry. The frontend reads `LIVEKIT_TOKEN_SERVICE_URL` from `assets/js/config.js`; it is intentionally blank until the correct deployed Render HTTPS URL is confirmed and configured.
- The bridge has syntax-level checks only so far. It still requires staging database/RLS tests and end-to-end LiveKit tests with synthetic identities.
- The service uses an in-memory IP rate limiter; shared rate limiting is needed before horizontal scaling.
- The earlier creator LiveKit migration `20261114000200_livekit_session_authorization.sql` is still absent from the connected production project; the group bridge uses its own tables and does not depend on that migration.


### Browser interface verification

- The new live-room browser module parses successfully, and all 26 static DOM IDs referenced by the module exist in the new HTML page.
- The Render service module parses successfully after stripping its static import declarations for parser-only validation. A dedicated GitHub Actions syntax workflow was added; no successful run is yet recorded for the latest commit.
- These checks do not replace real-browser, LiveKit, staging RLS, or end-to-end media tests.


## Follow-up — live-room group model alignment

- Confirmed product decision: a Groups Live Room belongs to an existing CrowRules Podcasting community (`podcast_community_circles`), not a separate group-conversation membership system.
- Follow-up branch `groups-live-rooms-circle-authorization` updates backend host/view authorization to use `podcast_community_circles.owner_id` and `podcast_community_circle_members(circle_id, member_id, role)` only.
- The live-room creation UI now offers Public or Existing community group; new room records write `circle_id` and leave `group_id` null. Legacy records with a non-null `group_id` are denied by the LiveKit authorization layer until their relationship is explicitly migrated and verified.
- No database migration, production data change, Render configuration, LiveKit credential, or deployment is included.
