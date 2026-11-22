# Community Groups Phase 0 — Production Schema & Authorization Audit

**Repository:** `crowrulesentertainment-oss/podcasting`  
**Audit branch:** `feature/community-groups-phase0-audit`  
**Audit date:** 2026-11-22  
**Scope:** Read-only inspection of the live Supabase catalog, RLS policies, constraints, Realtime publication, repository source, and existing Groups drafts.  
**Production changes:** None. No migrations, policies, grants, functions, or deployments were changed.

## Executive result

Community Groups should extend the existing Podcasting circle model. The production database already contains a useful feed, membership, event, RSVP, collaboration/poll-like, episode, profile, and badge foundation. It does **not** yet contain the circle-specific category directory, private join-request table, or circle chat table described in the Phase 1 draft.

The separate `crowspace_group_messages` system is not a drop-in replacement: it uses `crowspace_group_members` and `group_id`, not `podcast_community_circle_members` and `circle_id`. Its RLS and Realtime publication are real, but those do not prove access to Podcasting circles.

**Phase 0 is not cleared for migrations or production implementation.** The largest blocker is migration-history recovery: production records 1,445 migration versions while the default repository branch contains only 61 SQL migration files. Full local replay has not been demonstrated.

## 1. Production inventory

### Existing circle model

Confirmed production tables include:

- `podcast_community_circles`
- `podcast_community_circle_members`
- `podcast_community_circle_posts`
- `podcast_community_circle_replies`
- `podcast_community_circle_invites`
- `podcast_community_circle_events`
- `podcast_community_circle_event_rsvps`
- `podcast_community_circle_collaborations`
- `podcast_community_circle_collaboration_votes`
- `podcast_community_circle_activity`
- `podcast_community_circle_recognitions`
- `podcast_community_circle_reports`
- `podcast_community_circle_helpful_votes`
- `podcast_community_circle_notification_preferences`
- `podcast_community_circle_image_suggestions`

The live circle table already includes Groups 2.0 image-path fields (`avatar_image_path`, `banner_image_path`), and posts already include the Groups 2.0 post types, episode URL/title/artwork, media path, edit/delete timestamps, pinning, and reply-lock fields. The Phase 1 draft's newer `visibility`, `slug`, `category_id`, `group_chat_enabled`, and URL-based image metadata fields were not present in the inspected production schema. Keep the existing image-path fields; do not add duplicate image representations without a compatibility decision.

### Missing Phase 1 objects

These objects described by `supabase/drafts/community_groups_phase1.sql` were not present in production at audit time:

- `podcast_community_circle_categories`
- `podcast_community_circle_join_requests`
- `podcast_community_circle_messages`

The draft proposes a circle-specific message table keyed by `circle_id`, with authenticated membership checks and a Realtime publication addition. This is a candidate design only; it has not been applied or locally replayed.

### Separate CrowSpace chat model

Production also has:

- `crowspace_group_conversations`
- `crowspace_group_members`
- `crowspace_group_messages`
- `crowspace_group_message_attachments`

The chat RLS helpers check `crowspace_group_members` using `group_id`. These are separate from Podcasting circle membership. The message and attachment tables are in `supabase_realtime`; no `podcast_community_circle_*` table was in the inspected Realtime publication.

**Decision:** Do not point Community Groups chat at CrowSpace group messages. Use the reviewed circle-specific chat draft as a design input, then test its policies, grants, triggers, and Realtime behavior in a recovered local database.

## 2. Feature-by-feature assessment

| Feature | Production foundation | Required next work |
|---|---|---|
| Feed | Circle posts, replies, activity, reports, helpful votes | Reuse existing tables; run two-circle authorization and reply-lock regression tests |
| Profiles | `podcast_member_profiles` with public/activity/network/follower/following flags | Review field-level privacy before exposing profile rows in group cards or directories |
| Polls | Collaborations with `content_type='poll'`, JSON options, and vote table | Define poll open/closed lifecycle, edit rules, vote-change rules, and results visibility |
| Events | Circle events and RSVP table | Reuse after validating visibility, owner/moderator actions, and RSVP lifecycle |
| Episodes | `podcast_episodes`; collaboration has `episode_id`; posts store episode URL/title/artwork | Prefer catalog-backed episode references and preserve existing playback entitlements |
| Chat | Separate CrowSpace chat plus an unapplied circle-specific chat draft | Do not integrate the separate group chat IDs; validate and locally test circle chat design |
| Badges | 40 active/inactive catalog records and public/private assignment rows | Existing assignment target types are only profile/show/episode; define community awards without weakening existing constraints |

