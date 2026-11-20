# Community Groups Phase 1 SQL draft

This folder contains a reviewed draft for the first additive CrowRules Podcasting Community Groups database change.

## Important

- This is **not** a timestamped Supabase migration.
- It has **not** been applied to production.
- It has **not** changed Supabase migration history.
- It intentionally extends the existing `podcast_community_circles` model rather than creating duplicate `community_groups`, profile, or direct-message systems.
- Existing production RLS policies are retained; only new policies are added.
- Existing circle rows with `is_public = false` are backfilled as `hidden` to preserve their previous non-discoverable behavior.

## Promote to a real migration

The repository currently has no committed `supabase/config.toml` or `supabase/migrations/` directory. Before applying anything:

1. Reconcile the local Supabase project configuration and migration history with production.
2. Generate a real migration filename using the Supabase CLI:
   `supabase migration new community_groups_phase1`
3. Copy the SQL draft into the CLI-generated timestamped file.
4. Review the migration against the current production schema and current private helper functions.
5. Test it against a development database and verify RLS with separate public, member, owner, moderator, and administrator identities.
6. Only then consider applying it to production.

Supabase CLI v3 targets the local stack by default and confirms hosted changes. Do not point an unreviewed draft at production.

## Phase 1 scope

- Extend existing circle records with slugs, cover/avatar URL fields, visibility, and group-chat enablement.
- Preserve compatibility with the legacy `is_public` column.
- Support discoverable private groups and invitation-only hidden groups.
- Add private-group join requests with atomic moderator approval.
- Add RLS-protected group chat messages and Realtime publication membership.
- Reuse existing circle posts/replies, events/RSVPs, invitations, polls/collaborations, activity, recognition, member profiles, and direct messaging.

Media bucket provisioning, front-end routes, group media uploads, voice provider integration, Watch Together, badge catalog expansion, analytics dashboards, and admin UI remain later implementation work.
