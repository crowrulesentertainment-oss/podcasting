# CrowRules Podcasting — Distribution Upgrade 2

## Current behavior
- The Creator Distribution Center saves platform-specific episode drafts and supports approval, queue scheduling controls, and delivery-log display.
- Supabase stores queue metadata and delivery audit events with RLS.
- OAuth state and token-vault tables are private and not accessible to browser roles.
- The API and worker Edge Function source is committed under `supabase/functions/`, but deployment is currently blocked because this Supabase project has reached its Edge Function quota. Do not tell creators that connections or publishing are live until deployment and provider verification are complete.
- No social access tokens are collected by the browser. No external post is reported as published without a verified provider response.

## Before enabling live jobs
1. Resolve the project's Edge Function quota (upgrade plan or disable/remove an unrelated function only after an owner-approved review). Do not replace an unrelated function to make room.
2. Deploy `podcast-distribution-api` with JWT verification enabled.
3. Deploy `podcast-distribution-worker` with JWT verification disabled only because it validates the `x-worker-secret` header itself. Set a high-entropy `DISTRIBUTION_WORKER_SECRET`; keep it private.
4. Configure a trusted scheduler (Supabase Cron / pg_cron with a safe HTTP call or another secret-managed scheduler) to invoke the worker. Do not put the worker secret in client-side JavaScript.
5. Configure OAuth credentials, redirect URIs, scopes, app review and token refresh for each provider separately. The current API intentionally returns `not_configured` for social OAuth; this is not a connected-account implementation.
6. Implement and test one provider publishing adapter at a time, with idempotency, provider response validation, retry/backoff for transient errors, and manual fallback for unsupported media or missing permissions.
7. Confirm the token vault stores encrypted token material only. Never expose provider tokens to browser queries or logs.
8. Run end-to-end tests with test accounts before enabling real posts.

## Queue semantics
- `draft`: editable, not approved.
- `approved`: creator approved the caption, but it is not published.
- `queued`: waiting for a scheduled worker run.
- `manual_required`: safe fallback; creator must publish manually.
- `published`: only after a verified provider response and external post reference.
- `failed`: a delivery attempt failed; retry only when the failure is transient and the provider adapter is configured.

## Supported destinations
Facebook, Instagram, TikTok, YouTube, X, Threads and CrowRules are listed in the creator UI. Listing a platform is not evidence of authorization or direct-publishing support.
