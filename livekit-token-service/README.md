# CrowRules LiveKit Token Service

Private Node.js backend for issuing short-lived LiveKit room tokens to authenticated CrowRules Podcasting members.

## Render configuration

- Runtime: Node
- Root directory: repository root
- Build command: `cd livekit-token-service && npm install`
- Start command: `cd livekit-token-service && npm start`
- Health check: `/health`
- Node: 20 or newer (Render may use its current supported Node release)

The service folder is intentionally committed at the repository root to match the existing Render build and start commands.

## Required Render environment variables

Set these in the Render service Environment page. Never place secrets in GitHub:

- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY` — browser-safe Supabase publishable key (or `SUPABASE_ANON_KEY` for legacy projects); used only to verify user sessions
- `LIVEKIT_URL` — LiveKit server URL, normally the `wss://` endpoint
- `LIVEKIT_API_KEY` — LiveKit API key
- `LIVEKIT_API_SECRET` — LiveKit API secret
- `ALLOWED_ORIGINS` — optional comma-separated browser origins; defaults to `https://crowrulesentertainment-oss.github.io`

The health endpoint reports whether configuration is present without revealing values.

## Endpoints

- `GET /health` — health and configuration-presence check
- `POST /api/token` — requires a Supabase access token in `Authorization: Bearer <access-token>` and JSON `{ "roomName": "...", "participantName": "...", "role": "guest" }`

Allowed roles are listener, guest, and creator. Listener tokens cannot publish audio/video; guest and creator tokens can publish. Tokens expire after 10 minutes. Participant identity is bound to the authenticated Supabase user ID. API secrets are never sent to the browser.

## Local checks

```bash
npm install
npm run check
npm start
```
