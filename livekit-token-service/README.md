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
