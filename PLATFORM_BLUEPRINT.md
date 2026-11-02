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
- Profile, library, saved shows, playlists and listening history
- Persistent audio/video player
- Resume playback and queue
- Comments, follows and notification preferences

### Stage 3 — Creator onboarding and studio
- Application review workflow
- Secure creator entitlement assignment
- Show and episode management
- Upload lifecycle, scheduling, publishing and analytics

### Stage 4 — Community and discovery
- Guest Lounge, creator directory, community spaces
- Editorial features, recommendations and curated collections

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
