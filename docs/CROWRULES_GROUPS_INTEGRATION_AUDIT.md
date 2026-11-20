# CrowRules Groups — integration audit

**Date:** 2026-11-20  
**Scope:** Read-only production schema and RLS inspection; feature branch #47.  
**Production changes:** None.

## Findings

### 1. Phase 1 schema is not installed

The current production schema exposes the legacy circle fields only:

- `podcast_community_circles`: `id`, `owner_id`, `name`, `description`, `category`, `is_public`, `is_featured`, `created_at`, `updated_at`, `community_rules`, `pinned_post_id`, `branch_key`.
- `podcast_community_circle_members`: `circle_id`, `member_id`, `role`, `joined_at`.
- `podcast_community_circle_posts`: `id`, `circle_id`, `author_id`, `body`, `created_at`, `updated_at`.

The following Phase 1 features are not yet backed by production schema: visibility modes, group cover/avatar columns, private join requests, and group chat messages. The Groups UI uses a legacy-schema fallback for discovery and group details. Private requests and chat must not be treated as production-ready until the Phase 1 migration is locally replayed, reviewed, and approved.

### 2. Existing replies RLS policies need correction before enabling reply UI

Read-only inspection of `pg_policies` returned these predicates in the existing policies for `podcast_community_circle_replies`:

- The INSERT membership subquery compares `m.circle_id = m.circle_id`, which is tautological rather than matching the reply's circle.
- The INSERT parent-post subquery compares `p.circle_id = p.circle_id`, also tautological rather than verifying the post belongs to the reply's circle.
- The SELECT parent-post subquery uses the same tautological circle comparison.

These conditions do not enforce the intended same-circle relationship. The current Groups UI therefore does not expose reply creation, and a future replies feature must wait until a separately reviewed, additive RLS correction is tested with multiple users and multiple circles. Do not work around this in browser JavaScript.

### 3. Existing group features available for later UI work

The production schema already has circle replies, events, event RSVPs, invites, activity, helpful votes, recognitions, and collaborations. These are preferable to creating duplicate systems, but their current policies and constraints must be reviewed before each feature is exposed.

### 4. Current PR #47 status

- UI-only feature branch; not merged and not deployed.
- No SQL, migration history, RLS policy, production row, or production schema was changed.
- The current UI only uses legacy circle/member/post tables for the fallback path.
- Phase 1-dependent UI remains gated by schema availability and RLS.
- This audit is a release blocker checklist, not evidence that production has passed end-to-end testing.

## Required next steps

1. Complete migration-history reconciliation and local replay documented in `supabase/drafts/README.md`.
2. Correct and validate the Phase 1 SQL locally; do not deploy it directly from the draft.
3. Review and fix the existing replies policy predicates in a separate migration proposal. Preserve existing policies unless the exact replacement is reviewed and approved.
4. Test public, member, owner, moderator, and administrator behavior using at least two different circles and multiple test identities.
5. Only then build replies, reactions/helpful votes, event and RSVP screens, and group moderation UI.
