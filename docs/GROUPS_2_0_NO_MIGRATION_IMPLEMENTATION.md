# Groups 2.0 — No-Migration Implementation

## Deployment boundary

This implementation is designed to run against the existing CrowRules Podcasting Groups schema. It does not require or apply a Supabase migration, create a paid Supabase development branch, change production tables, modify RLS policies, alter grants, or change Storage/Realtime/provider configuration.

## Available in the no-migration community view

- Existing group identity and description.
- Existing public/private visibility as enforced by the current database policies.
- Existing authenticated Podcasting session.
- Public-group membership insertion using the existing membership table.
- Group feed reading from existing post records.
- Member-only post creation using existing post fields.
- Member-only replies using existing reply fields.
- Escaped user-generated text and bounded feed/reply queries.
- Existing RLS remains the authorization authority; the UI does not grant access.

When the newer optional Groups 2.0 columns are not present, the community page uses this compatibility view rather than displaying a read-only migration-blocked screen.

## Additional existing-schema feature enabled

- Notification preference controls use the verified `podcast_community_circle_notification_preferences` table: invitations, discussions, replies, and moderation alerts. The existing RLS policies scope reads and writes to the signed-in user's own `user_id`. This is a preference page, not a notification inbox; no notification records or email campaigns are created.

## Intentionally unavailable until separately authorized and secured

No browser-only imitation is provided for capabilities that require new durable records, provider credentials, or server authorization:

- General post reactions and personal bookmarks.
- Standalone feed polls (collaboration voting remains its existing workflow).
- Resource library records.
- Group chat messages/channels.
- Guest-finder opt-in profiles and invitations.
- Live rooms and room tokens.
- New achievement ledgers or analytics rollups.
- Join-request workflows unless the existing deployed join-request table and its policies are confirmed.
- Media upload/signed-media workflows when the required bucket and policies are not present.

Existing event, collaboration, invitation, recognition, and report pages remain separate and continue to depend on their existing schema and RLS policies.

## Security and acceptance notes

- The client only uses the signed-in user's existing Supabase session.
- All group, post, membership and reply reads/writes go through the existing Data API and remain subject to current RLS.
- No service-role key or privileged token is used in browser code.
- Private groups are not offered a client-side join shortcut; users must obtain an invitation from the group owner.
- User content is HTML-escaped before insertion into the page.
- Queries are bounded (50 posts and 150 replies per feed load).
- This UI fallback is not a substitute for server-side authorization or a full cross-role security test.
