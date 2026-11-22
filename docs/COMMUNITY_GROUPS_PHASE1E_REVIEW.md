# Community Groups — Phase 1E Review

Review date: 2026-11-22  
Review branch: `feature/community-groups-phase1e-review` (created from current `main`)  
Status: review findings documented; no production deployment, SQL, RLS, or live member/content writes.

## Executive result

The Phase 1B public directory/detail experience, Phase 1C membership controls, and Phase 1D text conversations can be kept together as a frontend-only increment. Read-only inspection of the live Supabase policies and constraints supports the intended access boundaries. One concrete release issue was found and fixed on this branch: the Groups page and app module retained old cache-busting query strings, which could cause browsers to continue loading the pre-Phase-1D JavaScript.

This branch is based on current `main`, includes the Phase 1D implementation and the cache-version correction, and is the clean review candidate. The earlier Phase 1C and Phase 1D PR records are closed and have no submitted review records or inline review threads; do not rely on those PRs as the active review path.

## Scope reviewed

- `groups.html` page entry and launch messaging.
- `assets/js/app.js` Groups module import.
- `assets/js/groups.js` public directory, public detail page, membership, post and reply flows.
- `assets/css/groups.css` Phase 1D conversation styling.
- Live Supabase RLS policy definitions and table constraints for circles, membership, posts, and replies (read-only).

## Security boundary findings

1. Directory and detail lookup explicitly require `is_public = true`; private circles are not exposed by this UI.
2. Public posts use explicit field projections, circle scoping, soft-delete filtering, pinned-first ordering, and a bounded read of 30.
3. Post creation is attempted only for a signed-in member. The live insert policy independently requires `author_id = auth.uid()` and a membership row for the same circle.
4. Replies are queried with both `circle_id` and the displayed `post_id` set. The live read policy ties each reply to an existing parent post/circle pair.
5. Reply creation is offered only to members for unlocked posts. The live insert policy independently checks the current author, circle membership, parent post/circle match, and unlocked state.
6. Public posts are readable anonymously; replies have an authenticated-only SELECT policy. The UI tells signed-out visitors to sign in rather than suggesting that no replies exist.
7. Public author labels are requested from the public-profile projection only. User-provided body text and author labels are escaped before HTML insertion.
8. No moderation queue, role-management action, private-group access, Storage upload, or SQL/RLS mutation was introduced.

## Fix applied during Phase 1E

- Changed the `groups.js` import in `assets/js/app.js` to a new Phase 1E cache token.
- Changed the `app.js` script URL in `groups.html` to a new Phase 1E cache token.
- Kept the Groups stylesheet's Phase 1D cache token.
- Preserved the December 1, 2026 launch gate and the existing `?preview=1` preview path.

## Remaining limitations / release gates

- No browser test has been run for signed-out, signed-in nonmember, member, and owner states.
- No actual join, leave, post, or reply has been submitted against production data.
- The feed is bounded: at most 30 posts are loaded; at most 150 replies across those posts are loaded. Pagination / load-more is not implemented.
- Signed-out users cannot read replies under the current authenticated-only reply SELECT policy; this is intentional in the current UI and policy pairing.
- The UI does not yet provide edit/delete, report, moderation, pin/lock management, media attachments, polls, events, or chat.
- Stale UI state after a post is locked between render and submit is handled by the database policy rejecting the write, but should be exercised in browser testing.
- The cache correction and source checks do not substitute for browser, mobile layout, accessibility, and end-to-end verification.

## Static checks

- JavaScript module body compiles after removing static import/export declarations.
- Explicit post/reply table references and circle/post scoping are present.
- Post and reply length limits match database constraints (3,000 and 1,500 characters).
- Membership and locked-parent UI gates are present.
- No Storage or chat API calls are introduced in the Groups module.
- Cache tokens in the Groups page and app import now point to the Phase 1E versions.

## Recommendation

Keep this as a draft review PR. Before release, run a browser test matrix using authorized test accounts (owner, member, signed-in nonmember, and signed-out visitor), verify join/leave and text submission, test locked-post rejection, test mobile/keyboard accessibility, and confirm the served module URLs use the new cache tokens. Only then consider merge and deployment through a separately approved step.
