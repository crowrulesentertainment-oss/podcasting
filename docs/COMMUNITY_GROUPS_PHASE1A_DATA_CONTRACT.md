# CrowRules Community Groups — Phase 1A Frontend Data Contract

Date: 2026-11-22  
Status: Design artifact only; not an implementation or authorization to change production.

## 1. Existing application architecture

- Static HTML pages, shared CSS, and browser ES modules; no React/Vite application or package manifest at repository root.
- Shared Supabase client: `assets/js/client.js`, imported by `assets/js/groups.js`.
- Existing Groups entry point: `groups.html` with `data-page="groups"`; `assets/js/app.js` imports and dispatches to `renderGroups()` from `assets/js/groups.js`.
- Existing Groups stylesheet: `assets/css/groups.css`.
- Shared navigation already links to `groups.html`.
- Preserve this architecture. Do not introduce a framework, second Supabase client, new auth/session storage, or a separate navigation shell.

## 2. Live schema contract

All fields below were checked against the live `information_schema.columns` inventory on 2026-11-22. These are the only fields the first UI slice should assume.

### Circle directory and detail

Table: `public.podcast_community_circles`

Safe initial projection:
```js
"id,owner_id,name,description,category,is_public,is_featured,created_at,updated_at,community_rules,pinned_post_id,branch_key,avatar_image_path,banner_image_path"
```

Do not request `slug`, `cover_image_url`, `avatar_image_url`, `visibility`, or `group_chat_enabled`: those are not columns in the live table. Visibility for the initial UI is derived only from `is_public`; do not invent private/hidden states from a nonexistent field.

Existing category constraint (use exact values):
- General
- Entertainment
- Sports
- Storytelling
- Local & PNW
- Music
- Film & TV
- Creators
- Technology
- Other

Existing branch_key constraint (use existing values only):
- community
- podcasting
- tacoma-nights
- back-deck-live
- bonded-in-mystery
- tacoma-community-hub
- memorials
- dreamscapes
- studios
- crowrules-plus
- records
- spectrum-awards
- tacoma-community

Directory rule:
- Anonymous/public directory queries must include `.eq("is_public", true)`.
- Signed-in viewers may additionally fetch circles they own or are members of, but only through RLS-permitted queries. Do not query all circles and filter private rows only in the browser.
- No member count is promised in this slice: member roster SELECT is restricted, and a public aggregate/count endpoint was not established.
- Featured ordering can use `is_featured`, then `created_at`; no ranking score is implied.

### Membership

Table: `public.podcast_community_circle_members`

Projection:
```js
"circle_id,member_id,role,joined_at"
```

Constraints:
- Primary key: `(circle_id, member_id)`.
- Roles: `owner`, `moderator`, `member`.
- A signed-in user can self-insert only their own `member_id` as role `member` into a public circle.
- Owner self-membership is separately constrained to the actual circle owner.
- Members may leave unless their role is `owner`; moderators/owners/admins have limited removal rights under existing policy.
- The member roster is not generally public. A normal member can read their own membership; owners/moderators/admins have roster access as policy allows.
- UI must not expose role editing or roster management in this slice.

### Posts / feed

Table: `public.podcast_community_circle_posts`

Projection for the first text-only feed:
```js
"id,circle_id,author_id,body,created_at,updated_at,post_type,edited_at,deleted_at,is_pinned,is_locked"
```

Known fields also present but intentionally not used in Phase 1A UI:
- `episode_url`, `episode_title`, `episode_artwork_url`
- `media_path`

Constraints:
- Body length: 1–3000 characters.
- Post types: `discussion`, `episode`, `question`, `announcement`, `media`.
- Media path, if used later, must follow the existing circle/author path constraint; media UI is excluded pending Storage policy correction.
- Feed query must always include `.eq("circle_id", circleId)`, order by `created_at` descending, and use bounded pagination.
- Do not use unrestricted `select("*")`.
- Do not render soft-deleted posts as ordinary content; confirm desired moderator/author visibility behavior before implementing deleted-content views.
- Locked posts remain readable under parent visibility rules but must not accept new replies.

### Replies

Table: `public.podcast_community_circle_replies`

Projection:
```js
"id,post_id,circle_id,author_id,body,created_at"
```

Constraints:
- Body length: 1–1500 characters.
- Every reply read/write must be correlated to both the requested parent post and the same `circle_id`.
- Insert policy requires the signed-in author to be a member of that circle and the parent post not to be locked.
- Current reply SELECT policy is authenticated-only and checks the parent-post/circle relationship. Do not promise anonymous reply visibility.
- No nested reply/thread-parent field exists in this live table; model replies as one level under a post.

### Reports

Table: `public.podcast_community_circle_reports`

Projection for authorized moderation only:
```js
"id,circle_id,post_id,reported_by,reason,status,created_at,reviewed_by,reviewed_at"
```

Constraints:
- Reports are submitted by an authenticated circle member for a post belonging to the same circle.
- Circle moderators/owners and platform admins can review reports under existing policy.
- Reporter-facing UI must not query the moderator report queue. Moderation UI is not part of the first feed slice unless a separate authorized screen is reviewed.
- Report reason must be non-empty; preserve the live database's actual constraint and validate conservatively in UI.

