# Phase 1C — Public Group Membership Controls

Status: implemented on the existing Phase 1B review branch. Not deployed or merged.

## Live policy verification (read-only)

Inspected live `pg_policies` for `podcast_community_circles` and `podcast_community_circle_members`, plus membership constraints.

Confirmed:
- Authenticated users may insert their own membership row only with role `member` and only when the referenced circle is public.
- Members may select their own membership row.
- Members may delete their own membership row only when its role is not `owner`.
- Circle owners have a distinct owner self-membership policy and the UI identifies the circle owner from `owner_id` rather than presenting a leave action.
- Membership primary key is `(circle_id, member_id)`; role check allows only owner, moderator, member.
- Foreign keys cascade when a circle or auth user is deleted.

No policy, grant, schema, function, trigger, or migration changes were made.

## Frontend implementation

- Group detail resolves the current user through the shared Supabase auth client.
- Signed-out visitors receive a sign-in link.
- The owner sees an owner state and no leave control.
- Existing members see a leave control.
- Other signed-in visitors see a join control.
- Join inserts only `circle_id`, current `member_id`, and role `member`.
- Leave deletes only the current user's membership for that circle and excludes owner-role rows.
- Controls disable during the request and repaint from the resulting local membership state.
- Errors are shown without exposing database details.

## Verification limits

The live policy and constraint inspection was read-only. Source-level review confirms the frontend uses the existing membership table and policy-compatible fields. No live join/leave action was executed, no synthetic users were created, and no browser/integration test was run. This is intentional to avoid changing real member data.

## Remaining Phase 1C boundary

Private join requests remain unavailable because the corresponding table is absent. Group creation, role management, chat, media, reports, and moderation remain excluded.
