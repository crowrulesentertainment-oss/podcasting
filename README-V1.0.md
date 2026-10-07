# CrowRules Podcasting V1.0
Simple cinematic/cyberspace/cyberpunk foundation designed to be upgraded later.

## Kept unchanged
- index.html
- launch.html

## V1.0 pages
- app.html — discovery shell
- profile.html — listener/podcaster differential + universal member handoff
- rankings.html — rankings foundation
- create-podcast.html — podcast + artwork upload
- create-episode.html — episode + audio/image upload
- subscriptions.html — creator subscription plans + Stripe Checkout hook

## Integrations
Supabase JS is loaded from CDN. Put the Supabase publishable/anon key in js/config.js. Never place a Stripe secret key in browser code. Stripe subscription checkout is intentionally a Supabase Edge Function hook.

## Universal membership
The site redirects unauthenticated users to the existing CrowRules account page. It does not create a second podcast-only account.

## V1.0 database
Run sql/v1.0.sql in the Supabase SQL editor. Future versions can add analytics, moderation, payouts, creator teams, playlists, recommendations, and richer Creator Studio tools without replacing this foundation.