# Phase 1D — Text Posts and Replies

Status: implemented on a dedicated review branch based on the Phase 1C membership branch. Not deployed or merged.

## Live policy and constraint verification (read-only)

Inspected live `pg_policies` for `podcast_community_circle_posts`, `podcast_community_circle_replies`, and membership, plus constraints.

Confirmed:
- Public posts can be read by anonymous and authenticated visitors when the parent circle is public.
- Creating a post requires an authenticated author matching `auth.uid()` and an existing membership row for the same circle.
- Post body length is 1–3000 characters; post type is constrained to discussion, episode, question, announcement, or media.
- Reply reads are authenticated-only and are correlated to the parent post by both `post_id` and `circle_id`.
- Creating a reply requires the authenticated author, membership in the same circle, a matching parent post/circle pair, and an unlocked parent post.
- Reply body length is 1–1500 characters.
- No policy, grant, schema, function, trigger, or migration changes were made.

## Frontend implementation

- Existing public text feed remains readable for anonymous visitors.
- Signed-in members can create a discussion post.
- Posts use an explicit field projection, circle scoping, soft-delete filtering, pinned-first ordering, and a bounded 30-post page.
- Authenticated visitors can load replies with a same-circle query bounded to 150 replies across the displayed posts.
- Anonymous visitors see a sign-in prompt rather than a misleading empty reply list because reply SELECT is authenticated-only.
- Signed-in nonmembers can read accessible replies but are prompted to join before posting or replying.
- Members can reply to unlocked posts; locked posts show a closed-replies message and no reply form.
- Post/reply bodies are trimmed, client length-limited to database constraints, and escaped before rendering.
- Successful join/leave events refresh the conversation controls so newly joined members can participate without a full page reload.
- No edit/delete/moderation or media workflows were added.

## Verification limits

Static source validation passed, including JavaScript syntax compilation after removing module import/export declarations, schema/table references, circle/post scoping, membership gating, length limits, locked-post gating, and absence of Storage/chat APIs.

Live policy/constraint inspection was read-only. No post or reply was submitted to production, no synthetic users were created, no browser/integration test was run, and no deployment or merge was performed.