## 3. Authorization findings

### Existing RLS coverage

RLS was enabled on the inspected circle tables, member profiles, episode catalog, and badge catalog/assignment tables. Existing policies distinguish anonymous discovery, authenticated participation, group membership, post ownership, and owner/moderator operations.

Important existing protections include:

- Circle membership inserts require the authenticated user to join as a member of a public circle, or as owner of a circle they own.
- Post creation requires the authenticated author to be a member of the exact circle.
- Reply insertion checks the authenticated author, circle membership, matching parent-post circle, and that the post is not locked.
- Event creation is restricted to circle owners/moderators.
- RSVP rows are unique per event/user and constrained to `going`, `interested`, or `declined`.
- Collaboration votes are unique per collaboration/voter and validate the circle, poll option, voter identity, membership, and that the voter is not the poll author.
- Badge catalog management and badge assignment writes are restricted to platform administrators; public assignment reads are limited to rows marked public.

### Profile privacy needs a dedicated correction design

`podcast_member_profiles` has row-level SELECT policy:

`is_public = true OR auth.uid() = user_id`

The same table contains more than basic public identity fields, including location, interests, favorite media, social links, creator portfolio, and separate activity/network/follower/following visibility flags.

A row-level SELECT policy does not hide individual columns. Therefore, the flags must not be treated as database-enforced column privacy. A group profile card or member directory must not simply select every column from this table. Before profile UI work, define an explicit safe public projection (or equivalent column-level access design) and separate owner-only fields. Do not change the current policy as part of this audit.

The object `podcast_public_member_profiles` is a view over `creator_profiles`, not a base table. It has `security_barrier=true`, but is not marked `security_invoker=true`. The Supabase Security Advisor reports this view under the `security_definer_view` ERROR lint. It is a creator-discovery projection, not a confirmed Podcasting member profile API. Do not substitute it for the circle member profile contract without a separate view-owner/grant review. Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view.

### Poll lifecycle gap

The current collaboration poll model supports 2–8 JSON options and one vote per voter per collaboration. The vote table has a composite primary key on `(collaboration_id, voter_id)`.

The inspected poll schema has no dedicated `closes_at`/closed timestamp or explicit poll lifecycle state. Collaboration status values are workflow states (`submitted`, `under_review`, `approved`, `in_production`, `published`, `declined`), not a clearly defined voting lifecycle. Vote insertion policy validates membership/options/author identity but does not establish a poll closing-time rule.

**Decision:** Existing collaboration polls can be a foundation for basic polls, but must not be presented as a complete polls feature until open/close semantics, edit/delete vote behavior, results visibility, and concurrent voting tests are specified.

### Event model

The circle event schema already supports title, description, type, start/end times, location type/text, meeting URL, episode URL, status, and branch key. The database checks that end time follows start time and constrains event type/location/status values.

RSVP uniqueness is enforced by primary key `(event_id, user_id)`. RSVP insertion requires the caller's own user ID and membership in the event's circle while the event is scheduled. Existing event visibility is based on public circle status or membership.

**Decision:** Reuse this event model. Before extending it, test the behavior of RSVP updates after a member leaves, event cancellation, time zones, and public/private/hidden visibility.

### Badge model

The catalog contains 40 records. Assignment uniqueness is enforced by `(target_type, target_id, badge_key)`. Current target types are limited by a database check to `profile`, `show`, and `episode`. Assignment writes are administrator-only.

**Decision:** Do not add a new target type or allow client self-awards by weakening these constraints. Design community recognition as a verified award operation, with an explicit decision on whether it belongs in this catalog or a separate community achievement model.

## 4. Data integrity snapshot

The following read-only checks returned zero rows/counts at audit time:

- Replies whose parent post is missing or belongs to a different circle: **0**
- Collaboration votes whose collaboration/circle parent does not match: **0**
- Event RSVPs whose event is missing: **0**

These are point-in-time checks, not a substitute for ongoing constraints and automated tests.

## 5. Migration recovery blocker

