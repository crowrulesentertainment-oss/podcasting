# CrowRules Podcasting

Cinematic HTML/CSS/JavaScript platform for CrowRules Entertainment.

- Public: home, discover, show, episode, rankings, awards.
- Accounts: login and signup.
- Creator: show and episode management, browser recording, Stripe memberships.
- Listener: follows and saved episode library.
- Guest: guest profile and collaboration entry point.
- Admin: verified control center and moderation entry points.

## Supabase
Project `cevylpnoexugwgygvtgu`. Browser code uses only the Supabase publishable key in `assets/js/config.js`. No service-role, secret or Stripe key is included. Existing schema and RLS are reused; no destructive migration is applied.

Existing Edge Functions called: `create-podcast-product`, `create-podcast-checkout`, `membership-checkout`, `membership-portal`, `podcast-subscription-center`, `premium-media-upload`, `premium-media-playback`, and `podcasting-admin-bootstrap`. Existing `stripe-billing-webhook` remains server-side. No deployed function is overwritten.

## Release checks
1. Confirm GitHub Pages is enabled for main.
2. Confirm Data API exposure for existing tables.
3. Free creator media uploads use the existing `crowrules-podcast-published` bucket with an authenticated owner-folder upload policy. Premium media uses the private `podcast-premium` bucket through the existing `premium-media-upload` and `premium-media-playback` Edge Functions; playback is authorized by the existing entitlement RPC and served with short-lived signed URLs.
4. Verify Creator/Founder Stripe price IDs and Stripe Connect readiness in test mode.
5. Test auth, creator access, uploads, checkout, webhook lifecycle and admin permissions.

Advanced remote multi-guest recording, isolated tracks, transcoding, full award season management and detailed finance reports rely on secure server workflows and are not simulated as complete.


## Social sign-in (Google, Discord, Twitch and Spotify)
The login and signup pages offer all four OAuth providers through Supabase Auth. The browser redirects back to:

`https://crowrulesentertainment-oss.github.io/podcasting/login.html`

Add that exact URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Keep the project Site URL set to the production GitHub Pages origin. In Authentication → Sign In / Providers, enable Google, Discord, Twitch and Spotify and enter each provider's own OAuth client ID and client secret. Register this Supabase callback URI in each provider developer console:

`https://cevylpnoexugwgygvtgu.supabase.co/auth/v1/callback`

Provider-specific developer consoles must have the callback above registered, while Supabase's Redirect URLs allow-list must include the GitHub Pages login URL. OAuth client secrets belong only in Supabase Dashboard, never in this repository. Test each provider on the deployed GitHub Pages site after saving credentials.
