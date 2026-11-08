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

## November 7, 2026 — artwork and episode media uploads
- Show cards, episode cards and show/episode detail artwork now use lazy-loaded image elements, async decoding and a local CrowRules logo fallback if a remote artwork URL fails.
- Free episode uploads use the existing crowrules-podcast-published bucket. Files up to 6 MB use the normal Storage upload API; larger files use resumable TUS uploads with retry support and visible progress.
- The published-media bucket now accepts common podcast audio and video MIME types and has a 50 GiB per-file bucket limit.
- Premium episode media remains private and continues through the existing premium-media-upload Edge Function; premium playback remains on the existing signed-URL/authorization path.
- Important: a bucket's per-file limit does not increase the project's total storage quota or global file-size limit. Supabase Free includes 1 GB total Storage and caps individual uploads at 50 MB; Pro includes 100 GB total Storage and permits a global per-file limit up to 500 GB. A 50 GB total quota is not a separate configurable bucket setting.
- A live metadata inventory found approximately 1.2 GB of objects across the project's buckets at the time of this check. This is a point-in-time object-size sum, not the invoice's GB-hour average.


## Creator Studio — show and episode management

The Creator Studio now includes owner-scoped show editing, episode editing, episode media replacement, audio/video upload, episode artwork URLs, show notes, transcripts, tags, explicit-content flags, release dates, scheduled publication metadata, draft publishing, and draft deletion. Large free-media files use the existing TUS resumable uploader; premium uploads continue through the existing authenticated `premium-media-upload` Edge Function. Creator permissions remain enforced by the existing Supabase RLS policies. The later Production Pipeline update adds one constrained production_stage column while retaining the existing row policies.

Additional creator workflow ideas are surfaced in the Creator Toolkit: release planning, pre-publish quality checks, audience analytics, collaborator roles, promotion kits, and backup/version history. Items described as future development are not represented as already active features. Browser-based signed-in regression tests are still required for show updates, episode updates, free and premium media uploads, publish/delete authorization, and scheduled release behavior.


## November 8, 2026 — Creator Production Pipeline and Release Calendar

- Creator Studio now has a seven-stage episode workflow: Idea, Planning, Recording, Editing, Review, Scheduled and Published.
- A Kanban-style Production Pipeline board allows creators to move their own episodes between stages. Stage changes are recorded in podcast_episode_pipeline_events, and a recent activity feed shows the workflow history.
- The Release Calendar shows scheduled, release-date and published episode dates by month, with previous/next month navigation and direct links to edit an episode.
- Episode editing saves the production stage and scheduling time together. Local datetime inputs are converted to UTC for storage and rendered in the browser's local timezone.
- podcast_episodes.production_stage was added with a CHECK constraint for the seven supported values. Existing episode RLS policies remain in place; no RLS policies were broadened.
- Automatic publishing runs through a private database function every minute using Supabase Cron. It publishes only due episodes whose show is already published, whose episode is active, and whose audio or video media URL is present. It sets status='published', is_published=true, production_stage='published', records published_at, and appends a pipeline event.
- The previous v13 cron job was replaced by the private v14 scheduler, and execution of its legacy public function was restricted to postgres. The scheduled-publishing block was removed from the general creator workflow tick so publication has one authoritative worker; the rest of that workflow tick remains active.
- The scheduler function is in the non-public private schema and execution is revoked from anon and authenticated. No private schema wrapper was added to the public API.
- Verification: cron job is active and recent cron executions succeeded; direct scheduler invocation returned 0 because there were no due scheduled episodes at test time. Security and Health Advisors returned no lints.
- Browser-based creator workflow tests and a real future-time scheduled release are still pending. Do not claim end-to-end automatic publishing until a creator schedules a test episode with media, the time passes, and the public page shows it as published.


## November 8, 2026 — YouTube episode video links

- The Creator Studio episode editor accepts YouTube watch URLs, youtu.be links, Shorts URLs and YouTube Live URLs.
- The URL is stored in the existing podcast_episodes.video_url field; no database migration or RLS change was required.
- Public episode pages recognize supported YouTube URL formats and render a responsive privacy-enhanced youtube-nocookie.com embed.
- Direct uploaded video files continue to use the native video player; audio uploads continue to use the audio player.
- YouTube links are validated before save. Audio file uploads no longer clear an existing linked video URL.
- The upload file remains optional when a YouTube URL is provided.
