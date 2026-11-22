# Shared Membership Stripe Webhook Reliability Patch Proposal

**Status:** Review-only proposal. Not deployable.  
**Target:** `membership-stripe-webhook` and `sync_member_membership_from_subscription(uuid)`  
**Production project:** `cevylpnoexugwgygvtgu`  
**Prepared:** 2026-11-22

## Safety boundary

This document is a patch design and test plan only. It is not an executable migration, Edge Function source replacement, or authorization to change production. No production data, schema, secrets, Stripe objects, Edge Functions, policies, or grants were changed to prepare it.

Do not activate `membership_sites.site_key='crowrules-plus'` or create CrowRules+ entitlement rows as part of this patch.

## Verified current behavior

The deployed `membership-stripe-webhook` (version 77, `verify_jwt=false`) uses a custom Web Crypto HMAC verifier, parses Stripe events, and writes membership rows with Supabase service-role access. It handles checkout completion, subscription created/updated/deleted, and invoice paid/payment-failed events.

The implementation currently:
- Does not enforce a Stripe signature timestamp tolerance.
- Does not persist membership webhook event IDs or claim events atomically.
- Does not consistently inspect Supabase write/RPC errors before returning HTTP 200.
- Uses event payload subscription objects directly rather than retrieving the canonical current Stripe subscription.
- Resolves plans by the first subscription item's `stripe_price_id`.
- Calls `sync_member_membership_from_subscription` for global plans without checking the RPC result.

The current database function selects from `membership_subscriptions` by user ID but does not include `site_key IS NULL`. It can therefore select a site-specific subscription when deriving the shared `members.membership_type`. If no subscription is found, it resets the member to Free.

A separate `stripe_billing_webhook_events` table exists with a unique `stripe_event_id`, but it is used by the separate podcast/creator billing webhook. Do not reuse this event ledger without an explicit shared-endpoint design: separate Stripe webhook destinations may receive the same Stripe event ID and would then collide.

## Proposed narrow implementation

### 1. Standard Stripe signature verification

- Replace the custom HMAC verifier with the official Stripe SDK webhook construction/verification method already used by the deployed `stripe-billing-webhook` function.
- Require the raw request body and the `Stripe-Signature` header.
- Use the SDK's standard bounded timestamp tolerance (explicitly set and documented; default 300 seconds unless the deployed Stripe SDK version requires a different supported option).
- Return HTTP 400 for missing/invalid/expired signatures.
- Never log the raw payload, signature, secrets, customer email, or payment details.

### 2. Dedicated membership event ledger and idempotent claim

Add a dedicated table in a future, separately reviewed migration, for example `membership_stripe_webhook_events`, with:
- `stripe_event_id` UNIQUE NOT NULL
- `event_type` NOT NULL
- `stripe_created_at` NOT NULL
- `status` constrained to `received`, `processing`, `processed`, `failed`
- `received_at`, `processing_started_at`, `processed_at`
- `attempt_count` and a bounded/sanitized `error_code`
- Optional `stripe_subscription_id` for diagnostics

Do not persist full event payloads unless a separate privacy and retention review approves it.

Use a small SECURITY DEFINER claim/finish RPC pair or equivalent transaction-safe mechanism:
- Claim with a unique event ID insert.
- If already `processed`, return a duplicate-success response without reapplying changes.
- If `processing`, do not run a concurrent duplicate; return a retryable response or let a lease expire.
- If `failed`, allow a bounded retry and increment attempt count.
- Finish as `processed` only after all required database writes and membership synchronization succeed.
- Finish as `failed` on processing errors, then return HTTP 500 so Stripe retries.
- Ensure stale `processing` claims can be safely recovered after a bounded lease.
- Lock down table access: no direct anon/authenticated writes; service-role/controlled RPC only. Add RLS if required by project convention.

The event ledger must be dedicated to the membership webhook. Do not collide with `stripe_billing_webhook_events` rows produced by the podcast billing endpoint.

### 3. Canonical subscription state and event ordering

For subscription lifecycle events:
- Validate event type and extract the subscription ID.
- Retrieve the current subscription from Stripe using the configured Stripe secret and the correct connected-account context, if applicable.
- Resolve the plan from the canonical current subscription item's price ID, not stale metadata alone.
- Persist the current canonical status, period, cancellation fields, customer ID, plan ID, and site key.
- Store the Stripe event's `created` timestamp as the last processed event timestamp for that subscription.
- Perform the upsert through a transaction-safe database RPC that rejects an event whose `stripe_created_at` is older than the stored timestamp.
- For events with equal `created` timestamps, do not decide ordering by lexical event ID. Re-fetch canonical Stripe subscription state immediately before the guarded write; add a concurrency test for equal-timestamp events. If the implementation cannot guarantee this safely, serialize processing per subscription with a database lock/RPC.

Do not let an unrecognized price silently preserve stale access. On unresolved price mapping, record a sanitized processing failure and return HTTP 500 for retry/operations review. Do not revoke access automatically until the intended unknown-price behavior is explicitly approved.

### 4. Checked writes and failure behavior