## 3. Safe profile projection

Available profile views include `public.crowrules_public_profiles` and `public.podcast_public_member_profiles`. The first view exposes a broader set of fields including first/last name, role, bio, membership type and avatar; the second exposes headline, bio, avatar, skills and interests. Neither view is automatically a license to display every field.

For the Phase 1 feed author label, request only:
```js
"user_id,display_name,username"
```
from `crowrules_public_profiles`, after verifying that this exact projection is granted to the intended role and that the view's definition/security mode is appropriate. Fallback label: `Community member`. Do not select `first_name`, `last_name`, `membership_type`, `role`, bio, location, interests, social links, or full profile rows for the feed.
If the safe view projection cannot be confirmed for the current viewer, show the neutral fallback rather than switching to `podcast_member_profiles.select("*")`.

## 4. Explicitly unavailable / excluded objects

The live inventory did not contain:
- `podcast_community_circle_categories`
- `podcast_community_circle_join_requests`
- `podcast_community_circle_messages`

Therefore:
- Do not issue queries or inserts against those names.
- No private-group join-request flow in this slice.
- No circle chat or realtime message subscription in this slice.
- Do not repurpose `crowspace_group_conversations` / `crowspace_group_messages`; their `group_id` domain is not proven to map to circle IDs.
- No new categories table is needed for the initial experience.

## 5. Storage/media boundary

The current live policy named `Public group media is viewable` contains a malformed correlation using `storage.foldername(c.name)` rather than the Storage object's `name` path. The Groups 2.0 draft also has an incomplete expression in this policy block. Until a separately reviewed correction and access matrix exist:
- No upload controls, media picker, public media URL generation, or image preview from group Storage paths.
- Keep existing bucket/policies unchanged.
- Group artwork paths may be displayed only if a separately verified safe delivery path is already available; otherwise use the local/static fallback artwork.

## 6. UI component contract

Implement in the existing `assets/js/groups.js` module and `assets/css/groups.css`, retaining `renderGroups()` as the entry point.

Planned UI modules (functions, not a new framework):
1. `loadViewer()`: call shared `sb.auth.getUser()`; propagate errors distinctly from signed-out state.
2. `loadPublicCircles()`: explicit safe projection, `is_public=true`, bounded ordering/limit.
3. `loadViewerMemberships(userId)`: own membership rows only; tolerate signed-out state without querying roster.
4. `renderDirectory()`: search/filter only over the loaded public rows; use the exact production category values; show a clear empty/error state.
5. `renderCircleDetail(circleId)`: fetch one RLS-visible circle by ID with explicit projection; if not visible, show a neutral not-found/permission message.
6. `renderTextFeed(circleId)`: scoped post query, bounded page size, no media rendering, no cross-circle aggregation.
7. `renderReplies(postId,circleId)`: authenticated-only query scoped to both identifiers; locked-post state disables reply composition.
8. `renderSafeAuthorLabels(userIds)`: explicit `user_id,display_name,username` projection from the approved public view; neutral fallback if unavailable.
9. `submitTextPost()` / `submitReply()`: use current authenticated user ID, trim text, enforce UI length bounds, disable duplicate submissions, and rely on RLS as final authority.
10. `joinPublicCircle()` / `leaveCircle()`: only existing supported membership operations; handle duplicate membership idempotently; never remove or demote an owner through leave UI.

Accessibility and behavior:
- Responsive mobile/desktop layout using existing design tokens and navigation shell.
- Semantic headings, labels, buttons, focus-visible states, live status/error messages, and disabled/loading states.
- Escape all database-derived text before HTML insertion.
- Never place untrusted text into inline CSS, URLs, or raw HTML attributes without validation/escaping.
- Do not show success until Supabase confirms the operation.
- Keep errors actionable but do not expose SQL, policy internals, tokens, or secrets to visitors.

## 7. Existing Groups module discrepancies to resolve before 1B

The current `assets/js/groups.js` contains references to fields/tables not present in the live schema:
- circle fields: `slug`, `cover_image_url`, `avatar_image_url`, `visibility`, `group_chat_enabled`
- table: `podcast_community_circle_join_requests`
- table: `podcast_community_circle_messages`

It also:
- falls back to a narrower circle query, but that query is still mixed with pre-Phase-1 assumptions elsewhere in the module;
- uses a private join-request insert path despite the join-request table being absent;
- creates a circle and then separately inserts owner membership, which can leave a circle without its owner membership if the second request fails;
- offers chat UI based on a `group_chat_enabled` field that does not exist in production;
- uses a profile view for author labels without the narrow projection/privacy contract above.

These are implementation findings, not a command to hotfix production. 1B should replace the incompatible assumptions in a dedicated code-only branch after review of the full module and its stylesheet.

## 8. 1A completion gate

1A is complete when this contract is accepted and the 1B code plan uses only the live fields, current policies, existing shared client, and static-site architecture documented here.

No SQL, migration, production policy/grant/function/storage change, synthetic data, test-user creation, deployment, or merge is included in 1A.
