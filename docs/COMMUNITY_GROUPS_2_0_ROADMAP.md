# CrowRules Podcasting — Community Groups 2.0 Roadmap

Status: product-approved roadmap; release dates are not committed.

## Delivery strategy

Ship independently reviewable releases. Preserve the current Groups foundation and existing group IDs, membership, posts, replies and policies. Do not enable a feature until its data contract, authorization, tests and recovery behavior are reviewed.

## Release 2.0 — Core community experience

- Group homepage and identity: cover/avatar, description, guidelines, owner/moderators, featured posts.
- Community feed: post types, newest/popular/unanswered filters, pinned posts, announcements.
- Reactions and personal bookmarks.
- Owner/moderator management center.
- Privacy and membership workflows: public, private, approval-required.
- Invitations, request review and member role controls.

Acceptance: existing public directory, join/leave, posts and replies regressions pass; privacy is verified at the database layer; mobile and accessibility checks pass.

## Release 2.1 — Participation

- Polls: single/multiple choice, close time, result visibility, one vote per member.
- Member directory: searchable, privacy-aware, opt-in discoverability.
- Member introductions and invitations.
- Notification preferences and in-app notification center.

Acceptance: duplicate votes rejected, private rosters inaccessible to nonmembers, bookmarks private to their owner, notifications respect preferences.

## Release 2.2 — Events and resources

- Group events: online, in-person and hybrid.
- RSVP, capacity, waitlist, cancellation and reminders.
- Resource library: links and controlled uploads.
- Search, category filters, bookmarks and featured resources.

Acceptance: event ownership and RSVP authorization tested; private event details and private resources remain inaccessible to unauthorized users; upload type/size controls and storage policies tested.

## Release 2.3 — Creator network

- Collaboration listings for co-hosts, producers, editors, researchers and creative teams.
- Guest finder with opt-in profiles and topic tags.
- Invitations, applications and status tracking.
- Reporting and abuse controls.

Acceptance: only explicitly discoverable profiles appear; invitations are private to participants; listing owners can edit/close their own listings; moderator review works.

## Release 2.4 — Optional group chat

- Owner-enabled group chat, disabled by default.
- Realtime text messages, timestamps, link handling and message reporting.
- Mute controls, notification preferences and moderator removal.
- Future topic channels and threaded chat.

Acceptance: realtime authorization is verified for each group; private channels cannot be joined by nonmembers; reconnect, rate-limit, spam and abuse scenarios pass.

## Release 2.5 — Live rooms

- Scheduled audio rooms and listening parties.
- Host, moderator, speaker and listener roles.
- Participant management and room lifecycle.
- Video capability only after provider architecture and authorization review.
- Recording only with explicit consent and retention controls.

Acceptance: server-derived room roles; no arbitrary room creation; host/guest invitation checks; expired/revoked invitations; participant limits; reconnect and device-permission testing.

## Release 2.6 — Analytics and achievements

- Group-level growth and participation metrics.
- Aggregate post, reply, poll, event and resource engagement.
- Achievement catalog and automatic awards.
- Group milestones and member recognition.

Acceptance: no private individual reading/activity surveillance; aggregate outputs only where appropriate; achievement grants are idempotent and resistant to spam.

## Release 3.0 — Connected ecosystem

- Cross-group discovery and recommendations.
- Unified group and creator activity.
- Integrated events, live rooms and creator collaboration.
- Personalized discovery and notification controls.
- Additional integrations after separate security and privacy review.

## Sequencing and dependencies

| Capability | Depends on |
|---|---|
| Reactions/bookmarks | Existing feed and membership authorization |
| Polls | Poll schema, vote uniqueness, group authorization |
| Member directory | Public profile projection and roster RLS |
| Events | Audited event schema, RSVP uniqueness and policies |
| Resource library | Private Storage bucket, object path rules and signed URLs |
| Creator collaboration | Listing/application data model and profile opt-in |
| Guest finder | Explicit guest discoverability and invitation workflow |
| Chat | Supabase Realtime authorization, moderation and rate limiting |
| Live rooms | Trusted session records, server-side role derivation, provider security |
| Analytics | Aggregation strategy and access controls |
| Achievements | Event/participation ledger and idempotent award rules |

## Delivery rule

Do not bundle every subsystem into one production migration or one pull request. Each release gets its own implementation branch, review, test evidence and deployment decision. No production schema, RLS, grant, storage or provider configuration change is implied by this roadmap.
