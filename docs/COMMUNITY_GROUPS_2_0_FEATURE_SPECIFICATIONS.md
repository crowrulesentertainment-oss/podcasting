# CrowRules Podcasting — Community Groups 2.0 Feature Specifications

Status: product specification based on the confirmed decisions. All features are intended to remain free.

## 1. Group identity and homepage

Fields: name, description, category, tags, avatar, banner, guidelines, welcome text, owner, moderators, visibility, created date and enabled add-ons.

Requirements:
- Public shareable URL.
- Featured/pinned content and group announcements.
- Clear privacy label and member count only when count disclosure is permitted.
- Owner edit workflow with validation and preview.
- Moderators may edit only fields explicitly delegated by owner.
- Safe image upload, private storage paths and signed media URLs where required.

## 2. Privacy and membership

Visibility modes:
- Public: discoverable; public content can be viewed by visitors; participation requires membership.
- Private: discoverability and content access restricted to members/invited users, according to owner configuration.
- Approval-required: public group listing, but access to member content requires approved membership.

Requirements:
- Join, leave, request, approve, reject, invite, revoke invite and remove member.
- Roles: member, moderator, owner.
- Unique membership per group/user.
- Owner self-removal protection and explicit owner-transfer process.
- Every read and write must be scoped to group membership/role in database policies.
- Client-side checks are UX only.

## 3. Community feed

Post types: discussion, question, announcement, podcast episode, media/resource and poll.

Requirements:
- Latest, popular, unanswered and featured views.
- Pin/unpin and lock/unlock by authorized moderators.
- Edit/delete own content; moderation actions separately authorized.
- Safe URL previews and validated embeds.
- Content length, file size and type limits enforced on server/storage.
- Report flow and moderator queue.
- Bounded pagination and explicit group scoping.
- User-generated text escaped; no unsafe HTML rendering.

## 4. Polls

- Single-select and multi-select.
- 2–10 options per poll.
- Optional closing timestamp.
- Configurable result visibility: after vote or after close.
- One active vote per user/poll; changing vote follows poll configuration.
- Closed polls reject new votes at database level.
- Creator can edit before first vote; after votes begin, only close/cancel.
- Aggregate results; never expose individual voter identities in public responses.
- Report and moderator removal.

## 5. Events

- Types: meetup, listening party, AMA, workshop, interview, livestream and other.
- Online, in-person and hybrid location types.
- Start/end timestamps stored consistently; display in user's local timezone and label timezone.
- RSVP: going, interested, declined.
- Optional capacity, waitlist, cancellation and rescheduling.
- Meeting links visible only to authorized attendees where the event is private.
- Event reminders respect in-app/email preferences; promotional email requires explicit opt-in.
- Organizer/moderator controls and event audit history.

## 6. Resource library

- Resource types: document, audio, video, episode, link, guide and template.
- Metadata: title, description, category, uploader, created/updated time, visibility.
- Search, filter, sort, bookmark, feature and report.
- Upload allowlist, size limits, malware scanning strategy and safe download headers.
- Private group files use private bucket/object policies and short-lived signed URLs.
- Deleting a resource must define whether the underlying object is removed or retained for audit/restore.

## 7. Member directory

- Search by public display name/username and opt-in skill/topic tags.
- Display only approved public profile fields.
- Group membership visibility follows group privacy.
- Member can control optional introduction, interests and guest/collaboration discoverability.
- Never query or display private account fields.
- Directory must not reveal private groups or membership to outsiders.

## 8. Reactions and bookmarks

Reactions: like, love, helpful, interesting, celebrate.
- One reaction per member/content item; changing reaction replaces previous.
- Counts are aggregate.
- Bookmark is private to the signed-in member.
- Bookmark/unbookmark is idempotent.
- Deleting or hiding content handles related reactions/bookmarks consistently.
- No public endpoint exposes a user's saved-content list.

## 9. Optional group chat

- Disabled by default and enabled only by owner.
- Text-only first release; no file uploads in initial chat.
- Group membership required for read/write.
- Message author identity derives from authenticated session.
- Rate limiting, length limits, spam/report controls, mute preferences and moderator delete.
- Realtime subscriptions use authorization-aware channels; no client-trusted room names.
- Disabling chat blocks new access but does not silently delete retained history.

## 10. Live rooms

- Scheduled room record tied to group and authorized host.
- Roles derived server-side: host, moderator, invited speaker, listener.
- Short-lived tokens, explicit invitations, expiry and revocation.
- No arbitrary client-selected room/role.
- Participant cap and rate limits.
- Audio first; video after separate architecture review.
- Recording disabled by default; if added, explicit participant notice/consent, retention period and deletion process are mandatory.
- Room lifecycle: scheduled, open, ended, cancelled.

## 11. Creator collaboration

Listing types: co-host, guest, editor, producer, researcher, designer, video editor, project team.
- Creator can publish, edit, pause and close own listing.
- Applicants send private request with message and relevant public portfolio links.
- Listing owner can review, accept, decline and mark filled.
- No guarantee of payment or employment; opportunity terms must be explicit.
- Reporting, blocking and moderation controls.
- All listings remain free to browse and use.

## 12. Guest finder

- Guest discovery is opt-in.
- Guest profile fields: introduction, topics, expertise, languages, format preferences, public portfolio links and availability notes.
- No private contact details displayed by default.
- Creators send invitation requests through the platform.
- Guest accepts/declines; accepted invitations reveal only the information needed to coordinate.
- Opt-out immediately removes profile from discovery.
- Report and block controls.

## 13. Group analytics

- Membership totals and growth over time.
- Active-member counts using a documented privacy-preserving definition.
- Posts, replies, reactions, poll responses, event RSVPs and resource engagement.
- Aggregate-first; no individual reading history or sensitive behavioral profile.
- Owner/moderator-only access.
- Minimum cohort thresholds for any breakdown that could identify an individual.
- Analytics retention and deletion policy documented.

## 14. Achievements

Initial catalog: First Post, First Reply, Helpful Contributor, Conversation Starter, Community Builder, Event Organizer, Poll Participant, Resource Contributor, Creator Collaborator and Founding Group Member.

- Eligibility computed from trusted server-side events.
- Idempotent awards; no duplicate award rows.
- Meaningful contribution thresholds, anti-spam and abuse protections.
- User can hide achievements from public profile where supported.
- No achievement should encourage harassment, excessive posting or artificial engagement.

## 15. Global requirements

- Responsive from 320px through desktop.
- Keyboard access, visible focus, semantic headings and labels.
- WCAG 2.1 AA automated checks plus manual screen-reader testing.
- Loading, empty, error, offline and success states.
- User-controlled in-app and email notification preferences.
- Clear privacy labels and accessible moderation/reporting.
- No paid features, paid upgrades or paywalls.
