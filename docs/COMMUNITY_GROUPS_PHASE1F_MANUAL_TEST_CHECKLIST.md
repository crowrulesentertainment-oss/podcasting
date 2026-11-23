# Community Groups Phase 1F — Manual Verification Checklist

**Status:** Prepared for human/browser execution  
**Scope:** Verify the deployed Groups experience after Phase 1D/1E. This checklist does not authorize production writes, test-account creation, database changes, or changes to the December 1, 2026 launch gate.

## Safety and test setup

- [ ] Confirm the deployment being tested is the intended `main` build and record its commit SHA.
- [ ] Use a dedicated test circle and dedicated test accounts for every role. Do not use a real community circle or a real member account for join/leave/post/reply tests.
- [ ] Confirm the test circle and test accounts are approved for test content. If they do not exist, stop and obtain approval before creating them.
- [ ] Do not alter Supabase schema, policies, grants, functions, triggers, or migration history as part of this test.
- [ ] Record browser, OS, viewport dimensions, date/time, account role, expected result, actual result, and any screenshot or console/network error for each failure.
- [ ] Keep the launch gate in place. The `?preview=1` parameter is for preview access only; it does not grant permission to create production test data.



## Automated browser verification completed

The Phase 1F Playwright suite ran successfully in Chromium on GitHub Actions after PR #111 was merged (merge commit `a11cf2321d88934d5d0a752b3fcd0b5e7da2a176`).

- [x] Public directory, search, and private-group exclusion (mocked Supabase data).
- [x] Signed-out visitor guidance and reply restrictions.
- [x] Nonmember join and member post submission (in-memory mock).
- [x] Member reply submission and leave flow (in-memory mock).
- [x] Owner self-leave protection.
- [x] Locked-post reply form suppression.
- [x] Untrusted post text renders as text.
- [x] Preview launch gate and 320px viewport overflow check.
- [x] Keyboard navigation through category filters, `aria-pressed` state, visible focus outline, and Enter activation of category/join controls.

Run: https://github.com/crowrulesentertainment-oss/podcasting/actions/runs/45086504898

These are frontend browser tests against an isolated in-memory Supabase client stub. They do **not** verify production authentication, database persistence, actual RLS enforcement, or screen-reader behavior. The manual checklist below remains open for those release checks.

## Test matrix

### A. Public directory and group details

- [ ] Open `groups.html?preview=1` while signed out.
- [ ] Confirm the directory renders and only public groups are listed.
- [ ] Search by a known test-group name and confirm results narrow correctly.
- [ ] Change category filter and confirm it filters the directory.
- [ ] Open a public test group and verify its name, description, category, rules, branch, and creation date render correctly.
- [ ] Confirm no private/member-only profile fields are exposed.
- [ ] Follow the sign-in prompt from a signed-out view and confirm it leads to the expected authentication flow.
- [ ] Confirm group detail and back-to-directory navigation retain preview mode when applicable.

### B. Membership lifecycle

Run only with approved test accounts and the dedicated test circle.

- [ ] Signed-in nonmember sees a Join control.
- [ ] Join succeeds once and the UI changes to member state.
- [ ] Refresh the page and confirm membership state persists.
- [ ] Member sees Leave and can leave the test circle.
- [ ] Refresh and confirm the user is again a nonmember.
- [ ] Repeated/rapid join attempts do not create duplicate membership rows or leave the UI in a false state.
- [ ] Owner account is identified as owner and is not offered a self-leave action.
- [ ] Confirm no test is attempted against a real owner or real community circle.

### C. Posts and replies

Run only in the approved test circle.

- [ ] A member can submit a valid text post.
- [ ] Empty post is blocked by the form.
- [ ] A post at the 3,000-character limit is accepted; a post exceeding the limit is blocked.
- [ ] A member can reply to an unlocked test post.
- [ ] Empty reply is blocked by the form.
- [ ] A reply at the 1,500-character limit is accepted; a reply exceeding the limit is blocked.
- [ ] Refresh and confirm approved test posts and replies persist and appear in the correct group/post.
- [ ] Confirm a reply is associated with the intended parent post and circle.
- [ ] Confirm a signed-out visitor receives the sign-in guidance for replies rather than a misleading empty-replies state.
- [ ] Confirm a nonmember cannot see or use member-only post/reply controls.
- [ ] Confirm a locked post displays the closed-replies message and no reply form.
- [ ] In the dedicated test circle only, attempt a stale/forged reply submission after the post is locked; confirm the database rejects it. Do not use a real community post for this negative test.
- [ ] Confirm action errors are visible and the UI does not falsely report success when the database rejects a write.

### D. Content safety and data boundaries

- [ ] Submit test strings containing `<`, `>`, `&`, quotes, and apostrophes; confirm they render as text and do not execute markup.
- [ ] Confirm author labels use only the intended public display name/username fields.
- [ ] Confirm one group's posts and replies never appear in another group's detail view.
- [ ] Confirm deleted posts are not rendered.
- [ ] Confirm the page does not request Storage uploads or expose media/chat controls that are outside Phase 1D scope.
- [ ] Inspect browser network requests for unexpected broad profile queries or unscoped post/reply reads.

### E. Keyboard and accessibility

- [ ] Navigate the directory, filters, group links, membership buttons, and forms using keyboard only.
- [ ] Confirm visible focus indication at every interactive control.
- [ ] Confirm controls have meaningful accessible names and labels.
- [ ] Confirm category filters expose the selected state to assistive technology.
- [ ] Confirm membership and post/reply status updates are announced through the live regions.
- [ ] Confirm validation and action errors are perceivable without relying on color alone.
- [ ] Test at 320px, 375px, 768px, and desktop widths; check for clipped controls and horizontal overflow.
- [ ] Perform a screen-reader spot check of directory navigation, membership state, and post/reply forms.

### F. Cache and launch gate

- [ ] Confirm the page loads the current cache-busted `app.js?v=phase1e-groups-review-1` entry.
- [ ] Confirm the current `groups.js?v=phase1e-groups-review-1` module is requested by the app entry point.
- [ ] Confirm a normal visit before December 1, 2026 shows the launch notice and does not expose the preview directory.
- [ ] Confirm `?preview=1` shows the preview experience and preview notice before launch.
- [ ] Confirm preview access does not bypass authentication or database authorization.
- [ ] After the launch date, verify the normal route transitions as intended; do not change the date gate to simulate launch in production.

## Exit criteria

Phase 1F manual verification is complete only when:

1. All applicable cases above have a recorded pass/fail result.
2. Membership, post, reply, and locked-post negative tests have been completed using approved test identities and a dedicated test circle.
3. Keyboard, mobile-width, and screen-reader spot checks have been completed.
4. Any failures are documented with reproducible steps and browser/network evidence.
5. No production schema, RLS, migration, or unrelated application changes were required.

A successful GitHub Actions run or Pages deployment is not a substitute for these browser-level checks. Until this checklist is executed, Phase 1F remains **code-reviewed / static-verified, not fully browser-verified**.
