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
