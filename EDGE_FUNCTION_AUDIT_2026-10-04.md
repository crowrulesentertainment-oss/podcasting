# CrowRules Podcasting Edge Function Audit — 2026-10-04

## Scope
Audited the Podcasting repository source tree and the connected Supabase project `cevylpnoexugwgygvtgu` for browser-side Edge Function configuration, `supabase.functions.invoke()` usage, direct `/functions/v1/` calls, and configured function names.

## Confirmed active functions used by the site
- `crowrules-admin-api`
- `membership-checkout`
- `podcast-pipeline`
- `podcast-rss`
- `podcast-subscription-center`
- `creator-connect-onboarding`
- `create-podcast-product`
- `manage-podcast-product`
- `create-podcast-checkout`

All of these names were confirmed active in the connected Supabase project.

## Call sites identified
### Admin
`admin.html`
- Multiple `supabase.functions.invoke(window.CROW_CONFIG.adminFunction, ...)` calls for V4–V18 control, relationships, creator operations, alerts, automation, command center, live ops, and financial/admin actions.
- Configuration now resolves `adminFunction` to `crowrules-admin-api`.

### Episode pipeline
`create-episode.html` and `episode-studio.html`
- Invoke `CROW_CONFIG.pipelineFunction` for episode creation and upload-completed audit events.
- Configuration now resolves `pipelineFunction` to `podcast-pipeline`.

### Membership
`js/podcasting.js`
- Invokes `membership-checkout`.
- Supabase confirms `membership-checkout` is ACTIVE.

### Subscription center
`account.html`
- Directly calls `/functions/v1/${podcastSubscriptionCenterFunction||"podcast-subscription-center"}`.
- Configuration now explicitly defines `podcastSubscriptionCenterFunction`.

### Creator Stripe
`creator-plans.html`
- Uses `create-podcast-product`.
- Uses `manage-podcast-product`.
- Both are ACTIVE.

`creator-monetization-center.html`
- Uses `manage-podcast-product`.
- ACTIVE.

`creator-subscriptions.html`
- Uses `create-podcast-checkout`.
- ACTIVE.

`creator-payouts.html`
- Uses `creator-connect-onboarding`.
- ACTIVE.

### RSS
`distribution.html`
- Uses configured `rssFunction`, with fallback `podcast-rss`.
- Supabase confirms `podcast-rss` is ACTIVE.

### Generic Stripe integration
`js/crow-podcasting-integrations-v1.js`
- Builds `/functions/v1/<functionName>` dynamically.
- Therefore function names passed into `CROW_STRIPE_CHECKOUT` / `CROW_STRIPE_PORTAL` must be validated against the active Supabase function inventory.

## Configuration corrected
`js/config.js` now explicitly defines:
- `adminFunction: "crowrules-admin-api"`
- `pipelineFunction: "podcast-pipeline"`
- `rssFunction: "podcast-rss"`
- `podcastSubscriptionCenterFunction: "podcast-subscription-center"`
- `creatorProductFunction: "create-podcast-product"`
- `manageProductFunction: "manage-podcast-product"`
- `podcastCheckoutFunction: "create-podcast-checkout"`

## Important repository/deployment drift
The GitHub repository currently contains only four Edge Function source directories under `supabase/functions/`:
- `create-checkout`
- `creator-payment-webhook`
- `creator-subscription-manager`
- `podcast-subscription-checkout`

The connected Supabase project has many more ACTIVE deployed Edge Functions, including the functions listed above. This means the deployed Supabase function inventory is substantially ahead of the Edge Function source currently stored in this GitHub repository.

## Result
No confirmed missing ACTIVE function remains among the audited configured/call-site names. The earlier `/functions/v1/undefined` failure was caused by the missing `adminFunction` configuration and is now corrected.

## Recommended next hardening step
Create a single machine-readable Edge Function registry and a CI audit that extracts every `functions.invoke()` and `/functions/v1/` reference from the repository and verifies each referenced name against the Supabase project before deployment.
