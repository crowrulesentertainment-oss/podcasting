# CrowRules Cross-Site Regression Test Report
**Date:** 2026-11-08  
**Supabase project:** `cevylpnoexugwgygvtgu` (`crowrulesentertainment`)  
**Project health:** ACTIVE_HEALTHY  
**Status:** Database preflight passed; authenticated browser regression tests are pending.

## Executive summary

This report separates checks that were actually executed against Supabase from tests that require signed-in browser sessions. No authenticated workflow is marked passed without a real session and an observed end-to-end result.

## Environment and security preflight

| Test | Result | Evidence / notes |
|---|---|---|
| Supabase project responds and is healthy | PASS | Project status `ACTIVE_HEALTHY`. |
| Public RLS-enabled tables without policies | PASS | Live catalog query returned 0. |
| API-exposed SECURITY DEFINER functions executable by anon/authenticated | PASS | Live catalog query returned 0 in `public`. |
| Public anonymous membership-plan RPC | PASS | Anonymous-role SQL smoke test returned 4 plans. |
| Public follower-count RPC | PASS | Anonymous-role call completed; returned 0 rows for empty input. |
| Public listener leaderboard RPC | PASS | Anonymous-role call completed; returned 0 rows in current data. |
| Public visitor-count RPC | PASS | Anonymous-role call completed; returned 0. |
| Public launch-interest count RPC | PASS | Anonymous-role call returned 31. |
| Anonymous admin dashboard RPC access | PASS | Anonymous role does not have EXECUTE permission. |
| Private schema excluded from Supabase API exposed schemas | NOT VERIFIED | Database catalog does not expose the project's PostgREST exposed-schema setting through the available project metadata. Verify in Supabase Dashboard → API Settings → Exposed schemas. Keep `private` excluded. |
| Direct SQL execution of private implementation functions by client DB roles | EXPECTED / REVIEW | The invoker wrappers need EXECUTE on their `private.*_impl` dependencies. The private schema must remain excluded from PostgREST's exposed schemas; this is the API boundary. Do not add `private` to exposed schemas. |
| Mutable search_path catalog audit | NEEDS REVIEW | A broad catalog query found 454 SECURITY DEFINER functions with non-empty search_path settings across the project. This is not the same as the single mutable-search-path advisor finding. The advisor's prior zero count should not be interpreted as proof that every definer has an empty search_path. Continue function-by-function review. |

## Authenticated browser regression matrix

**Current result for all five workflows: NOT RUN — requires a real signed-in test account and browser session.**

| Site / workflow | Test steps | Expected result | Actual result | Failure / correction |
|---|---|---|---|---|
| Podcasting — authenticated playback | Sign in as a listener; play a published free episode; confirm playback; try a premium episode without entitlement; then test with a valid entitlement. | Free episode plays; premium denial is enforced; entitled listener receives playback; no cross-user access. | NOT RUN | Capture network response, Supabase function logs and user/session ID (never tokens). Fix playback authorization or signed URL handling if mismatch. |
| Tacoma Community Hub — moderation | Sign in as ordinary member and attempt moderation; sign in as authorized moderator and publish/verify a pending item; verify public listing. | Ordinary member denied; moderator allowed; only approved/published content appears publicly. | NOT RUN | Correct narrow RLS/policy or moderator authorization check; retest both roles. |
| Community chat — send/receive | Sign in as two test members; send message from A; receive as B; attempt unauthorized read/write and forged sender ID. | Authorized conversation members can exchange messages; unauthorized user denied; sender identity derives from session. | NOT RUN | Correct RLS membership predicate, realtime subscription filters or sender validation; retest both users. |
| Podcast awards — voting/results | Sign in as eligible voter; cast vote; attempt duplicate/ineligible vote; view published results. | Eligible vote recorded once; duplicate/ineligible vote rejected; unpublished results stay private. | NOT RUN | Correct eligibility/uniqueness/authorization logic; verify vote and result records, then retest. |
| Tacoma Nights — host application/approval | Submit application as member; verify pending state; approve as authorized admin; confirm crew record/access; attempt approval as non-admin. | Application persists; non-admin approval denied; admin approval creates/updates the intended crew record; approved host sees only authorized access. | NOT RUN | Correct admin guard, approval transaction or crew provisioning; retest both roles and check duplicate handling. |

