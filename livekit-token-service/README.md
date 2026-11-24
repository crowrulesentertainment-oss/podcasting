# CrowRules LiveKit Token Service

Private Node.js backend for issuing short-lived LiveKit room tokens to authenticated CrowRules Podcasting members.

## Render configuration

- Runtime: Node
- Root directory: repository root
- Build command: `cd livekit-token-service && npm install`
- Start command: `cd livekit-token-service && npm start`
- Health check: `/health`
- Node: 20 or newer
- Keep automatic deployment from `main` disabled for this security branch until the pull request is reviewed and merged.

## Required Render environment variables

Set these in the Render service Environment page. Never commit secrets or paste them into GitHub:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — browser-safe Supabase publishable key (or `SUPABASE_ANON_KEY` for legacy projects); used only to verify user sessions
- `SUPABASE_SERVICE_ROLE_KEY` — server-only Supabase service-role secret used by this backend to verify creator ownership, create private session/invitation records, and redeem invitations. This key must never be exposed to browser code, GitHub Pages, logs, or API responses.
- `LIVEKIT_URL` — LiveKit server URL, normally the `wss://` endpoint
- `LIVEKIT_API_KEY` — LiveKit API key
- `LIVEKIT_API_SECRET` — LiveKit API secret
- `ALLOWED_ORIGINS` — optional comma-separated browser origins; defaults to `https://crowrulesentertainment-oss.github.io`

The `/health` endpoint reports whether configuration is present without revealing values. Before deployment, verify `authorizationDatabase` is true.

## Endpoints

All POST endpoints require a valid Supabase access token in `Authorization: Bearer <access-token>`.

- `GET /health` — service health and configuration-presence check.
- `POST /api/sessions` — host-only. Body: `{ "mode": "audio" | "video", "podcastId": "optional-owned-podcast-uuid" }`. The server verifies the user's active creator profile, verifies optional podcast ownership, creates a random room name and a four-hour session record.
- `POST /api/invitations` — host-only. Body: `{ "sessionId": "...", "role": "guest" | "listener", "expiresInMinutes": 60, "maxUses": 1 }`. Returns a one-time invitation secret. The database stores only its SHA-256 hash. Guest invitations require an approved Podcasting guest profile at redemption. Invitations may be limited to a user ID or email.
- `POST /api/invitations/revoke` — host-only. Body: `{ "sessionId": "...", "invitationId": "..." }`. Revokes an invitation immediately.
- `POST /api/token` — body must contain either `{ "sessionId": "..." }` for the verified host or `{ "invitationToken": "..." }` for an invitee. The client cannot choose a role or arbitrary room name.

Host and approved guest tokens can publish media; listener tokens are subscribe-only. All tokens expire after 10 minutes. Participant identity is bound to the authenticated Supabase user ID. LiveKit room capacity is enforced server-side at 10 participants.

## Database migration

Apply `supabase/migrations/20261114000200_livekit_session_authorization.sql` before deploying this service. It creates private service-role-only session and invitation tables and an atomic, single-use-aware invitation redemption function. It does not alter existing podcast, guest profile, recording, or playback tables.

## Invitation compatibility

Old links that contained only a room name are intentionally not accepted by the hardened token endpoint. A room name is not proof of an invitation. Hosts must create and share new expiring invitation links after deployment.

## Local checks

```bash
npm install
npm run check
npm start
```

Use a staging Supabase project and staging LiveKit credentials for integration tests. Do not test token creation against production rooms.


## CrowSpace group live-room bridge (Groups 2.0)

The group bridge is additive and separate from the existing creator/podcast sessions and the Live Network Edge Function. It attaches a private LiveKit session to an existing `crowspace_live_rooms` row. The browser UI is `groups/live-rooms.html` with `assets/js/groups-live-rooms.js`; add the deployed Render service HTTPS origin to `LIVEKIT_TOKEN_SERVICE_URL` in `assets/js/config.js` after the backend is deployed.

Apply `supabase/migrations/20261123230000_crowspace_group_livekit_bridge.sql` to a dedicated staging Supabase project before testing these endpoints. Do not apply it to production until the migration and RLS checks have been reviewed and approved.

### Group endpoints

- `POST /api/groups/sessions` — start a LiveKit session for an existing `crowspace_live_rooms` row. Body: `{ "roomId": "...", "mode": "audio" | "video" }`. The server checks that the caller created a public room, is the circle owner/moderator for a community room, or is an owner/admin of the group conversation for a group room.
- `POST /api/groups/sessions/end` — end a host-owned group session. Body: `{ "sessionId": "..." }`. The server ends the linked room record too.
- `POST /api/groups/invitations` — create a time-limited guest/listener invite for a host-owned group session. Body: `{ "sessionId": "...", "role": "guest" | "listener", "expiresInMinutes": 60, "maxUses": 1 }`. Optional `invitedUserId` or `invitedEmail` restricts redemption to that account.
- `POST /api/groups/invitations/revoke` — revoke a pending invitation. Body: `{ "sessionId": "...", "invitationId": "..." }`.
- `POST /api/token` — the existing token route also accepts `{ "groupSessionId": "..." }` for the verified host, `{ "groupRoomId": "..." }` for a signed-in audience member who can view the room, or `{ "groupInvitationToken": "..." }` for a guest/listener invitee.

Public group rooms are joinable by signed-in members. Community and group visibility are membership-gated. A private invite may grant guest/listener access to a nonmember without making the room public. Hosts and guests can publish; listeners are subscribe-only. The server creates each group LiveKit room with a server-enforced 10-participant maximum (including the host). When a host ends a session, the database room is marked ended first to block new tokens, then the LiveKit room is deleted, and finally the session is marked ended. If LiveKit shutdown fails, the ended room blocks new joins and the host can retry the end operation. The server creates unpredictable room names and signs all LiveKit grants; the browser cannot submit a room name or role.

The group session/invitation tables are RLS-enabled and inaccessible to `anon` and `authenticated`; only the token service's server-side service-role credential can access them. The invitation redemption RPC is executable only by `service_role`, and validates the token hash, invitee identity/email, expiry, revocation, use count, active session, and live room state atomically.

### Staging verification required

Test with synthetic room records and separate owner, moderator, member, nonmember, and signed-out identities:

1. Circle owner/moderator can host; ordinary circle member cannot host.
2. Group-conversation owner/admin can host; ordinary group member cannot host.
3. Public room audience can join as listener; public room creator can host.
4. Community/group members can join; nonmembers are denied without an invitation.
5. Guest invitation can publish; listener invitation cannot publish.
6. User-bound/email-bound invitation rejects the wrong identity; expired, revoked, exhausted, or ended-room invitations fail.
7. Ended sessions and ended room records reject new tokens.
8. Participant limit is enforced at 10, including the host.
9. Existing creator podcast and Live Network token flows remain unchanged.

The service still uses a process-local IP rate limiter. Add shared durable rate limiting before scaling to multiple instances. This branch change does not deploy the Render service or apply the migration to production.
