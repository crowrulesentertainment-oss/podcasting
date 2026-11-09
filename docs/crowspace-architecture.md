# CrowSpace — Database Architecture

**Product:** CrowSpace  
**Tagline:** Your people. Your voice. Your community.  
**Parent platform:** CrowRules Podcasting  
**Identity rule:** one Supabase Auth account, one existing Podcasting member identity, one CrowSpace social identity.

## Architecture decisions

1. Supabase Auth `auth.users.id` is the canonical sign-in identity.
2. `public.members.user_id` is the existing Podcasting member-to-auth link. Do not create a second member or a second login for CrowSpace.
3. `public.crowspace_account_links` is a small, RLS-protected bridge from Auth user ID to the existing `members.id`. It is populated for existing members and maintained when a member's `user_id` is inserted or changed.
4. `public.podcast_member_profiles` remains the current social profile/preferences record (avatar, cover, bio, tagline, visibility controls).
5. Existing posts, follow edges, friendships, post likes/comments, albums and album photos remain in place. Do not migrate or duplicate their data into a parallel CrowSpace schema.
6. The existing `public.crowspace_profiles` table is a portfolio/creator presentation model with its own fields. It is not silently repurposed as the core member profile.
7. Authorization belongs in Postgres RLS. Browser code uses only the existing publishable key and the signed-in user's session. Never ship service-role credentials.

## Existing domain map

| Capability | Existing table(s) | Direction |
|---|---|---|
| Login identity | `auth.users` | Canonical authentication |
| Podcasting member | `members` | Existing member record |
| CrowSpace identity bridge | `crowspace_account_links` | New one-to-one Auth/member mapping |
| Member roles | `member_roles`, `creators` | Keep role system; do not copy roles into social tables |
| Social profile and privacy | `podcast_member_profiles` | Existing profile source |
| Public profile discovery | `crowrules_public_profiles` view | Existing public directory projection; review its view security separately |
| Posts and timeline | `podcast_member_posts` | Existing timeline |
| Post engagement | `podcast_member_post_likes`, `podcast_member_post_comments`, `podcast_member_post_shares` | Existing engagement |
| Followers | `podcast_member_follows` | Directed follow relationship |
| Friends | `friendships` | Two-way request/accept relationship |
| Photo albums | `crowspace_albums`, `crowspace_album_photos` | Existing photo library |
| Messaging | `podcast_direct_messages`, `community_messages` and related conversation tables | Audit and consolidate behind one Messenger UI before creating more message storage |
| Notifications | `community_notifications`, `podcast_notifications` and related tables | Audit and consolidate delivery/read UX before adding another notification store |

## New identity bridge

Migration: `supabase/migrations/20261108000000_crowspace_account_identity_bridge.sql`

- Adds a partial unique index on `members.user_id` so a single Auth user cannot map to multiple member rows.
- Creates `crowspace_account_links(auth_user_id, member_id, linked_at)`.
- Backfills only existing rows with an explicit non-null `members.user_id`; it does not guess-match by email or display name.
- Adds a trigger to keep the bridge synchronized when a member is inserted or its Auth user link changes.
- Enables RLS. Authenticated users can select only their own bridge row. No browser insert/update/delete grants are provided.
- Both foreign keys cascade on deletion, keeping the bridge from becoming orphaned.

## Privacy and authorization model

- Public profile fields are read according to profile visibility settings.
- Private activity is not made public merely because a profile exists.
- Followers and friends are distinct: following is one-way; friendship requires acceptance.
- Only the owner can create, edit or delete their posts, profile settings, albums and photos.
- Direct messages are visible only to conversation participants.
- Group membership and moderation permissions must be checked server-side/RLS, never trusted from editable user metadata.
- User-editable `raw_user_meta_data` is display/profile data only, never an authorization source.
- Storage paths should be scoped to the authenticated user's UUID and protected by Storage RLS.
- Do not expose email addresses or internal member IDs in public profile projections.

## Planned logical modules (reuse-first)

### 1. My Space
Profile, avatar/cover, bio, interests, social links, privacy controls, profile sections, creator/host badges and podcast activity. Uses `podcast_member_profiles`, `members`, `member_roles`, `creators`.

### 2. The Feed
Posts, media attachments, comments, reactions, shares, pinned posts and privacy audiences. Uses current `podcast_member_posts` and engagement tables. A later migration can normalize reactions if current likes are too narrow.

### 3. Friends & Followers
Friend requests/acceptance and following. Uses `friendships` and `podcast_member_follows`. Add block/report controls before public-scale growth.

### 4. Messenger
One-to-one and group conversations, participants, messages, read receipts, attachments, mute/archive and message requests. First audit existing `podcast_direct_messages` and `community_messages` schemas and policies; do not add another message system until their overlap is understood.

### 5. Albums & Media
Albums, photos, captions, ordering, visibility, moderation and storage paths. Uses `crowspace_albums` and `crowspace_album_photos`.

### 6. Communities
Public/private groups, membership requests, roles, group posts, events and moderation. These are the first clearly missing social-domain entities; design after the current membership and admin models are audited.

### 7. Notifications
A unified in-app notification experience over existing notification sources, with per-category preferences, read state and delivery deduplication. Consolidate the current notification tables only after dependencies are mapped.

### 8. Podcast Connect
Follow shows/creators, save episodes, share listening activity with explicit privacy controls, show creator/host status and community discussions. Reuse podcast tables and existing role assignments.

## Rollout sequence

1. **Identity foundation (completed):** inspect existing schema; add the Auth-to-member bridge; backfill; secure with RLS; verify counts and grants.
2. **Profile integration:** make CrowSpace use the current signed-in member and existing social profile; no new sign-up path.
3. **Social graph hardening:** audit friendship/follow constraints, duplicate prevention, blocking and privacy.
4. **Feed polish:** unify post, reaction, comment and share behavior.
5. **Messenger audit and build:** choose one canonical conversation model after policy review.
6. **Communities and events:** add group tables with role-based membership and moderation.
7. **Notifications and discovery:** unify feeds and add recommendations only after privacy rules are settled.

## Verification performed

- Existing member records: 5 linked rows, 5 distinct Auth users, 0 duplicate Auth user IDs.
- Existing social profiles: 5.
- After migration: 5 bridge rows, 5 distinct Auth users, 5 distinct member IDs.
- RLS enabled on bridge table.
- Authenticated SELECT grant present; authenticated INSERT and anonymous SELECT absent.
- Security advisor also reported pre-existing findings on `podcast_public_member_profiles`, `crowrules_public_profiles` (security-definer views), and `sync_creator_host_member_roles()`. These were not changed by this migration and should be reviewed separately.

## Non-goals for this foundation

- No new Auth provider or separate CrowSpace account.
- No email-based identity merging.
- No changes to existing member roles or creator/host assignments.
- No broad RLS policy replacement.
- No deletion or migration of existing posts, friendships, albums, messages or notifications.