## Required evidence for each authenticated test

For every run, record:
1. Timestamp and target site URL.
2. Test account role (use test accounts; do not include passwords, JWTs, or personal data).
3. Browser steps and expected result.
4. Observed result, HTTP status and relevant Supabase request/function name.
5. Relevant redacted console/network/log excerpt.
6. Failure classification and exact correction/commit or migration.
7. Retest result and tester sign-off.

## Release gates

- [ ] Confirm `private` is not listed in Supabase API exposed schemas.
- [ ] Confirm the public wrapper RPCs remain callable via PostgREST.
- [ ] Complete listener free/premium playback tests.
- [ ] Complete Hub moderator/non-moderator tests.
- [ ] Complete two-user chat authorization tests.
- [ ] Complete awards eligibility, duplicate-vote and publication tests.
- [ ] Complete Tacoma Nights application and admin approval tests.
- [ ] Review the broad non-empty SECURITY DEFINER search_path inventory separately.
- [ ] Re-run Supabase security advisor and save the dated result.
- [ ] Run regression tests again after every corrective change.

## Important boundary

The current database preflight does not establish that the five user workflows work end-to-end. Those require actual signed-in sessions in the relevant websites. Do not mark them passed based only on SQL catalog checks or anonymous smoke tests.

## November 8, 2026 follow-up integration verification

| Check | Result | Evidence |
|---|---|---|
| Updated `assets/js/app.js` syntax | PASS | JavaScript parsed successfully after removing browser-module import declarations for syntax validation. |
| Anonymous published show catalog | PASS | SQL executed as `anon`: 3 published shows visible. |
| Anonymous published episode catalog | PASS | SQL executed as `anon`: 14 published episodes visible. |
| Awards season read | PASS | SQL executed as `anon`: 1 season visible. |
| Published award nominees | PASS / EMPTY DATASET | SQL executed as `anon`: 0 published nominees. No approved nominees are currently available to display. |
| Awards page Supabase integration | CODE UPDATED | Reads seasons and nominees, submits nominations subject to existing RLS, and calls existing secure vote/results RPC wrappers. Real signed-in voting still requires browser verification. |
| Security Advisor | PASS | Latest live security advisor returned no lints. |
| Health Advisor | PASS | Latest live health advisor returned no lints. |
| Required podcast Edge Functions | PRESENT | Checkout, product, subscription center, premium upload/playback and admin bootstrap functions were found active in the project inventory. |

### Remaining release limitations
- The five authenticated browser workflows remain NOT RUN: premium entitlement playback, Hub moderation, two-user chat, signed-in awards voting, and Tacoma Nights host approval.
- OAuth provider logins and Stripe checkout/webhook lifecycle were not exercised with test accounts or test transactions.
- Private-schema exclusion from the PostgREST exposed-schema setting is still not independently readable from available project metadata. Confirm it in Supabase Dashboard → API Settings.
- No database schema migration was required for this front-end integration pass.
## November 7, 2026 — persistent login and signup maintenance

| Check | Result | Evidence / boundary |
|---|---|---|
| Shared Supabase client persistence | CODE UPDATED | Explicit stable `localStorage` storage key, `persistSession`, `autoRefreshToken`, OAuth callback detection and PKCE flow configured in `assets/js/client.js`. |
| Login/signup handling | CODE UPDATED | Restores an existing session before showing sign-in; handles email confirmation without falsely redirecting; shows sign-in errors and disables submit while requests are pending. |
| Sitewide account controls | CODE UPDATED | Shared header follows Supabase auth state on every page and displays Account / Log out when signed in. Log out calls Supabase `signOut`. |
| JavaScript syntax | PASS | `assets/js/app.js` passed syntax parsing after stripping its browser-module imports. |
| Real browser persistence test | NOT RUN | Must still verify sign-in → refresh → close/reopen browser → protected page access → explicit log out, plus OAuth callback, on deployed GitHub Pages. |

### Session policy note

Client-side persistence and refresh do not override Supabase server-side session lifetime/inactivity settings or explicit revocation. Confirm Authentication → Settings → Session timeouts in the Supabase Dashboard if the product policy is to avoid automatic session expiration. Do not weaken security settings without a deliberate policy decision.

