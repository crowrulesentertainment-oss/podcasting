# CrowRules Podcasting 2.0

CrowRules Podcasting is an audio-first, multi-page GitHub Pages frontend connected to the existing CrowRules Supabase project.

## Frontend
- index.html — cinematic intro, no navigation
- launch.html — launch experience, no navigation
- home.html — audio home
- discover.html — categories, Top 10 and new releases
- search.html — live podcast search
- podcast.html — show page and following
- episode.html — mobile-first episode player
- library.html — Continue Listening, follows and listening history
- account.html — Universal CrowRules Auth + Google OAuth
- creator-dashboard.html — creator shows, episodes and publishing
- create-podcast.html — create podcast drafts
- create-episode.html — Supabase Storage audio upload
- creator-payouts.html — Stripe Connect onboarding/status
- membership.html — Universal CrowRules recurring memberships
- admin.html — protected Admin API metrics

## Supabase integration

Project: cevylpnoexugwgygvtgu

The production database already contains the Podcasting 2.0 schema, including podcasts, podcast episodes, follows, playback progress, listens, uploads, categories, rankings, membership plans, creator monetization, Stripe Connect, RSS and publishing infrastructure.

The frontend uses the Supabase publishable key only. No service-role or Stripe secret is placed in GitHub Pages.

Existing production Edge Functions used by the frontend include:
- membership-checkout
- membership-stripe-webhook
- membership-status
- crowrules-admin-api
- creator-connect-onboarding
- creator-connect-status
- podcast-rss
- podcast-publish-request
- podcast-publish-worker

## Storage

Audio uploads use the existing podcast-audio bucket. The bucket is public-read with creator-scoped upload/update/delete policies and a 500 MB file-size limit.

For larger audio files, Supabase recommends resumable TUS uploads rather than standard browser uploads.

## Stripe

Recurring Universal CrowRules membership is handled by the existing server-side membership-checkout function and Stripe webhook synchronization. Creator payouts use the existing Stripe Connect onboarding and webhook infrastructure.

## Security

RLS remains the authorization boundary. Creator writes use existing ownership policies; administrator metrics go through the authenticated crowrules-admin-api Edge Function rather than exposing service-role credentials to the browser.

Google OAuth must be enabled in Supabase Auth before the Google button can complete sign-in.
