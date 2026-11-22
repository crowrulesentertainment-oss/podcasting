# CrowRules Connection Groups — database security test plan

**Branch:** `feature/connection-groups-db-security-2026-11-21`  
**Status:** Draft corrections and synthetic tests prepared; local execution pending.  
**Production changes:** None.

## Existing production model

Connection Groups extends the existing Podcasting circles model. It does not introduce a duplicate groups system.

Existing production resources include:

- `podcast_community_circles`
- `podcast_community_circle_members`
- `podcast_community_circle_posts`
- `podcast_community_circle_replies`
- `podcast_community_circle_invites`
- `podcast_community_circle_events`
- `podcast_community_circle_event_rsvps`
- Existing collaboration, activity, helpful-vote, recognition, member-profile, and direct-message resources.

Phase 1 adds a dynamic category directory, group visibility/media metadata, private join requests, and group chat messages. Legacy category text and `is_public` behavior remain compatible.

## Security corrections included in the branch

1. Fixed the trailing comma in the join-request table definition.
2. Qualified correlated references in the join-request and membership checks.
3. Corrected hidden-group invitation validation to match the invitation's circle to the membership row's circle.
4. Corrected group-chat read and insert policies to correlate the message row to the exact circle, preventing a member of one circle from reading or writing another circle's chat.
5. Added a public SECURITY INVOKER wrapper for the private atomic join-request approval implementation. The wrapper is executable by authenticated users only; the implementation remains private.
6. Kept anonymous reply SELECT unavailable, preserving the existing API grant boundary.
7. Kept the social-permissions patch separate and limited to the two defective reply policies plus same-circle roster visibility.

## Test identities

Use synthetic, disposable identities only:

- Circle A owner
- Circle A moderator
- Circle A member
- Circle B owner
- Circle B member
- Private-group requester
- Nonmember
- Hidden-group invitee
- Platform administrator

No real CrowRules member accounts should be used.

## Required assertions

| Area | Required result |
|---|---|
| Category directory | Active categories readable; writes restricted to platform admins |
| Public discovery | Anonymous visitors can discover public groups |
| Private discovery | Anonymous visitors can see private group metadata only |
| Hidden discovery | Anonymous/nonmembers cannot discover hidden groups |
| Private posts | Only approved members, owners, moderators, and authorized admins can access |
| Public joining | Member may self-join a public group |
| Private joining | Requester can create only their own pending request |
| Request uniqueness | One pending request per member/group |
| Request approval | Owner/moderator approval updates request and membership atomically |
| Unauthorized approval | Ordinary member cannot approve or decline |
| Hidden invitations | Pending invitee can view only invited group metadata; atomic acceptance authorizes only the exact invited group and creates membership |
| Roster | Members can see only their own circle's roster |
| Post creation | Active member can post in own group, not another group |
| Replies | Same-circle membership and parent-post relationship required |
| Invitation acceptance | Only the intended invitee can accept; invite status and membership are updated atomically |
| Invitation cancellation | Only inviter/group owner can cancel a pending invitation |
| Event creation | Group owner/moderator can create an event in their own group |
| Event visibility | Public group events are discoverable; private group events are visible only to members |
| Event RSVP | Active group members can create/update their own RSVP; nonmembers cannot RSVP |
| Event moderation | Group moderators can update/cancel events; only the owner can delete |
| Chat read | Only members of the exact enabled group can read |
| Chat write | Sender must be the authenticated member of the exact enabled group |
| Chat disabled | Disabled group chat denies reads and writes |
| Role escalation | Ordinary member cannot promote self or another member |
| Admin category management | Platform admin can add categories; ordinary member cannot |
| Anonymous replies | No anonymous table SELECT grant is introduced |

## Data integrity checks

Before migration application, require zero existing replies whose parent post belongs to a different circle:

```sql
select r.id, r.circle_id, p.circle_id as post_circle_id
from public.podcast_community_circle_replies r
left join public.podcast_community_circle_posts p on p.id = r.post_id
where p.id is null or p.circle_id <> r.circle_id;
```

Inspect existing category labels and duplicate/blank values before backfilling the normalized category directory.

## Local-only validation gates

1. Recover all 1,428 recorded production migration versions using `supabase migration fetch --remote`.
2. Confirm `supabase migration list --remote` has no mismatches.
3. Replay the complete history with `supabase db reset` against the local stack.
4. Generate timestamped migrations only after replay succeeds.
5. Apply Phase 1 and the social-permissions correction locally.
6. Run `supabase/tests/connection_groups_phase1_rls.sql` with `ON_ERROR_STOP=1`.
7. Inspect grants, RLS, triggers, function ownership/privileges, and Realtime publication membership.
8. Run Supabase security advisors and review every finding.
9. Save test output and review the migration diff before any hosted rollout.

## Current validation status

- Production schema and policy inspection: completed read-only.
- SQL source corrections: committed to feature branch.
- Synthetic SQL integration test package: committed to feature branch.
- PostgreSQL parser / local Supabase replay: not run in this environment.
- Hosted migration: not generated or applied.
- GitHub Pages deployment: not performed.

**Release gate:** No production migration or frontend feature activation until full local replay, all synthetic security tests, and a separate review are complete.
