# CrowRules Podcasting — Distribution Upgrade 2

## Implemented and verified
- Creator dashboard retains preview/edit/approve before queueing.
- Persistent queue stores approval, schedule, idempotency key, attempt count, retry time, lease timestamp, worker ID and delivery audit events.
- Supabase Edge Functions `podcast-distribution-api` (JWT verification enabled) and `podcast-distribution-worker` (JWT disabled; validates its own worker secret) are deployed.
- Atomic queue claiming uses `distribution_claim_jobs` with `FOR UPDATE SKIP LOCKED`. Expired worker leases can be reclaimed; exhausted leases are marked failed.
- `distribution_retry_or_fail` supports bounded exponential retry for transient provider failures (30 seconds doubling per attempt, capped at six hours; five attempts by default).
- `distribution_mark_published` only accepts the active worker lease and records the verified provider post ID/URL.
- Browser audit-log writes are RLS-limited to creator-originated events; provider delivery outcomes are worker/service-role writes. RLS is enabled on the delivery log and function grants were checked.
- OAuth state storage has expiry and fields for PKCE verifier/redirect URI. Token table columns are ciphertext-only. However, OAuth callback/token exchange and AES-GCM encryption/decryption are not implemented yet; do not save provider tokens until encryption using a secret `DISTRIBUTION_TOKEN_ENCRYPTION_KEY` is implemented and tested.
- Social OAuth remains intentionally `not_configured`; no external social account is represented as connected.

## Enable scheduled queue processing
The repository includes `.github/workflows/podcast-distribution-worker.yml`, intended to call the worker every five minutes. Add these GitHub Actions repository secrets:
- `SUPABASE_URL`: project URL.
- `SUPABASE_ANON_KEY`: publishable/anon key used for the Edge Function gateway `apikey` header.
- `DISTRIBUTION_WORKER_SECRET`: high-entropy random secret.

Then set the exact same `DISTRIBUTION_WORKER_SECRET` in Supabase Edge Function secrets. The scheduler will not run successfully until these secrets are set. Never put service-role keys or the worker secret in browser code.

## Current worker behavior
The worker claims due jobs atomically and writes a delivery log. Since no verified platform publishing adapters are enabled, it moves claimed jobs to `manual_required` rather than sending a post. The retry RPC is ready for adapters to classify transient errors, but no external publishing retries can occur until a real adapter is implemented.

## Queue states
- `draft`: editable, not approved.
- `approved`: creator approval recorded; not published.
- `queued`: waiting for a scheduled worker run.
- `publishing`: leased by a worker; not yet confirmed published.
- `manual_required`: safe fallback; creator must publish manually.
- `published`: only after a verified provider response and external post reference.
- `failed`: retry limit reached or a non-retryable provider failure was recorded.

## Before enabling real social publishing
1. Implement a real OAuth start/callback for each provider, use cryptographically random state and PKCE where supported, validate state/expiry/redirect URI, and store only encrypted token ciphertext in the private schema.
2. Configure provider client IDs/secrets, approved redirect URIs, scopes, token refresh and required app review.
3. Implement and test one official publishing adapter at a time. Validate provider response IDs and URLs, classify retryable versus permanent errors, and make requests idempotent.
4. Test schedule, cancel, expired lease recovery, retry/backoff, duplicate-worker concurrency, revoked tokens and permission errors with test accounts.
5. Verify end-to-end before showing a connection as connected or a post as published.

## Supported destinations
Facebook, Instagram, TikTok, YouTube, X, Threads and CrowRules appear in the UI. Listing a platform is not evidence of authorization or direct-publishing support.
