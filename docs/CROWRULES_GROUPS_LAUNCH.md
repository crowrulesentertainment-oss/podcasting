# CrowRules Groups — December 1, 2026 launch

This feature branch adds the Groups front-end experience to the existing CrowRules Podcasting app. It reuses the existing \`podcast_community_circles\`, \`podcast_community_circle_members\`, and \`podcast_community_circle_posts\` model.

## Launch behavior
- Public launch date: **December 1, 2026**, Pacific time.
- Before launch, \`groups.html\` displays a launch page and does not expose the group directory.
- \`groups.html?preview=1\` enables pre-launch UI testing. Supabase RLS remains the authority for every data operation.
- The Groups link is added to the shared Podcasting navigation.

## Current implementation
- Cinematic group discovery cards with category-specific real-life photography.
- Public/private/hidden visibility labels.
- Search and category filters.
- Create group and owner membership.
- Public group self-join.
- Private-group join requests (requires the Phase 1 database migration).
- Group detail pages and member-only posting.
- Optional realtime group chat (requires the Phase 1 database migration).

## Database prerequisite
Pull request #46 contains the separate Phase 1 database foundation draft. It is not safe to merge or apply until the local migration history has been recovered and replayed successfully. This feature branch does not apply SQL, alter RLS, or change production data.

Before December 1, complete the migration-history reconciliation and local replay described in \`supabase/drafts/README.md\` on the database branch. Then run role-based tests for public, private, hidden, owner, moderator, and administrator access. The front end must not be released with private join requests or group chat enabled until the database migration is validated and applied.

## Launch checklist
1. Review this feature branch and its UI changes.
2. Complete the Phase 1 migration reconciliation and local database replay.
3. Fix and test the draft SQL, then create a CLI-generated timestamped migration.
4. Apply the approved migration to the intended production project only after role-based tests and review.
5. Test sign-in, group creation, public joining, private requests, posts, and chat using real member accounts.
6. Test desktop and mobile layouts.
7. Confirm the December 1 Pacific-time launch gate and merge the UI branch before launch.
