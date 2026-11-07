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


## Brand and quality checks
The shared navigation/footer use the CrowRules Podcasting neon-cyan/violet vector logo at `assets/images/crowrules-podcasting-logo.svg`, based on the supplied crow/headphones/microphone artwork. The responsive navigation, keyboard focus styles, and shared player are styled in `assets/css/site.css`.

GitHub Actions runs static checks on pushes and pull requests: JavaScript module syntax, local HTML asset references, page-handler coverage, and obvious server-secret patterns in public JS/CSS. These checks do not replace browser, OAuth, Stripe, or real-media integration tests.

## Supabase security maintenance
The November 7, 2026 maintenance migration:
- restricts `podcast_subscriptions_select` to the authenticated subscription owner or a CrowRules administrator (it previously allowed anonymous reads of active subscription rows);
- adds a service-role-only public wrapper for the existing private `podcast_email_worker_authorized(text)` function. The notification worker called this RPC in the public schema even though the function existed only in the private schema, producing repeated 404/401 worker failures.
No existing tables were dropped or recreated, and no service-role or Stripe secret was added to GitHub.

## November 2026 integration maintenance
- The Awards page now reads live seasons and published nominees from `crowrules_award_seasons` and `crowrules_award_nominees`, submits nominations to `crowrules_award_nominations`, and uses the existing `crowrules_cast_award_vote` and `crowrules_get_award_results` RPC wrappers. Voting and publication eligibility remain enforced server-side.
- Public show and episode detail pages use explicit column projections rather than unrestricted `select(*)` reads. Listener show cards also use a reduced public projection.
- Shared auth lookup now propagates Supabase auth errors instead of silently treating them as signed-out sessions.
- Anonymous-role SQL smoke check: 3 published shows, 14 published episodes, 1 awards season and 0 published nominees were visible at the time of verification.
- `assets/js/app.js` passed a JavaScript syntax parse after stripping its browser-module imports.
## Persistent login sessions

The shared Supabase client uses one explicit browser-local storage key (`crowrules-podcasting-auth`) on every page, with session persistence, automatic access-token refresh, PKCE OAuth flow and callback detection enabled. A successful sign-in or OAuth callback is therefore restored when the user returns to the site in the same browser profile. The shared header reflects the current auth state and provides a sitewide **Log out** action that calls `supabase.auth.signOut()`.

Sign-in is intentionally not a promise of an immortal session: Supabase project-level session lifetime, inactivity limits, password/security resets, administrator revocation, cleared browser storage, or browser privacy settings can still end or prevent restoration of a session. Check Authentication → Settings → Session timeouts if the desired policy is to avoid automatic inactivity/max-lifetime expiration. Never disable security controls merely to simulate permanent login.
