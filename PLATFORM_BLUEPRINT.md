# CrowRules Podcasting — Platform Blueprint

Brand promise: Where Every Voice Has a Platform.  
Company line: One Company. One Universe.  
Publishing model: Open creator applications; administrator approval before publishing access.  
Release model: Staged releases with a full-network architecture.

## Product structure

### Public Network
- Streaming-style homepage and featured hero
- Discover catalogue with search and category filters
- Show and episode detail experiences
- CrowRules Originals
- Trending and editorial collections
- Rankings and chart archives
- CrowRules Podcast Awards
- Guest Lounge
- Live shows and premieres
- Podcast News / The Mic
- Public creator directory
- Community and fan spaces
- Membership and creator-support information

### Listener Network
- Shared Supabase authentication
- Listener profile and preferences
- Followed shows and creators
- Saved episodes and playlists
- Listening history and resume position
- Queue and persistent playback
- Comments, reactions and notifications
- Live chat and community participation
- Privacy, accessibility and account controls

### Creator Network
- Open application intake
- Manual review and creator approval
- Creator profile and public portfolio
- Creator Studio and show management
- Audio/video episode uploads
- Draft, review, scheduled and published states
- Artwork, transcripts, chapters and show notes
- Guest and collaborator workflows
- Audience analytics and distribution
- Live production tools
- Monetization and payout tools when enabled

### Operations Network
- Secure administrator access
- Application review and creator permissions
- Show and episode moderation
- Homepage / featured content controls
- Awards seasons, nominations and verified voting
- Ranking policy and chart snapshots
- Guest Lounge moderation
- Live event oversight
- Reports, audit history and system health

## Release stages

### Stage 1 — Streaming front door
- Netflix-inspired public discovery experience
- Public catalogue sourced from published Supabase shows
- Search and category filtering
- Creator application form connected to the existing application table
- Shared navigation entry points
- Keep the existing pre-launch page and January 1, 2027 target intact

### Stage 2 — Listener experience
**Initial implementation committed:** the authenticated listener dashboard now includes Continue Listening, saved episodes (My List), followed shows (My Shows), private playlist creation, adding saved episodes to playlists, playlist detail playback/removal, and the shared global audio player. These features reuse existing tables and owner-scoped RLS policies. Remaining Stage 2 work: richer recommendation personalization, queue management, playback preferences, cross-device progress reconciliation and listener notifications.
- Profile, library, saved shows, playlists and listening history
- Persistent audio/video player
- Resume playback and queue
- Comments, follows and notification preferences
- Personalized listener recommendations on the dashboard: published shows and playable episodes ranked from followed shows, saved episodes, listening events, category affinity, featured status and popularity. Recommendations use existing tables and require no new schema.

### Stage 3 — Creator onboarding and studio
- Application review workflow
- Secure creator entitlement assignment
- Show and episode management
- Upload lifecycle, scheduling, publishing and analytics

### Stage 4 — Community and discovery
- Guest Lounge, creator directory, community spaces
- Public Listen homepage discovery feed: Trending Now, New Releases, Because You Follow, Continue Listening, CrowRules Spotlight and active-category collections. Personal rows are user-scoped and hidden for signed-out visitors; public rows use published-only catalogue queries.
- Discovery & Editorial Control Room: admin-managed spotlight hero copy/image/show, trending and new-release labels/descriptions, featured show flags, active/featured category collections, category descriptions/artwork/order and public homepage section ordering. Admin access is verified against database member roles and reinforced by Supabase RLS using the existing `crowrules_is_admin()` authority function.

### Stage 5 — Awards, rankings and live
- Transparent chart methodology and historical snapshots
- Awards nominations, eligibility, voting and archive
- Live sessions, premieres, moderation and replays

### Stage 6 — Network expansion
- Monetization and memberships
- Advanced recording / production tools
- Distribution integrations
- Deeper analytics and accessibility improvements

## Technical architecture

- Front end: semantic HTML, CSS and vanilla JavaScript, hosted on GitHub Pages.
- Backend: existing CrowRules Supabase project, using Supabase JS v2.
- Browser key: publishable key only; never expose service-role or secret keys.
- Authorization: database-enforced Row Level Security and trusted admin/creator entitlements. Never trust localStorage, user-editable metadata or client-side role flags.
- Media: Storage policies and optimized delivery; avoid repeatedly downloading large audio/video files.
- Performance: pagination, bounded queries, lazy-loaded artwork, caching and no high-frequency polling.
- Compatibility: preserve existing listener, creator, awards, guest lounge, studio and launch workflows.

## Existing infrastructure to reuse

The current project already contains podcast, episode, category, profile, playlist, listening, ranking, live, notification, creator-submission and media-related database structures. Stage 1 intentionally reuses the existing podcasts, podcast_categories and creator_submissions tables. No duplicate platform schema is introduced by this stage.

## Launch and content policy

- A creator application is not publishing permission.
- New creators remain pending until reviewed and approved.
- Only published shows and published episodes appear in public discovery.
- Rankings must be based on verified platform activity and published methodology.
- Award voting requires eligibility rules, duplicate-vote safeguards and an auditable process.
- Demo or placeholder statistics must never be presented as real audience metrics.


## Discovery homepage publishing

- Discovery editorial changes are stored as an administrator-only draft until explicitly published.
- The public Listen homepage reads only `published_config`; draft content is previewed in an embedded same-origin admin preview and is not exposed to anonymous visitors.
- Publishing records an immutable snapshot in `podcast_discovery_home_revisions`; the database retains the latest 20 published versions.
- Schema setup: `SUPABASE_DISCOVERY_PUBLISHING_SETUP.sql`.


### Homepage revision recovery

- Administrators can inspect archived published configurations, compare an archived snapshot against the current live configuration, and preview a snapshot in the private homepage preview.
- Restoring a snapshot republishes that configuration through the existing admin-only settings update path. The database revision trigger captures the outgoing live configuration before the restored version becomes current.
- Revision history remains bounded to the latest 20 published configurations.
