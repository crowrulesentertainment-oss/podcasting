# CrowRules Connection Groups — Activity Feed and Notifications

**Feature branch:** `feature/connection-groups-activity-notifications-2026-11-21`  
**Parent branch:** `feature/connection-groups-experience-2026-11-21`  
**Status:** Frontend implementation committed; local browser and SQL validation pending.  
**Production database changes:** None.  
**Deployment:** Not performed.

## Product scope

Provide one connected experience across the existing Connection Groups model:

- Group activity timeline for discussions, replies, scheduled/updated/cancelled events, and members joining.
- A signed-in member notification center for group invitations, discussions, replies, and events.
- Mark one notification read or mark all displayed group notifications read.
- Member-controlled preferences for invitation, discussion, reply, and moderation alerts.
- Deep links from notifications and activity entries back to the relevant group, discussion area, or event area.

## Existing database resources reused

No parallel activity or notification tables are introduced.

| Existing resource | Purpose |
|---|---|
| `podcast_community_circle_activity` | Group activity timeline |
| `crowrules_notifications` | Member notification inbox and read state |
| `podcast_community_circle_notification_preferences` | Member notification preferences |
| `podcast_community_circle_posts` | Discussion source |
| `podcast_community_circle_replies` | Reply source |
| `podcast_community_circle_events` | Event source |
| `podcast_community_circle_invites` | Invitation source |
| `podcast_community_circle_members` | Membership and member-joined activity |

Read-only production schema inspection confirmed that the existing activity recorder writes these activity types: `discussion_created`, `reply_created`, `event_created`, `event_updated`, `event_cancelled`, and `member_joined`.

Existing notification triggers already create group-related rows in `crowrules_notifications` for invitations, discussions, replies, and events. The UI reads those rows and relies on the existing per-user SELECT/UPDATE RLS policies. The activity feed relies on the existing member-only activity SELECT policy. Preferences rely on the existing own-user SELECT/INSERT/UPDATE policies.

## Frontend files

- `assets/js/groups-activity.js` — activity feed, notification center, read actions, and preferences.
- `assets/js/groups.js` — mounts the activity feed in a member's group view and the notification center on the discovery page.
- `assets/js/groups-events.js` — adds the event section anchor used by notification deep links.
- `assets/css/groups.css` — responsive activity and notification presentation.
- `assets/js/app.js` — refreshes the Groups module cache version.

Duplicate notification variants from the existing notification trigger families are collapsed in the display. The mark-all action still updates all source notification rows, including collapsed duplicates.

## Security and compatibility boundaries

- No new tables, policies, triggers, RPCs, or migrations are included in this phase.
- No changes to existing membership, invitations, events, posts, replies, or chat permissions.
- Activity is requested only for the currently open group; database RLS remains authoritative.
- Notifications are requested only for the signed-in user's own account; database RLS remains authoritative.
- Read actions are scoped to the signed-in user's notification rows.
- Preference writes use the existing own-user policy and primary key.
- No service-role key or privileged browser credential is introduced.
- Event-alert preferences are not presented as a user toggle because the existing circle preference table does not contain an event-specific preference field.

## Validation required before rollout

1. Confirm member A can see activity from their own private group and cannot read another group's activity.
2. Confirm a nonmember cannot read a private group's activity through the UI or direct API request.
3. Confirm a member's notification center shows only that member's group-related notifications.
4. Confirm invitation, discussion, reply, and event notifications link to the correct group.
5. Confirm duplicate trigger variants appear once in the UI.
6. Confirm Mark read updates only the selected user's notification row.
7. Confirm Mark all read updates every group-notification source row, including collapsed duplicates.
8. Confirm preference changes persist and affect subsequent invitation/discussion/reply notification creation according to existing database triggers.
9. Confirm the existing event trigger behavior is unchanged and no unsupported event preference is exposed.
10. Test desktop and mobile layouts, signed-out discovery, empty states, and database error states.
11. Run the existing Connection Groups synthetic RLS test suite locally after full migration replay.
12. Review browser console, network requests, RLS behavior, and cache-busted asset loading.

## Release status

- Feature code committed to the follow-on feature branch.
- Parent invitation/events feature remains unmerged and undeployed.
- This phase is also unmerged and undeployed.
- Production inspection was read-only; no database data or schema was changed.
- Automated JavaScript tests, local SQL replay, and browser acceptance tests have not been run.