Production migration ledger snapshot:

- Recorded migration versions: **1,445**
- The remote ledger includes `groups_2_0_production_upgrade` at version `20261122090848`. The corresponding timestamped SQL body was not found at the expected path in repository `main` or the reviewed connection-groups branch. Some Groups 2.0 columns are present in production, so the migration source and exact applied diff must be recovered before planning further additive changes.
- Latest recorded version: **20261122192634**
- Latest recorded migration name: `create_student_hub_private_foundation`
- SQL migration files on repository `main` at audit time: **61**

Repository Groups documentation itself says migration recovery and full local replay are release gates. The current Phase 1 and social-permissions draft SQL files are under `supabase/drafts/`, not production migration history. Do not infer that all Groups 2.0 work is unapplied: the production ledger records a Groups 2.0 upgrade and the database already has some of its schema changes.

**Required before migration work:**

1. Recover the full remote migration history with the Supabase CLI in a controlled local environment.
2. Reconcile repository and remote migration versions; resolve every mismatch.
3. Replay the complete database locally with `supabase db reset`.
4. Apply the Phase 1 draft and social-permissions patch only to the local disposable database.
5. Inspect actual grants, RLS, triggers, helper function privileges, Storage policies, and Realtime publication.
6. Run synthetic multi-identity security tests.
7. Save the local replay and test outputs for review.

No migration fetch, reset, or DDL was performed as part of this read-only audit.

## 6. Groups 2.0 migration-source recovery checkpoint

The original production-named migration file `supabase/migrations/20261122090848_groups_2_0_production_upgrade.sql` is **not present** on repository `main` or the reviewed Groups 2.0 branches. No PR or commit containing that timestamped migration file was found.

A source ancestor was recovered:
- Merged PR #77, **Build CrowRules Groups 2.0 community experience**: https://github.com/crowrulesentertainment-oss/podcasting/pull/77
- Its merged source file is `supabase/drafts/groups_2_0.sql`, blob SHA `7e838b2fa6bb302ec9fbc4d4241cdedd09814d18` (303 lines, 20,029 characters).
- The PR explicitly labels that SQL a review draft and states it was not applied to production at PR merge time.
- The remote migration ledger later records `20261122090848 / groups_2_0_production_upgrade`.

The live catalog now contains strong matching fingerprints from that draft:
- The same circle avatar/banner path columns.
- The same post metadata columns and partial feed index.
- The image-suggestion and post-report tables with matching columns and policy names.
- The `guard_circle_post_moderation_fields` and `apply_podcast_circle_image_suggestion` function definitions match the draft.
- The `podcast-group-media` private bucket has the same 8 MB limit and MIME allowlist.
- The matching post moderation, owner-delete, image-suggestion, report, and Storage policy names exist.

**Recovery conclusion:** the Groups 2.0 draft is a high-confidence source ancestor for the production upgrade, but it is not proof of the exact SQL body that was applied. The timestamped production migration source remains unrecovered. Do not rename or copy the draft into `supabase/migrations/` and do not replay it as though it were the original migration; it contains statements that would recreate or replace policies and functions.

### Recovered source defect requiring review

The live `Public group media is viewable` Storage SELECT policy references `storage.foldername(c.name)` inside its circle lookup instead of using the Storage object's `name` path. The same expression appears in the recovered draft. This is likely a defect in the public-media path check. It has not been changed. Keep the bucket private and do not claim anonymous public-group media access is working until this policy is corrected in a separately reviewed migration and tested.

## 7. Full migration replay status

The Supabase migration API returned **1,445** remote migration records, from `20260907232724` through `20261122192634`. The repository `main` tree contains **61** tracked SQL files under `supabase/migrations/`. The Groups 2.0 timestamped migration is not among them.

A full local replay cannot be declared successful from this repository state. Replaying only the 61 available files would omit most of the recorded migration history and could produce a misleading or invalid database. The read-only catalog API returns migration versions/names, not the original SQL bodies. A Supabase development branch would incur hourly compute charges; no branch was created.

**Required recovery input:** restore the complete migration directory or obtain a trusted database schema/migration backup that contains the missing migration bodies. Then reconcile versions, run the full local replay, and only after that execute the Groups 2.0 and Phase 1 test plans in an isolated local database.

