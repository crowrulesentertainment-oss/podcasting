# Phase 1B — Public Group Discovery and Detail

Status: code-only implementation on a review branch. Not deployed or merged.

## Delivered

- Replaced the Groups page module with a static-site ES module using the existing shared Supabase browser client.
- Public directory reads only `podcast_community_circles` rows with `is_public = true` and an explicit live-schema field projection.
- Search and category filters use the exact current database category values.
- Group detail resolves one public circle by ID and shows its description, rules, category, branch label, and created date.
- Recent posts are fetched with an explicit projection, scoped to the selected `circle_id`, limited to 30, ordered pinned-first and newest-first, and filtered to exclude soft-deleted posts.
- Author labels use only `user_id,display_name,username` from the public profile view; if the view query is not permitted, the UI uses the neutral label "Community member".
- No profile-wide query, Storage access, or user-generated inline media URL is used.
- Existing static HTML entry point, `app.js` dispatch, shared `client.js`, `SITE_BASE`, and Groups CSS are preserved.

## Explicitly not implemented

- No create-group, join, leave, private-group, join-request, roster, moderation, report, reply, chat, upload, media, poll, event, award, or episode action.
- No SQL, migrations, Supabase policy/grant/function/storage changes, test data, synthetic users, deployment, or merge.
- The existing pre-launch behavior remains: directory/detail are available only on/after December 1, 2026, or with the existing `?preview=1` preview query parameter.

## Review checks performed

Source-level checks against the branch confirm:
- public circle query includes `.eq("is_public", true)`;
- post query includes `.eq("circle_id", circleId)`;
- profile projection is limited to `user_id,display_name,username`;
- no insert calls, join-request table, circle-message table, or Storage API calls exist in the new module;
- CSS additions are limited to discovery/detail presentation and focus states.

These are static source checks, not browser execution or database integration tests. Browser testing, synthetic-user testing, and deployment remain separate gated activities.
