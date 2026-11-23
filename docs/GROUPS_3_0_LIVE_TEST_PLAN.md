# Groups 3.0 — live functionality test plan

**Status:** Prepared; live-account tests not yet run.  
**Target:** An approved dedicated test group and synthetic test identities only.  
**Safety:** This plan does not authorize production schema, RLS, grants, migration, or real-member content changes.

## Verification baseline

- Groups 3.0 frontend merge: `bdd25ff9b92a9fa660e9f4ea23b6be59d874a33c`.
- GitHub Actions browser tests and Pages deployment passed for that commit.
- Playwright uses an in-memory Supabase stub. It does not prove real authentication, persistence, or production RLS.
- Existing frontend coverage includes public directory/search, signed-out restrictions, join/post/reply/leave flows, owner self-leave protection, locked-post UI, safe text rendering, keyboard interaction, 320px overflow, and axe-core WCAG 2.1 A/AA.
- The existing RLS integration SQL is local-only, uses synthetic fixtures, and rolls back. Never run it against the linked production project.

## Gate 0 — safe test setup

- [ ] Approve a dedicated test group; do not use a real community group.
- [ ] Prepare separate synthetic owner, moderator, member, and nonmember identities, plus a signed-out session.
- [ ] Confirm test data is disposable and cleanup is approved.
- [ ] Record deployed commit SHA, date/time, browser, and OS.
- [ ] Use normal sign-in; never share passwords or tokens in chat.
- [ ] If approved test identities/group do not exist, stop before live writes.
- [ ] Do not change production migrations, policies, grants, functions, triggers, or migration history.

## Gate 1 — authentication and role boundaries

| Scenario | Expected result |
|---|---|
| Signed-out visitor opens public group | Public details visible; member actions request sign-in |
| Signed-out visitor opens private/hidden group | Private content is not disclosed |
| Nonmember opens private group | Configured invite/join rules enforced |
| Regular member opens own group | Member actions available |
| Moderator opens assigned group | Only moderator-authorized controls available |
| Owner opens own group | Owner controls available; owner cannot leave |
| Member B requests group A roster/feed | Group A member-only data is not disclosed |
| Regular member attempts role escalation | Database rejects it |
| Moderator attempts owner-only action | Database rejects it |

Verify authorization at the authenticated request/database layer, not merely by checking whether a button is hidden.

## Gate 2 — membership, posts, and replies

Use only the approved test group.

- [ ] Join once; membership persists after refresh.
- [ ] Repeated joins do not create duplicate membership rows.
- [ ] Leave; membership is absent after refresh.
- [ ] Owner self-leave is unavailable and rejected if directly attempted.
- [ ] Valid post persists and belongs to the correct group.
- [ ] Empty and over-limit posts are rejected visibly.
- [ ] Valid reply persists under the correct post and group.
- [ ] Empty and over-limit replies are rejected visibly.
- [ ] Locked post suppresses the reply form; a stale/direct reply is rejected by the database.
- [ ] Cross-group and forged-author writes are rejected.
- [ ] Failed writes never show false success.

Existing schema notes specify reply body length 1–1500 characters. Confirm the current post limit from the live form/schema before testing; do not assume a mock limit.

## Gate 3 — media capability and permissions

The current browser suite does not test uploads. First inspect the deployed UI and current Storage configuration.

- [ ] Confirm whether Groups media upload is implemented.
- [ ] If implemented, document supported file types and size limits.
- [ ] Test upload/read/replace/delete with synthetic files and approved test accounts.
- [ ] Verify nonmembers cannot upload or read private group media.
- [ ] Verify invalid types and over-limit files are rejected.
- [ ] Confirm failed uploads do not leave broken attachments or false success.
- [ ] If there is no upload control, mark media **not implemented / not applicable**. Do not add Storage policies or enable media during this verification.

## Gate 4 — reports and moderation

The report page says closing a report records a moderation review; it does not automatically remove content or penalize a member.

- [ ] Confirm a member can submit a report through the supported UI.
- [ ] Confirm invalid/duplicate submissions are handled safely.
- [ ] Confirm unauthorized members cannot view the moderation queue or close reports.
- [ ] Confirm only the authorized moderator role can review/close reports.
- [ ] Confirm closing a report records review without silently deleting content or penalizing its author.
- [ ] Verify report status/reviewer details persist, where implemented.
- [ ] Record content removal/member sanctions as unavailable unless explicitly implemented and authorized.

The Groups Administration page is currently a navigation/information shell and states that admin mutations are not implemented. Do not treat it as a working admin console.

## Gate 5 — accessibility, mobile, and errors

- [ ] Repeat key flows at 320px, 375px, 768px, and desktop widths.
- [ ] Complete keyboard-only navigation and verify visible focus and accessible names.
- [ ] Verify selected states and status/error announcements.
- [ ] Perform a screen-reader spot check.
- [ ] Test loading, empty, permission-denied, network-error, and retry states.
- [ ] Record sanitized screenshots and console/network errors.

## Evidence record

For each case, record date/time, deployed SHA, browser/OS, viewport, synthetic role (never credentials), expected result, actual result (pass/fail/blocked/not applicable), and sanitized evidence.

## Exit criteria

Groups 3.0 live testing is complete only when the safe test environment is approved; membership, role, post, reply, and negative authorization cases pass; media is tested if implemented (otherwise marked not applicable); moderation behavior is verified or gaps documented; accessibility/responsive/error checks are recorded; and no production schema, RLS, migration, or real-member content is changed.

Passing GitHub Actions and Pages deployment alone does not satisfy these criteria. Do not declare Groups 3.0 fully complete until applicable live checks pass.
