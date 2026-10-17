# CrowRules Podcasting — Distribution Upgrade 2

## What is implemented
- Creator dashboard retains preview/edit/approve before queueing.
- A persistent queue stores approved jobs, scheduled time, idempotency key, attempt count, retry time, lease timestamp and worker ID.
- Atomic queue claiming uses `distribution_claim_jobs` with `FOR UPDATE SKIP LOCKED`, preventing two workers from claiming the same due job at once.
- The worker uses a lease-based queue claim, appends delivery audit events, and falls back to `manual_required` when no verified provider adapter exists. It does not claim that a post was published unless a provider response is verified.
- `distribution_retry_or_fail` supports bounded exponential retry for transient provider failures (30 seconds doubling per attempt, capped at six hours; five attempts by default). Provider adapters must call it with accurate retryability.
- `distribution_mark_published` only accepts the active worker lease and records the verified provider post ID/URL.
- Browser audit-log writes are RLS-limited to creator-originated events; provider delivery outcomes are worker/service-role writes.
- OAuth state storage has expiry and fields for PKCE verifier/redirect URI. Token storage columns are ciphertext-only; the encryption/decryption implementation and encryption key are not yet configured. Do not save provider tokens until server-side AES-GCM encryption using `DISTRIBUTION_TOKEN_ENCRYPTION_KEY` is implemented and tested.
- Social OAuth is not live yet: the API deliberately reports `not_configured` until each provider's callback, client credentials, scopes, token exchange/refresh and app-review requirements are implemented.

## Scheduling
The repository includes `.github/workflows/podcast-distribution-worker.yml`, which can call the worker every five minutes. Add these GitHub Actions repository secrets:
- `SUPABASE_URL`: project URL, e.g. `https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY`: publishable/anon key used for the Edge Function gateway `apikey` header
- `DISTRIBUTION_WORKER_SECRET`: high-entropy random secret matching the deployed worker's secret

The workflow is only a scheduler definition. It will fail until the worker Edge Function is deployed and the three secrets are configured. Never put service-role keys or the worker secret in browser code.

## Deployment blocker
The project previously reached its Edge Function quota. Resolve the quota with an owner-reviewed cleanup or plan change before deploying:
1. `podcast-distribution-api` with JWT verification enabled.
2. `podcast-distribution-worker` with JWT verification disabled only because it validates `x-worker-secret` itself.

Do not replace or delete an unrelated payment, membership, live-streaming, or recovery function to make room without reviewing its callers and getting explicit approval.

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
