# CrowRules Podcasting — Groups 2.0 Security and Release Acceptance

Status: mandatory engineering gate for all Groups 2.0 releases.

## Repository and production safety constraints

- Preserve existing group IDs, membership rows, posts, replies and current production behavior.
- Do not replay, reconstruct or retry the missing production migration history.
- Existing Groups 2.0 SQL under drafts is review material only; it is not an approved production migration.
- No production SQL, DDL, RLS, grant, Storage policy, Realtime configuration or provider configuration change is authorized by this document.
- No service-role or secret key in GitHub Pages assets.
- Do not create synthetic users, groups, posts or replies in production.
- Each release requires a separate reviewed change set and deployment decision.

## Security acceptance

### Authentication and authorization
- Identity comes from the authenticated Supabase session.
- Never trust user-supplied author IDs, roles, ownership claims or room roles.
- Every write verifies group membership and the exact required role.
- Owner transfer, group deletion and moderator assignment use narrowly scoped authorization.
- Prevent IDOR/cross-group access by checking both resource ID and group ID.

### RLS and data access
- RLS enabled for every exposed table.
- Private groups, posts, replies, rosters, polls, resources and events are inaccessible to nonmembers.
- Approval-required groups expose only the intended public listing before approval.
- Do not use authenticated role alone as a substitute for row ownership/membership predicates.
- UPDATE policies require both USING and WITH CHECK.
- Views must not unintentionally bypass RLS; use invoker security where appropriate.
- No broad policy replacement or privilege grant as a shortcut.

### Storage
- Private bucket for private-group resources.
- Object paths bind group ID and uploader ID.
- Validate MIME type and size server-side where possible.
- Signed URLs are short-lived.
- Cross-group and nonmember object reads fail.
- Define deletion, retention and recovery behavior.

### Realtime and live
- Realtime channels are group-scoped and membership-authorized.
- Chat rate limits and message moderation are enforced beyond the browser.
- Live room name and role are resolved server-side.
- Invitations are expiring and revocable.
- Recording is opt-in with explicit consent and retention controls.

### Privacy and communications
- Member directory and guest finder require explicit discoverability choices.
- Bookmarks and vote identities remain private.
- Analytics are aggregate-first.
- Promotional email requires explicit opt-in and unsubscribe; transactional notices are separate.
- In-person event location and meeting links respect visibility/attendee rules.

## Test matrix

For every feature, test:
- Signed-out visitor.
- Signed-in nonmember.
- Public-group member.
- Private-group member.
- Approval-required pending applicant.
- Moderator.
- Owner.
- Cross-group member from a different group.
- Revoked/removed member.
- Expired/revoked invitation where applicable.

## Release gates

1. Feature specification and data contract reviewed.
2. Schema and policy design reviewed before any production change.
3. Static checks and type/syntax validation pass.
4. Browser tests pass using isolated mocks.
5. Disposable non-production database tests prove RLS behavior.
6. Negative authorization tests pass.
7. Accessibility scan has no unresolved critical/serious violations.
8. Manual keyboard and screen-reader testing completed.
9. 320px, 375px, tablet and desktop layouts verified.
10. Existing Groups regression suite passes.
11. Main-branch checks and deployment status verified after approved merge.

A mocked browser test does not prove Supabase RLS. A successful SQL read-only probe does not prove write authorization. A merged PR does not prove deployment or end-to-end behavior.
