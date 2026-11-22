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


## Shared membership and entitlement integration trace (read-only, 2026-11-22)

### Confirmed shared membership architecture

The production database has a shared membership model beyond the two CR+ views:

- `members` stores the user's shared `membership_type`, role, status, points, watch minutes, and profile/suspension fields.
- `membership_plans` defines four shared plans: CROW (free), CROWNER ($5/month), CREATOR ($10/month), and FOUNDER ($25/month). The paid plans have Stripe product/price identifiers configured. Public active-plan reads are enabled by RLS.
- `membership_sites` registers product/site keys.
- `membership_entitlements` maps a plan to a site key, access level, and feature list.
- `membership_subscriptions` records user, plan, status, Stripe identifiers, billing period, cancellation flag, and optional site key.
- `crplus_universal_membership` is a view over `members` joined to `membership_plans`, not a separate CR+ subscriber ledger.

### CrowRules+ site registration is not active

The `membership_sites` row for `crowrules-plus` is present but `is_active=false`. It has **no matching entitlement rows**. By contrast, the existing `creators`, `crowspace`, `dreamscapes`, `entertainment`, `holidays`, `members`, `memorials`, `podcasting`, `sports`, and `yearbooks` site keys have plan entitlement mappings. Some other registered sites are inactive.

This is the strongest recovered current-state fact about the CR+ membership connection: CrowRules+ is registered in the shared site directory but is not presently activated or mapped to plan entitlements.

### Current subscription data shape

A privacy-preserving aggregate query found two rows in `membership_subscriptions`, both `active`, both with a `plan_id`, neither with a `site_key`, and neither with a `stripe_subscription_id`. No user IDs, customer IDs, or payment identifiers were retrieved for this check.

### Important policy-review finding — site scoping

The current `membership_entitlements_authenticated_read` policy allows an authenticated user to read an entitlement row when a row exists in `membership_subscriptions` for that user with the same `plan_id` and a status of `active`, `trialing`, or `past_due`.

The policy does **not** compare `membership_subscriptions.site_key` with `membership_entitlements.site_key`. Since the subscription rows currently have null `site_key` values and entitlements are replicated across many sites, the policy as written appears to authorize all site entitlement rows for a user who holds a matching plan, rather than limiting the read to one site. This may be intentional for universal cross-site membership, but it is not proven by the missing CR+ app contract. Record this as a **scope decision / potential overexposure**, not as a confirmed vulnerability, until the intended universal-membership model is confirmed.

The same policy accepts `past_due` as entitlement-bearing. That may be an intentional grace-period rule; do not remove it without the billing and product requirements.

### Existing access controls observed

- `membership_sites` has public SELECT limited to active sites.
- `membership_entitlements` has an authenticated SELECT policy based on the user's subscription/plan.
- `membership_subscriptions` has authenticated self-read policies.
- `members` has owner/admin write policies and a self-read policy; its admin policies rely on trusted JWT app-metadata role claims and/or the existing hub-admin/admin helper paths.
- `membership_plans` has public SELECT for active plans. Its table-level grants are broader than SELECT, but RLS exposes only a SELECT policy; no insert/update/delete policy was observed in the current policy listing.

No policies, grants, subscriptions, membership rows, site registrations, or entitlements were changed.

## Updated CR+ recovery decision

Do not create CR+ entitlement rows yet. First establish whether CrowRules+ should participate in the existing universal cross-site membership model, and whether the shared plan's features are intended to unlock CR+ catalog/playback features or only general community/supporter benefits. The original CR+ migrations and frontend contract are still missing, and the production site is explicitly inactive today.


## Stripe membership lifecycle trace (read-only, 2026-11-22)

### Deployed membership checkout and webhook functions

Production Edge Function inspection (no invocation or mutation) found:

- `membership-checkout` — ACTIVE, version 81, JWT verification enabled. Authenticates the caller with Supabase, restricts global paid plans to `crowner`, `creator`, and `founder`, reads the active plan's Stripe price, and creates a Stripe subscription Checkout Session. It supports embedded and hosted Checkout. For an existing global subscription, it allows upgrades to a higher `sort_order` by changing the Stripe subscription item's price with prorations.
- `membership-stripe-webhook` — ACTIVE, version 77, JWT verification disabled as expected for a Stripe webhook. It verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET`, processes checkout completion, subscription create/update/delete, and invoice paid/payment-failed events, then upserts `membership_subscriptions` and calls `sync_member_membership_from_subscription` for global (null-site) plans.
- `membership-status` — ACTIVE, version 75, JWT verification enabled. Calls `get_my_membership`, lists active sites, returns global entitlements and website-specific membership/entitlement data.
- `membership-portal` — ACTIVE, version 76, JWT verification enabled. Uses the authenticated user's own membership or podcast subscription customer ID to create a Stripe Billing Portal session.

### Checkout-to-entitlement path

1. An authenticated member selects a paid global plan.
2. `membership-checkout` reads the active `membership_plans` row and its `stripe_price_id`.
3. Stripe Checkout creates a subscription with `metadata.user_id` and `metadata.plan_key` (and `client_reference_id` on hosted Checkout).
4. `membership-stripe-webhook` verifies the signed event and resolves the member and plan from the subscription metadata / Stripe price ID.
5. The webhook upserts `membership_subscriptions` by `stripe_subscription_id`.
6. For global plans (`site_key IS NULL`), it calls `sync_member_membership_from_subscription` to update the legacy `members.membership_type` and `members.status`.
7. `membership-status` reads the resulting membership and entitlements.

### Verified lifecycle mapping

The membership webhook currently maps Stripe subscription statuses as follows:

| Stripe status/event | Stored membership status |
|---|---|
| `active`, `trialing` | `active` |
| `past_due`, `incomplete`, `incomplete_expired`, `unpaid` | `pending` |
| `paused` | `paused` |
| `canceled` or subscription-deleted event | `cancelled` |
| Other statuses | `expired` |

Invoice paid changes the membership subscription to `active`; invoice payment failed changes it to `pending`. The database status constraint accepts `pending`, `active`, `paused`, `cancelled`, and `expired`.

### Important implementation risks to resolve before activating CrowRules+

These are code-level observations, not evidence of a currently exploited vulnerability:

1. **Webhook persistence errors are not consistently checked.** In `membership-stripe-webhook`, membership upsert and `sync_member_membership_from_subscription` RPC errors are not checked before returning HTTP 200. A database failure could therefore be acknowledged to Stripe as successfully processed, preventing a retry.
2. **The membership webhook has no event ledger / duplicate-event state machine.** The subscription upsert is keyed by Stripe subscription ID, which helps with duplicate delivery, but the webhook does not persist event IDs or guard against older events arriving after newer events. An out-of-order event could overwrite a newer subscription state.
3. **The custom signature verifier does not enforce a timestamp tolerance.** It checks the HMAC signature but does not reject old signed payloads. Stripe's standard SDK verifier in the separate `stripe-billing-webhook` does perform the standard verification flow. Review whether the membership webhook should use the same SDK verification approach and a bounded tolerance.
4. **Global member synchronization does not filter to global subscriptions.** `sync_member_membership_from_subscription(p_user_id)` selects the user's membership subscription without `site_key IS NULL`. It can therefore choose a site-scoped subscription if one exists. It also maps only `founder`, `creator`, and `crowner` to legacy member types; every other plan maps to `Free`. The function maps only `active` and `pending` to member status `Active`; `trialing`, `past_due`, and `paused` can become `Suspended`, despite the membership read/entitlement paths treating some of those statuses as eligible. This is a potential cross-product/status consistency defect to review against the intended model.
5. **Webhook plan resolution depends on the current Stripe price mapping.** Subscription events resolve the plan from the first subscription item's price ID. If no plan matches, the current code does not update the stored membership row for that event. Ensure cancellation/price-change cases cannot leave stale access if a price mapping is removed or changed.
6. **Site-specific checkout is not ready for CrowRules+.** The checkout function requires an active `membership_sites` row and a matching active plan with that `site_key`; the CR+ site is currently inactive and has no entitlements. No activation or plan mapping was performed.

### Separate Stripe billing webhook

A second active Edge Function, `stripe-billing-webhook` (version 82), uses the Stripe SDK's webhook signature verification and writes to `stripe_billing_webhook_events` and `stripe_billing_subscriptions`, with podcast creator revenue handling. Its observed code does not write to `membership_subscriptions` or `membership_entitlements`. It should not be mistaken for the shared membership entitlement webhook.

### Production data limitation

The earlier privacy-preserving aggregate showed only two `membership_subscriptions` rows, both `active`, with a plan ID but no site key and no Stripe subscription ID. Thus the deployed integration code is present, but the current production rows do not demonstrate a populated Stripe-linked membership lifecycle. No Stripe account objects, customer records, emails, or individual member identities were queried.

### No changes made

No Edge Functions were invoked, redeployed, or modified. No Stripe API writes were made. No production database records, policies, grants, or schema were changed.

## Recommended next review checkpoint

Before enabling CrowRules+, make a narrowly scoped design decision on whether CR+ uses the global shared plans or a separate site-scoped plan. Then prepare (but do not apply) a minimal webhook reliability patch proposal covering: checked database writes and non-200 failure responses, Stripe event-ID idempotency / ordering, standard timestamp-tolerant signature verification, and global-only membership synchronization. Preserve current plan prices and member entitlements while doing this review.


## Webhook reliability proposal prepared (review-only, 2026-11-22)

A separate, non-deployable patch proposal is now recorded at:

`docs/MEMBERSHIP-STRIPE-WEBHOOK-RELIABILITY-PATCH-PROPOSAL.md`

It specifies standard Stripe timestamp-tolerant signature verification, a dedicated membership webhook event ledger (not the separate podcast billing ledger), atomic event claims and retry handling, canonical subscription retrieval and event-order protection, checked database writes, and global-only membership synchronization. It includes a regression matrix covering duplicate/concurrent events, invalid/expired signatures, failed writes, out-of-order/equal-timestamp events, price changes, and global-versus-site-scoped subscription combinations.

The production `sync_member_membership_from_subscription(uuid)` definition was inspected and confirms it currently selects a user's subscription without filtering `site_key IS NULL`. The proposal preserves current plan mappings and status/grace-period semantics; those require a separate product decision.

**No implementation or deployment was performed.** The proposal contains no executable migration and no production changes were made.


## Isolated membership webhook contract tests (2026-11-22)

Added:
- `scripts/membership-webhook-contract.test.mjs` — isolated Node.js contract harness.
- `.github/workflows/membership-webhook-contract.yml` — CI workflow for the harness.

GitHub Actions run **#45079621025** completed successfully:
https://github.com/crowrulesentertainment-oss/podcasting/actions/runs/45079621025

Result: **21 tests passed, 0 failed**. Coverage includes signature acceptance/rejection and timestamp tolerance, duplicate and concurrent event claims, failed-event retry, event ordering, global-versus-site subscription selection, checked-write failure behavior, and unmapped price handling.

**Important limitation:** these are isolated contract/model tests, not integration tests of the deployed Edge Function, real Stripe SDK verification, PostgreSQL locking/RPC behavior, or Supabase persistence. They validate the expected contract only. The actual webhook implementation and database migration remain unmodified; integration tests must be added when implementation is prepared in a disposable Supabase project.


## Disposable PostgreSQL integration tests (2026-11-22)

Added a PostgreSQL 16 CI job and isolated SQL fixtures:

- `supabase/tests/membership_webhook_postgres.integration.sql`
- `supabase/tests/membership_webhook_concurrency.setup.sql`
- `.github/workflows/membership-webhook-postgres.yml`

Successful GitHub Actions run **#45079944062**:
https://github.com/crowrulesentertainment-oss/podcasting/actions/runs/45079944062

All job steps passed, including:
1. Disposable PostgreSQL 16 startup.
2. SQL assertions for event claim/duplicate/retry/finish behavior.
3. Older/equal/newer subscription event ordering guards.
4. Global membership synchronization isolation from site-scoped subscriptions.
5. A two-session concurrent claim race proving exactly one claimant and one busy duplicate response.

The SQL fixture uses its own `webhook_it` and `webhook_race_it` schemas in an ephemeral CI PostgreSQL service. Its main behavior fixture runs inside a transaction and rolls back. No connection to the production Supabase project is configured or used.

**Critical limitation:** these tests exercise an isolated reference implementation of the proposed database contract, not the production `sync_member_membership_from_subscription(uuid)` function or a future membership event-ledger migration. They establish PostgreSQL behavior for the design, not production integration correctness. The production Edge Function, database schema, grants, policies, Stripe configuration, and membership data remain unchanged.