## November 7, 2026 — artwork, upload and storage configuration

| Check | Result | Evidence / boundary |
|---|---|---|
| Show/episode artwork fallback | CODE UPDATED | Lazy-loaded image elements, async decoding and a local CrowRules logo fallback on image errors. |
| Free episode uploads | CODE UPDATED | Small files use Storage upload; files above 6 MB use TUS resumable upload with retry and progress updates. |
| Upload MIME types | PASS | crowrules-podcast-published now accepts common audio formats and MP4/WebM/QuickTime/M4V video. |
| Bucket file limit | PASS | Live Storage metadata confirms crowrules-podcast-published per-file limit is 53,687,091,200 bytes (50 GiB). |
| Total Storage inventory | OBSERVED | Object metadata sums to approximately 1.2 GB across buckets at check time. Billing quota is measured as GB-hours and may differ from this point-in-time sum. |
| JavaScript syntax | PASS | Updated assets/js/app.js parsed successfully after removing browser-module import declarations. |
| Supabase Security Advisor | PASS | No lints returned. |
| Supabase Health Advisor | PASS | No lints returned. |
| Real upload/browser verification | NOT RUN | Must test authenticated small audio, large TUS audio/video, interrupted/resumed upload, public playback and premium upload with test accounts. |

### Storage quota clarification
The 50 GiB value above is the maximum size of one object in the published-media bucket, not the project's total storage allowance. Supabase plan-wide limits still take precedence: Free includes 1 GB total Storage and a 50 MB global file-size cap; Pro includes 100 GB total Storage and supports a global file-size limit up to 500 GB. Set the global limit in Dashboard → Storage → Settings after upgrading if large uploads are required. Do not mark large uploads production-verified until a real authenticated upload succeeds.


## November 7, 2026 — Creator Studio management upgrade

| Check | Result | Evidence / boundary |
|---|---|---|
| Creator show editor | CODE UPDATED | Creator can create a show draft and edit title, category, description, artwork/trailer/website/RSS URLs, author, language, copyright, subcategory, format, production status, help-needed text and explicit-content flag. Existing creator ownership/RLS remains the authorization boundary. |
| Episode editor | CODE UPDATED | Creator can edit episode title, description, show assignment is intentionally locked, season/episode numbers, access level, thumbnail, release date, scheduled timestamp, tags, show notes, transcript and explicit flag. |
| Audio/video upload and replacement | CODE UPDATED | Free files use the existing Storage uploader (standard for small files, TUS resumable above 6 MB); premium files use the existing authenticated premium upload Edge Function. Browser upload tests remain NOT RUN. |
| Publishing controls | CODE UPDATED | Creator can explicitly publish show/episode records; episode drafts can be deleted under existing creator delete policy. |
| Creator dashboard | CODE UPDATED | Adds catalog overview, episode status/media counts, recent episodes, production checklist and Creator Toolkit ideas. |
| Styling / responsive layout | CODE UPDATED | Added responsive Creator Studio list, editor header, media/action controls and toolkit cards. |
| Database schema / RLS | UPDATED / PRESERVED | Added constrained podcast_episodes.production_stage; existing owner-scoped RLS policies remain unchanged. |
| JavaScript syntax | PASS | Full browser-module source parsed successfully after removing its top-level import declarations for syntax validation. |
| Authenticated browser regression | NOT RUN | Requires signed-in creator account. Verify show edit, episode edit, upload small and >6 MB audio/video, premium upload, publish, delete, and ownership denial using separate test accounts. |

### Creator Studio release notes
- Editing an episode to another show is intentionally blocked in the UI to avoid accidental ownership/subscription reassignment; create a new episode under the destination show instead.
- Replacing a media file updates the episode's media URL. The previous Storage object is not automatically deleted; storage cleanup should be a separate reviewed workflow to avoid deleting shared or still-referenced media.
- Scheduled publication metadata is saved in scheduled_at; the dedicated private Cron worker is now active and processes due episodes once per minute, subject to published-show, active-episode and media-present checks. End-to-end publication still needs a real future-time browser test.
- Creator Toolkit analytics, team roles, promotion assets and versioned backups are recommendations for future development, not implemented services.