Every membership write must inspect and propagate its Supabase error:
- membership subscription upsert
- global member synchronization RPC
- event-ledger claim and finish operations

Only return HTTP 2xx after the subscription row and any required global member synchronization have succeeded and the event has been marked processed. Return HTTP 500 for transient database/Stripe failures so Stripe retries. Return HTTP 400 only for invalid request/signature or permanently unsupported payload shape. Avoid exposing internal error text to the caller; log a correlation ID, Stripe event ID, operation name, and sanitized error code.

### 5. Global-only member synchronization

Change `sync_member_membership_from_subscription(p_user_id)` so its source query explicitly filters:

```sql
where ms.user_id = p_user_id
  and ms.site_key is null
```

Keep the existing plan-to-member mapping unless a separate product decision changes it:
- `founder` → `Owner`
- `creator` → `Creator`
- `crowner` → `Pro`
- Other plan keys → existing Free fallback (flag for review rather than broadening this patch)

Preserve current active/pending versus suspended behavior pending a documented billing/grace-period decision. In particular, do not change the treatment of `past_due`, `trialing`, or `paused` as part of the site-scope fix without confirming the intended membership policy.

When no global subscription exists, the function may continue to set the shared member to Free; site-specific subscriptions must never be considered when choosing the global membership.

### 6. Checkout and invoice events

- On `checkout.session.completed`, retrieve the Stripe subscription and process it through the same canonical upsert path; avoid a second, divergent membership-write implementation.
- Treat `invoice.paid` and `invoice.payment_failed` as prompts to retrieve the current subscription and reconcile it through the same path. Do not independently set a subscription status from an old invoice event if Stripe currently reports a newer state.
- Preserve the current status mapping until billing requirements are confirmed.
- Ignore unrelated event types with a successful acknowledgement, while still recording them only if the endpoint is intentionally configured to receive them.

## Required automated regression tests

| Test | Setup / event | Expected result |
|---|---|---|
| Valid signature | Current signed event | Accepted and processed |
| Missing signature | No `Stripe-Signature` | HTTP 400; no writes |
| Invalid signature | Tampered body/signature | HTTP 400; no writes |
| Expired signature | Valid HMAC with timestamp outside tolerance | HTTP 400; no writes |
| Duplicate event | Same event ID delivered twice | One effective membership update; second delivery reports duplicate |
| Concurrent duplicate | Same event ID delivered concurrently | Exactly one processor owns the claim |
| Failed subscription upsert | Force DB upsert failure | Event marked failed where possible; HTTP 500; retry can recover |
| Failed member sync RPC | Force RPC failure for global plan | Not marked processed; HTTP 500 |
| Failed event finish | Event ledger finish fails | No success response; retry/reconciliation path remains possible |
| Out-of-order event | Newer event processed, then older event | Older event cannot overwrite newer state |
| Equal event timestamps | Two events for same subscription with same `created` | Canonical Stripe state and per-subscription serialization prevent stale overwrite |
| Price changed | Subscription now has a different mapped price | Canonical price determines current plan |
| Unknown price | Current price has no plan mapping | No silent stale-access success; retry/operations review |
| Global subscription | `site_key IS NULL` | Updates global member plan as before |
| Site-only subscription | User has only a non-null `site_key` subscription | Does not grant or change global member plan |
| Global + site subscription | Both rows exist, site row is newer | Global sync selects only the global row |
| Site subscription cancellation | Site subscription deleted/cancelled | Does not reset or downgrade global membership |
| Global cancellation | Global subscription deleted/cancelled | Global member state follows the existing approved mapping |
| Invoice event stale | Old invoice failure after a newer successful subscription update | Canonical Stripe state wins; no stale downgrade |
| Unrelated event | Event type not handled by membership endpoint | Safe acknowledgement; no membership mutation |

## Rollout sequence — future approval required

1. Implement unit tests and a mocked Stripe/Supabase integration harness first.
2. Prepare a dedicated migration for the membership event ledger and guarded RPCs; review RLS, grants, function search paths, and idempotency semantics.
3. Patch the Edge Function in source control only.
4. Run static checks, Deno tests, and the full regression matrix.
5. Deploy to a non-production Supabase project and replay signed test fixtures.
6. Verify retry behavior and event ordering with Stripe test mode.
7. Review the exact production diff, migration, rollback plan, and Stripe webhook configuration.
8. Obtain explicit approval before any production migration, function deployment, or CrowRules+ site activation.

## Explicitly out of scope

- Activating the `crowrules-plus` site.
- Creating or changing CrowRules+ plan entitlement rows.
- Changing CROWNER/CREATOR/FOUNDER prices or Stripe products.
- Changing membership plan semantics, grace periods, or member-level mappings.
- Changing RLS/grants on existing membership tables.
- Editing or deploying the production Edge Function.
- Changing live Stripe subscriptions or webhook destinations.

## Review outcome

The narrowest justified correction is to scope the legacy member synchronization to global subscriptions only and make the webhook's event processing reliable and replay-safe. The proposal deliberately separates these code changes from the unresolved product decision about whether CrowRules+ should use global shared membership or a site-scoped plan.
