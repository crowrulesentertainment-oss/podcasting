# CrowRules Podcasting — Implementation Blueprint

## Architecture
Vanilla HTML/CSS/JavaScript on GitHub Pages. Supabase Auth, PostgreSQL, Storage and Edge Functions. Stripe Checkout and Customer Portal are called only through existing authenticated Edge Functions. Stripe webhooks remain server-side.

## Experiences
Public catalogue, discover, show/episode details, rankings and awards; shared login/signup; creator dashboard with show/episode CRUD and browser recording; listener follows and saved library; guest profile; administrator dashboard with server-verified access and moderation.

## Existing data reused
`podcasts`, `podcast_episodes`, `members`, `creators`, `podcast_follows`, `podcast_saved_episodes`, `podcast_guest_profiles`, `podcast_rankings`, `podcast_subscriptions`, `podcast_subscription_plans`, `cr_podcast_monetization_products` and existing award/finance structures.

## Stripe
Platform memberships use `membership-checkout` plan keys `creator` and `founder`. Show memberships use `create-podcast-product` and `create-podcast-checkout`. Billing portal uses `membership-portal`. Billing events use existing `stripe-billing-webhook`.

## Security
No service-role key in browser code. Admin bootstrap verifies account authority. Database RLS remains the source of truth. Stripe secrets remain in Supabase secrets. No database schema mutation is part of this front-end build.

## Production readiness
Free creator uploads use `crowrules-podcast-published` with owner-folder storage policy. Premium uploads use the private `podcast-premium` bucket through the existing `premium-media-upload` function; playback is checked by `premium-media-playback` and `authorize_my_podcast_playback`, then delivered through short-lived signed URLs. Confirm the Data API exposure, creator onboarding, Stripe price IDs, Stripe Connect readiness and webhook endpoints. Remote recording requires a media provider; browser MediaRecorder is single-device only.
