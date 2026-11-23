# Community Groups 2.0 — Live Schema Inventory

Inspection date: 2026-11-22
Project: existing CrowRules Podcasting Supabase project
Method: read-only inspection of public table names, columns and RLS policies. No production writes or schema changes were performed.

## Existing group tables observed

- podcast_community_circles
- podcast_community_circle_members
- podcast_community_circle_posts
- podcast_community_circle_replies
- podcast_community_circle_activity
- podcast_community_circle_collaborations
- podcast_community_circle_collaboration_votes
- podcast_community_circle_events
- podcast_community_circle_event_rsvps
- podcast_community_circle_helpful_votes
- podcast_community_circle_image_suggestions
- podcast_community_circle_invites
- podcast_community_circle_notification_preferences
- podcast_community_circle_recognitions
- podcast_community_circle_reports

## Feature coverage indicated by existing schema

| Product capability | Existing schema evidence | Implementation implication |
|---|---|---|
| Groups and memberships | circles, members | Existing foundation |
| Posts and replies | posts, replies | Existing foundation |
| Activity | activity | Can support member activity feed after query/policy review |
| Creator collaboration | collaborations | Existing data model; audit UI and statuses |
| Collaboration polls/votes | collaborations.poll_options and collaboration_votes | Existing poll-like mechanism; determine if it meets the new poll product spec before extending |
| Events and RSVP | events and event_rsvps | Existing event system; improve UI only after schema/policy audit |
| Helpful votes | helpful_votes | Existing reply recognition mechanism; not equivalent to all post reactions |
| Group artwork suggestions | image_suggestions | Existing suggestion/review workflow |
| Invitations | invites | Existing invite flow; audit whether approval-required join workflow is complete |
| Notification preferences | notification_preferences | Existing per-user notification controls |
| Recognition | recognitions | Existing appreciation/member-of-month mechanism; not a complete achievement catalog |
| Reports | reports | Existing post reporting and moderator review |

## Existing authorization observations

The live policy inventory showed:
- Membership SELECT is scoped to the current member and owner/moderator roster access.
- Public/member post visibility is enforced through group visibility and membership predicates.
- Post insertion requires the current author to be a group member.
- Reply insertion requires current author membership and an existing unlocked parent post in the same circle.
- Collaboration submissions are member-scoped; moderator updates require owner/moderator role.
- Collaboration votes are member-scoped and checked against the parent collaboration and allowed poll option.
- Event creation/update requires owner or moderator membership; event reads follow public-group or member access; RSVP writes are scoped to the current member.
- Helpful votes require current member identity and a reply authored by someone else.
- Reports are submitted by members and reviewed by moderators/owners.
- Recognition is member-scoped, with the member-of-month award restricted to owner/moderator roles.

These observations are a snapshot of policy definitions, not a complete penetration test or proof of every edge case.

## Important gaps / unverified capabilities

The table inventory did not show dedicated tables for:
- General post reactions (beyond helpful votes on replies).
- Personal bookmarks/saved items.
- A general-purpose group resource library.
- Dedicated group chat messages/channels.
- A complete group achievement catalog/award ledger.
- Guest finder profiles and invitation lifecycle.
- Dedicated poll tables. Existing collaboration poll fields/votes may be reusable for one poll-like workflow, but are not automatically equivalent to the desired feed poll feature.
- Dedicated analytics rollups. Existing activity can be a source, but aggregation definitions and access rules need review.

Live rooms require a trusted room/session authorization design and provider review; existing general group tables do not establish that capability.

## Engineering decision

Build on the verified existing tables wherever they satisfy the product contract. Do not duplicate groups, memberships, posts, events, collaborations, votes, notifications or reports.

For missing capabilities, prepare narrowly scoped schema and policy proposals separately. Do not apply the existing Groups 2.0 draft SQL or attempt to recover/replay the missing production migration history. No production changes are authorized by this inventory.

## Next code-first sequence

1. Audit and finish the existing group homepage, community feed, settings, members, events and collaboration screens against the live tables.
2. Add post reaction and private bookmark behavior only after a dedicated data contract and authorization review.
3. Decide whether collaboration polls can be adapted to feed polls without changing existing semantics; otherwise design a separate poll model.
4. Specify the resource library and guest finder opt-in/privacy model.
5. Design chat and live-room authorization independently from the ordinary group membership UI.
6. Build aggregate analytics and achievements from explicit, privacy-safe event definitions.