### V7.51–V7.55 recovery archive investigation (read-only)

The existing recovery framework was inspected as a possible source for the missing migration bodies. This investigation queried the V7.51 recovery case, forensic snapshot, action, and certificate tables; the V7.53 drill ledger; the V7.55 readiness certificate; the V7.60 drill-run ledger; the archive table referenced by the recovery functions; and the relevant function definitions. No recovery function was invoked and no restore, approval, verification, or archive mutation was performed.

Observed production state:

- V7.51 recovery cases: **0**; forensic snapshots: **0**; recovery actions: **0**; V7.51 recovery certificates: **0**.
- V7.53 disaster drills: **1**, status **PASSED**, run on 2026-10-06. It references archive ID **1** and last-known-good ID **1**. Its recorded stages explicitly mark restore as **NON_DESTRUCTIVE / SIMULATE_RESTORE**; this is a simulation, not an executed restore.
- V7.55 readiness certificate: **1**, readiness score **100 / grade A**, chain validation **VALID**, referencing the same drill and archive ID. This certifies the simulation/readiness result, not the existence of a recoverable migration bundle.
- V7.60 recovery drill runs: **0**.
- The referenced archive table is cr_podcast_evidence_security_report_archive_v747. It contains **one** immutable, trusted SECURITY_OPERATIONS report archive. Its JSON payload is approximately **1.1 KB** and has report/operations summary fields (for example, audit integrity, security health, SLA certificate, incident summary, and report period); it is not a database backup or migration-source archive.

The V7.51 function definitions confirm that recovery operates on cr_podcast_evidence_security_report_archive_v747.report_payload: the restore function would create a new report archive from a trusted report snapshot. It does not restore PostgreSQL schema, migration files, or a repository tree. The recovery cases and forensic rows are empty, so there is no approved/verified V7.51 recovery case to inspect in any event.

**Recovery-route conclusion:** V7.51–V7.55 cannot supply the missing migration history. The single V7.53 PASS and V7.55 A-grade certificate are evidence of a successful non-destructive simulation only. They must not be interpreted as proof that a full database backup exists or that the 1,445 migration bodies are recoverable. No recovery operation was run. The full replay blocker remains unchanged.

## 8. Supabase advisor snapshot

The read-only Security Advisor run returned four lint categories. The relevant Community Groups finding was `public.podcast_public_member_profiles` under `security_definer_view` at ERROR level. The advisor also reported 73 RLS-enabled tables without policies and multiple executable SECURITY DEFINER functions across the wider project; the filtered results did not identify the inspected Podcasting circle tables or CrowSpace group chat tables among those no-policy findings. These project-wide counts are not attributed to Community Groups without table-by-table verification.

The Performance Advisor returned six duplicate-index findings elsewhere in the project; none of the filtered findings referenced the inspected circle tables. No performance changes were made.

## 9. Phase 1 implementation sequence after recovery

1. Reconcile migration history and obtain a successful local replay.
2. Run the existing two-circle data-integrity checks.
3. Validate the existing post/reply/roster policies with synthetic anonymous, member, author, moderator, owner, and admin identities.
4. Validate the Phase 1 categories, visibility compatibility, private join requests, and atomic approval RPC.
5. Validate the circle-specific chat draft, including exact-circle isolation, disabled chat, membership revocation, sender identity, edit/delete rules, and Realtime.
6. Run existing UI regression checks against the local database.
7. Only then prepare a reviewed migration and front-end implementation plan.

## 10. Release decision

**Status: BLOCKED — Phase 0 migration recovery and privacy review incomplete.**

Completed:
- Read-only production schema inventory for Community Groups resources.
- Read-only inspection of relevant RLS policies and constraints.
- Read-only inspection of Realtime publication membership.
- Repository review of Groups 2.0, multi-page workspace, Phase 1 SQL draft, and security test plans.
- Three point-in-time referential-integrity checks.

Not completed:
- Full migration-history recovery and local replay.
- Local execution of Phase 1 and social-permissions SQL.
- Synthetic multi-identity RLS/Realtime integration tests.
- Profile column-privacy design.
- Poll lifecycle design.
- Final production release review.

**Safety boundary:** This audit branch contains documentation only. No production schema, data, policies, grants, functions, Storage configuration, Stripe configuration, or deployed code was changed.