## November 8, 2026 — Production Pipeline, Release Calendar and automatic publishing

| Check | Result | Evidence / boundary |
|---|---|---|
| Episode production stage | PASS — DATABASE | Added production_stage with allowed values idea, planning, recording, editing, review, scheduled, published; existing records backfilled from current status. |
| Pipeline board | CODE UPDATED | Seven columns, creator-controlled stage changes, scheduled-stage validation, and recent activity history. |
| Pipeline event history | CODE UPDATED | Creator stage changes insert into the existing podcast_episode_pipeline_events table using the signed-in creator as actor; existing owner policy applies. |
| Release calendar | CODE UPDATED | Month grid with previous/next navigation, scheduled releases, release dates, published dates, and episode edit links. |
| Timezone handling | CODE UPDATED | datetime-local values are converted to ISO UTC before saving; calendar and edit form render in the browser's local timezone. |
| Dedicated auto-publish worker | PASS — DATABASE | private.publish_due_podcast_episodes() installed; Cron job crowrules-podcasting-publish-due-v14 active every minute. |
| Publishing safety checks | PASS — CODE / DATABASE | Worker requires due scheduled status, active episode, published parent show and non-empty audio or video URL. It sets status, is_published, production stage and published_at, then writes a pipeline event. |
| Duplicate publisher control | PASS — DATABASE | v13 cron job unscheduled; legacy public v13 function execute restricted to postgres; publishing block removed from the separate creator workflow tick to keep a single authoritative publisher for podcast_episodes. Other workflow tick work remains scheduled. |
| Private function access | PASS — DATABASE | Private scheduler has SECURITY DEFINER in non-exposed private schema; execute privilege denied to anon and authenticated, granted to postgres. No public wrapper added. |
| Cron execution | PASS — DATABASE | Job is active; latest run-history entries returned succeeded. |
| Scheduler dry invocation | PASS — DATABASE | Direct invocation returned published_count=0; no episodes were due at test time, so no live episode was changed. |
| Security Advisor | PASS | No lints returned. |
| Health Advisor | PASS | No lints returned. |
| Browser workflow | NOT RUN | Requires a signed-in creator browser session to move an episode through stages, schedule it, and verify the public release after its time. |
| End-to-end scheduled release | NOT YET VERIFIED | No due scheduled episodes existed during this check. A future-time test episode with media is required to prove the full browser-to-Cron-to-public-page path. |

### Scheduling behavior and guardrails
- Scheduling sets status='scheduled' and production_stage='scheduled'; the scheduler checks once per minute.
- The worker will not publish an episode with missing audio/video media, an inactive episode, or a parent show that is not published. Such an episode remains scheduled until the creator corrects the prerequisites.
- The scheduled time is retained as release metadata after publication; published_at records the actual publication timestamp.
- The worker is idempotent: it selects only rows still in scheduled state and uses FOR UPDATE SKIP LOCKED.
- This scheduler publishes the episode on CrowRules Podcasting. It does not automatically upload or publish to YouTube, Spotify, Apple Podcasts or other external destinations.


## November 8, 2026 — YouTube URLs in Episodes & Uploads

| Check | Result | Evidence / boundary |
|---|---|---|
| YouTube URL input | CODE UPDATED | Episode editor accepts YouTube watch, youtu.be, Shorts and Live URL forms. |
| URL validation | CODE UPDATED | Unsupported hosts or malformed video IDs are rejected before save. |
| Database storage | PASS — EXISTING FIELD | URL is saved in existing podcast_episodes.video_url; no schema or RLS changes. |
| Public episode playback | CODE UPDATED | YouTube URLs render as responsive privacy-enhanced iframe embeds; direct video uploads retain native video playback. |
| Audio upload compatibility | CODE UPDATED | Audio upload no longer clears an existing linked video URL. |
| JavaScript syntax | PASS | Full app.js parses after the update. |
| Signed-in browser save and playback | NOT RUN | Requires a real creator account and a test YouTube URL. |
| Cross-browser embed test | NOT RUN | Confirm playback and YouTube privacy/embedding settings in desktop and mobile browsers. |
