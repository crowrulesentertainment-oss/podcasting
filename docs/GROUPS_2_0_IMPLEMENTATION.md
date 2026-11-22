# CrowRules Podcasting Groups 2.0

## Scope
Groups 2.0 extends the existing `podcast_community_circles` ecosystem. It does not create a parallel group system or authentication layer.

## Included in this feature branch
- Community page with optional group avatar/banner, signed private media URLs, and member image suggestions.
- Post composer with discussion, question, announcement, media, and podcast episode post types.
- Embedded YouTube and Spotify episodes; direct audio files use the native audio player; unsupported providers remain safe external links.
- Optional image attachment to a post.
- Author edit/delete controls and member reporting; moderator-only pinning and reply locking are also enforced by a database trigger.
- Threaded replies using the existing circle replies table, with a draft correction for the known cross-circle RLS correlation defect.
- Owner/moderator settings dashboard.
- Owner-managed moderator/member roles and member removal.
- Owner/moderator image suggestion review and report queue.
- Owner group profile editing and group deletion.
- Additive SQL draft for the new columns, suggestion/report tables, RLS policies and private Storage bucket.

## Existing behavior preserved
- Existing group IDs, membership rows, posts, events, collaborations, invitations and profile records are not recreated.
- Existing Podcasting Supabase client and Auth session are reused.
- Existing public/private visibility model remains unchanged.
- Existing RLS policies are not globally disabled or replaced.
- No service-role key or privileged credential is placed in browser code.

## Storage model
The proposed private `podcast-group-media` bucket stores group media under:
`<circle UUID>/<uploader UUID>/<unique filename>`.
Uploads are restricted to authenticated circle members and scoped to the uploader's own group folder. Public-group media can be viewed publicly; private-group media requires membership in that group. Group media URLs are short-lived signed URLs. Image formats are JPEG, PNG, WebP and GIF; the client enforces an 8 MB limit.

## Release blockers / required review
1. The SQL file under `supabase/drafts/` is a review draft, not an executable production migration. Production has a long migration history; recover and replay it locally before promoting this SQL to a generated timestamped migration.
2. Confirm existing private helper signatures and function grants for `private.crowspace_is_circle_member(uuid)`, `private.crowspace_is_circle_moderator_or_owner(uuid)`, and `private.crowrules_is_admin_impl()`.
3. Review duplicate/overlapping policies and storage policy names before local replay. Production currently has 1,438 recorded migrations but the repository only contains 60 migration files; a complete baseline/recovery process is required before any local replay.
4. Test all actions using separate public visitor, group member, post author, moderator, owner and platform-admin identities.
5. Confirm the deployed group pages include the new migration before enabling the upgraded community and settings routes.
6. Confirm the repository's GitHub Pages publishing configuration; the current repository workflow directory contains checks, but no Pages deploy workflow.

## Manual test matrix
- Public visitor: view public group and public posts; cannot create posts, upload, reply, report or access private media.
- Member: join, publish (including image-only and episode-only posts), edit/delete own posts, share an episode, preview/watch/listen to it before publishing, upload image, submit avatar/banner suggestions, reply and report.
- Member privilege boundary: direct API attempts to pin posts or lock replies must be rejected by the database trigger.
- Other member: cannot edit/delete another member's post or approve image suggestions.
- Moderator: review image suggestions/reports, moderate posts, pin posts, lock replies, remove non-owner members and read/upload group media; cannot delete group or change owner-only group profile fields.
- Owner: edit group identity, approve images, appoint/remove moderators, remove members, delete group.
- Cross-group: membership in group A must never allow reads/writes/uploads in group B.
- Recovery: deleted group behavior and cascade retention are documented and clearly confirmed in UI.

## Known limitations in this initial UI
- The episode picker is URL-based; catalog search against CrowRules's internal episode catalog is a follow-up integration.
- Synchronised listening parties, live rooms, events/RSVP improvements and full moderation audit timeline are not part of this change.
- Video embedding is limited to providers with predictable safe embed URLs; other providers open externally.
- Browser-side validation is convenience only; database constraints and Storage RLS are authoritative.
