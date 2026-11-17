# Security Remediation — Phase 2

Status: assessment and implementation plan only. No production storage, Edge Function, Stripe, LiveKit, or database configuration has been changed by this phase.

## Confirmed live findings

### 1. Draft recordings and storage boundaries

The live Storage configuration contains distinct buckets with different security characteristics:

- `crowrules-podcast-published`: public bucket, 50 GiB per-file limit, media MIME allowlist. Its object policies include public reads and authenticated owner uploads. Uploading a draft here makes it retrievable through public object URLs.
- `crowrules-podcast-studio`: private bucket, 500 MiB per-file limit, media/document MIME allowlist, owner-scoped read/write policies.
- `podcast-premium`: private bucket, but no bucket-level file-size limit or MIME allowlist is configured. The `premium-media-upload` function writes directly here.
- `podcast-live-recordings`: private bucket, 500 MiB limit, audio MIME allowlist, owner-scoped access.

Do not convert the published bucket to private in-place: that could break existing episode playback, embeds, RSS feeds, and external links. Preserve existing public objects and delivery URLs.

Target design:
1. New drafts go to a private draft/studio location under an authenticated creator-owned path.
2. Draft access uses owner/admin authorization and short-lived signed URLs.
3. Publishing is an explicit server-side transition: verify creator/podcast/episode ownership and approval/status, then copy or move the approved final asset into the public delivery bucket.
4. Never make an existing draft public merely because a creator uploaded it; keep the existing published assets and URLs intact during migration.
5. Inventory current objects and database references before any copy, move, bucket policy, or cleanup operation.

### 2. Premium upload validation

The deployed `premium-media-upload` function:
- manually validates the bearer token with Supabase Auth (gateway `verify_jwt=false`);
- checks episode ownership against the authenticated user / creator mapping;
- accepts multipart uploads, but does not enforce a function-level maximum byte count, MIME allowlist, or file signature checks;
- writes to `podcast-premium`, whose bucket currently has no size or MIME restrictions.

Target controls:
- retain the current manual authentication unless a compatible gateway-JWT migration is tested;
- enforce a conservative per-media-type byte limit before reading the entire body into memory;
- allow only the formats the player/transcoder supports;
- compare claimed MIME and extension with file signatures (magic bytes); reject mismatches;
- normalize generated object names; do not trust client filenames;
- add per-user upload quotas and request throttling;
- keep private storage and existing premium entitlement checks;
- test valid audio/video, oversize, spoofed MIME, wrong-owner episode, and unauthenticated requests.

Do not set a bucket limit lower than existing legitimate media needs without reviewing current object sizes and product limits.

### 3. Stripe redirect validation

The deployed checkout, membership, Connect onboarding, and subscription-center functions accept browser-provided origin or return URLs in at least some flows. CORS restrictions are not a redirect allowlist.

Target controls:
- define exact approved HTTPS origins for the production GitHub Pages site and any explicitly approved custom domain;
- construct return paths server-side from fixed route constants;
- reject userinfo, unexpected ports, non-HTTPS URLs, unapproved hosts, and arbitrary external redirect destinations;
- for Connect, validate both `return_url` and `refresh_url`;
- for Billing Portal, derive the return URL from a fixed trusted origin;
- preserve current successful/cancelled routes and query parameters;
- test all Stripe flows in test mode before deployment.

### 4. Endpoint abuse protection

Add durable, server-side rate limits to public/high-cost endpoints (including presence writes, application submissions, upload initiation, checkout/session creation, and token issuance). Prefer an atomic database-backed limiter or a managed edge rate-limit service; do not rely on in-memory counters in serverless functions. Use per-user limits for authenticated operations and carefully designed IP/network limits for anonymous operations. Return 429 with Retry-After, log abuse signals without storing unnecessary personal data, and avoid throttling normal playback or live participation.

### 5. LiveKit authorization

The LiveKit token service is hosted outside this repository (the Podcasting codebase search did not locate its implementation). Its Render service must be inspected before changing client or server behavior.

Required server-side checks:
- verify Supabase JWT with Auth; never trust a client-supplied user ID, role, room identity, or admin flag;
- resolve the requested room against an existing podcast/live session;
- verify room membership, host/guest/producer/admin role and session status in trusted database records;
- issue least-privilege LiveKit grants (publish/subscribe/data permissions only as required);
- enforce room-scoped identity and token TTL; prevent arbitrary room names and role escalation;
- apply token issuance rate limits and audit logs;
- verify recording/egress permissions separately from participant publish permissions.

## Deployment and verification gates

- All changes remain in a review branch / pull request until reviewed.
- No production bucket is made private, no data is moved or deleted, no Stripe configuration is changed, and no LiveKit service is redeployed as part of assessment.
- Deploy each isolated change only after its compatibility tests pass.
- Verify with owner/non-owner, anonymous/authenticated, draft/published, valid/invalid media, Stripe test-mode redirects, and LiveKit role-escalation cases.
- Re-run Supabase security advisors and inspect relevant logs after deployment.
- Security status remains **not yet verified / not certified** until every gate is completed.


## LiveKit authorization implementation draft

A coordinated LiveKit implementation is now prepared on this branch:

- New migration: `supabase/migrations/20261114000200_livekit_session_authorization.sql`.
- Token service: `livekit-token-service/server.js`.
- Browser integration: `assets/js/app.js`.
- Deployment instructions: `livekit-token-service/README.md`.
- Detailed findings and limitations: `LIVEKIT_SECURITY_ASSESSMENT.md`.

The new backend requires a Render-only `SUPABASE_SERVICE_ROLE_KEY`. Configure it as a secret only after staging validation; never expose it to the browser or repository. The new client requires the matching backend endpoints, so the migration, secret configuration, Render deployment, and GitHub Pages client update must be rolled out in a coordinated order. Render currently auto-deploys from `main`; merging without preparation can interrupt LiveKit studio sessions and new room creation.

JavaScript syntax parsing passed for the updated token service and browser application. Integration tests and migration execution have not yet been performed. No production changes have been made.
