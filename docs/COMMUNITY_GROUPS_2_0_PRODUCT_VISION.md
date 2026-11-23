# CrowRules Podcasting — Community Groups 2.0 Product Vision

Status: approved product direction; implementation not yet released.

## Product promise

Community Groups is the all-in-one social community layer inside CrowRules Podcasting. It connects listeners, podcasters, fans, guests, and creative collaborators in communities built around shared interests and projects.

**Product principles**
- Free to use: no paid groups, paid add-ons, feature paywalls, or subscription tiers.
- Optional complexity: owners enable add-ons only when useful to their community.
- Privacy by design: public, private, and approval-required groups have distinct access rules.
- Creator-first, listener-friendly: podcast discovery and collaboration are native use cases.
- One identity: reuse the existing CrowRules Podcasting account and profile.
- Accessible everywhere: responsive desktop/mobile, keyboard operable, screen-reader understandable.
- Trustworthy: database authorization is authoritative; browser visibility is never a security boundary.

## Confirmed product decisions

| Area | Decision |
|---|---|
| Overall direction | All-in-one social community platform |
| Price | All groups and features free |
| Chat | Optional per-group add-on |
| Privacy | Public, private, and approval-required |
| Priority add-ons | Polls, events, resource library, member directory, reactions/bookmarks, live rooms, group chat, creator collaboration, guest finder, analytics, achievements |

## Primary navigation

1. Discover — public group directory, categories, search, trending and recommended groups.
2. My Groups — joined groups, owned groups, pending requests, invitations and activity.
3. Community Feed — joined-group posts, discussions, questions, episodes, announcements and polls.
4. Events & Live — events, RSVPs, live rooms and listening parties.
5. Creator Network — collaboration opportunities, guest discovery and co-host matching.
6. Group Management — owner/moderator controls, add-ons, membership, moderation and analytics.

## Roles

- Visitor: discover public groups and view only content permitted by group visibility.
- Member: participate in the group, subject to its rules and enabled features.
- Moderator: perform assigned moderation and member-management actions.
- Owner: manage group identity, privacy, add-ons, moderators and group lifecycle.
- Platform administrator: platform-level safety and support powers, enforced server-side.

A group owner cannot remove their own owner role through ordinary member actions. Owner transfer and group deletion require explicit, audited flows.

## Add-on model

Add-ons are feature flags stored in trusted group settings, not UI-only toggles. Defaults are conservative:
- Polls: off until enabled by owner.
- Events: available to owners/moderators; public listing follows group visibility.
- Resource library: off until enabled by owner.
- Member directory: visibility follows group privacy and member profile preferences.
- Reactions/bookmarks: reactions available when feed interactions are enabled; bookmarks are private to the account.
- Chat: off by default; owner opt-in.
- Live rooms: owner/moderator scheduled; host and speaker permissions enforced server-side.
- Creator collaboration: opt-in listings, no automatic public exposure of private member data.
- Guest finder: opt-in profile discoverability only.
- Analytics: owner/moderator only, aggregate-first.
- Achievements: recognition for meaningful participation; anti-spam safeguards.

## Non-goals for the initial core release

- Paid communities or monetized add-ons.
- Direct messaging between all members.
- Unmoderated anonymous chat.
- Public exposure of private member activity.
- Recording live rooms without explicit notice and consent.
- AI moderation that automatically sanctions users without human review.

## Success measures

- Members successfully discover and join appropriate communities.
- Members return to participate in meaningful discussions.
- Owners can manage privacy, membership and moderation without platform support.
- Creators can find guests and collaborators safely.
- Events and live rooms generate repeat participation.
- No cross-group data leakage or unauthorized writes.
- Core workflows remain usable on narrow mobile screens and assistive technology.
