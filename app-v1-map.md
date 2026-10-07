# V1.0 map
index.html and launch.html are intentionally untouched.

New front-end:
- app.html: discovery
- profile.html: universal member + listener/podcaster mode
- rankings.html: rankings foundation
- create-podcast.html: show/artwork creation
- create-episode.html: audio/image episode creation
- manage-plans.html: creator-defined recurring plans
- subscriptions.html: listener checkout
- css/app.css + js/*.js: shared V1 shell

Supabase:
- sql/v1.0.sql
- Edge Functions: create-podcast-plan and create-podcast-checkout

Stripe:
- secret key only in Supabase Edge Function secrets
- creator sets price in manage-plans.html
- server creates recurring Stripe Price
- listener uses Stripe Checkout

V1.0 deliberately does not attempt payouts, tax automation, advanced analytics, resumable media, moderation, recommendations, or a second account system.