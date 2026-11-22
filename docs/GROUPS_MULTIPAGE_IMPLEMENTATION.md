# CrowRules Groups — Multi-page workspace implementation

## Repository
This implementation extends the existing `crowrulesentertainment-oss/podcasting` repository and existing Groups/CrowSpace data model. It does not create a parallel social graph or duplicate authentication.

## Added pages
- `groups/index.html` — Groups workspace landing page
- `groups/discover.html` — public group discovery, search and category filters
- `groups/my-groups.html` — signed-in member groups
- `groups/feed.html` — recent posts from joined groups
- `groups/create.html` — create multiple groups using existing Podcasting account
- `groups/community.html?group=<uuid>` — group detail, join/request, posts
- `groups/members.html?group=<uuid>` — member directory, membership-gated
- `groups/events.html` — integration placeholder pending event schema audit
- `groups/admin.html` — admin navigation shell; server-side authorization required

## Shared assets
- `assets/css/groups-pages.css`
- `assets/js/groups-pages.js`

The JavaScript imports the existing `assets/js/client.js` Supabase client and `SITE_BASE` configuration. No second login or client is created.

## Data model compatibility
The UI uses existing `podcast_community_circles`, `podcast_community_circle_members`, `podcast_community_circle_posts`, `podcast_community_circle_join_requests`, and `crowrules_public_profiles` resources. It does not create new tables.

## Privacy and security
- Signed-out visitors can discover only non-hidden groups, with content visibility still governed by existing RLS.
- Joining, creating, posting and member-directory access require the existing authenticated Podcasting account.
- Private-group requests use the existing join-request table.
- Hidden groups are not shown in discovery.
- Group owner/moderator permissions remain enforced by the existing database policies.
- Admin page is deliberately a shell; it does not trust client-side role metadata or expose platform-admin mutations.
- This front end must not be treated as a replacement for RLS.

## Important release gates
1. Existing Phase 1 and social-permissions SQL are still drafts unless separately validated/applied.
2. Private join requests require the Phase 1 database objects and policies.
3. Member roster access depends on the reviewed roster RLS policy.
4. Do not apply draft SQL to production from this feature branch.
5. Test signed-out, ordinary member, owner, moderator, platform admin and cross-group access in a disposable local Supabase project.
6. Confirm the December 1, 2026 Pacific launch gate in the existing Groups landing route before linking the new workspace publicly.
7. Audit the existing group event schema before implementing event listing or RSVP here.

## Non-destructive integration
All additions are new files. Existing `groups.html`, `assets/js/groups.js`, `assets/css/groups.css`, `assets/js/app.js`, authentication, and existing tables are preserved in this branch.
