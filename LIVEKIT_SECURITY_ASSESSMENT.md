# LiveKit Authorization Assessment

Assessment date: 2026-11-14
Scope: read-only review of Render service configuration, the deployed source branch, and the browser-side token call path. No Render settings, secrets, service deploys, or production code were changed.

## Service observed

- Render service: `crowrules-livekit-token-service`
- Repository/branch: `crowrulesentertainment-oss/podcasting`, `main`
- Start command: `cd livekit-token-service && npm start`
- Runtime: Node.js; one instance; automatic deploy on commits
- Public service URL: `https://crowrules-livekit-token-service.onrender.com`
- Public network access is enabled.
- The health endpoint reports only whether configuration values are present; it does not reveal their values.

## Confirmed authorization weaknesses

### Critical: caller controls role and room name

The `POST /api/token` handler verifies that the caller has a valid Supabase session, but then accepts `roomName` and `role` directly from the request body. It allows `listener`, `guest`, and `creator`, without checking any creator record, approved guest profile, invitation, or persisted room/session record.

Consequences:
- Any authenticated account can request a `creator` token; the service does not verify that the user has a creator profile.
- Any authenticated account can request a `guest` token; the service does not verify approved guest status.
- Any authenticated account can request a token for an arbitrary room name; the service does not verify that the user was invited to that room or that the room belongs to a real active podcast session.
- `creator` and `guest` both receive `canPublish: true`, so client-side UI restrictions are not authorization controls.
- The server creates the requested room when issuing a token. Room-name entropy is not a substitute for server-side access control.

This is a real authorization gap. A leaked or guessed invite room name is not the only concern: any authenticated user can submit an arbitrary room name directly to the token API.

### High: guest approval is enforced only in the browser

The current browser app checks for an approved `podcast_guest_profiles` record when a user lacks a creator profile, and then sends `role: "guest"`. The token service does not repeat that check. Direct API calls bypass the browser check.

### High: no room-to-podcast/session binding

The service does not resolve room names against a trusted podcast/session record, check session status, or validate the caller's host/guest assignment for that particular session. A room identifier is treated as an arbitrary string.

### Medium: permissions are broader than role labels imply

- `listener` cannot publish media but can publish data.
- `guest` and `creator` can publish media without differentiating audio, video, or other published track sources.
- The token metadata role is informational; LiveKit permissions must be enforced by server-issued grants and database authorization.

The current browser UI starts microphone/camera locally and records through the browser studio flow. The reviewed token service does not issue a separate server-side egress/recording grant. Recording controls and recording storage still need their own owner/session checks.

### Medium: rate limit is process-local and IP-based

The token endpoint uses an in-memory map with a 60 requests/minute threshold keyed by `req.socket.remoteAddress`. This state is lost on restart and is not durable or user/session aware. It should be replaced with an atomic shared limiter, with authenticated per-user limits and carefully configured network-level protection.

## Positive controls observed

- Supabase access tokens are validated against the Supabase Auth `/auth/v1/user` endpoint; caller-supplied user IDs are not trusted.
- Token identity is bound to the authenticated Supabase user ID.
- Tokens expire after 10 minutes.
- CORS uses an explicit origin allowlist.
- Response headers include `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer`.
- Request bodies are capped at 16 KiB.
- Room capacity is capped at 10 participants, and LiveKit's room participant limit is set server-side.
- LiveKit API credentials remain server-side.

## Required remediation design

1. Create a trusted room/session record when a creator starts a session. Generate a cryptographically random invite secret or invitation record; store only a hash where practical, set expiry, and support revocation.
2. For host token requests, resolve the authenticated user through `members` → `creators`, verify ownership of the podcast/session, and confirm the session is open.
3. For guest requests, require an approved `podcast_guest_profiles` record plus an explicit invitation/assignment for the target session. Do not trust a browser-provided role.
4. For listener requests, require a valid session membership/invite and issue subscribe-only grants. Decide explicitly whether data publishing is needed for chat; if so, scope it separately and rate-limit it.
5. Derive the role and LiveKit grants entirely on the server from trusted database state. Restrict track sources (audio/video) based on session settings and role.
6. Bind every token to a server-resolved room, authenticated identity, assigned role, and short TTL. Do not create arbitrary rooms from a raw client-supplied room name.
7. Make invitation tokens revocable, expiring, and optionally single-use or limited-use. Do not treat the room name in the URL as the invitation credential.
8. Replace the in-memory limiter with atomic shared rate limiting keyed by authenticated user and additional abuse signals.
9. Add tests for anonymous requests, ordinary authenticated members, approved/unapproved guests, invited/uninvited guests, creators joining their own/another creator's room, expired/revoked invites, arbitrary room names, role escalation, and participant-cap races.
10. Preserve the existing 10-person room capacity, audio/video modes, guest invitations, and browser-side recording workflow while moving authorization checks to the server.

## Deployment status

No remediation has been applied to the Render service. No secrets were read or changed. Because Render is configured for automatic deployment from `main`, do not commit a fix to `main` until it has been reviewed and tested in an isolated preview/staging service. The security status remains **not verified / not certified**.
