# CrowRules LiveKit Token Service

This service issues short-lived LiveKit access tokens after verifying the user's Supabase identity and ownership of a `podcast_live_sessions` row.

## Required environment variables

- `LIVEKIT_URL` — `wss://crowrules-podcasting-vnq4uif5.livekit.cloud`
- `LIVEKIT_API_KEY` — LiveKit project API key
- `LIVEKIT_API_SECRET` — LiveKit project API secret (server-side only)
- `SUPABASE_URL` — `https://cevylpnoexugwgygvtgu.supabase.co`
- `SUPABASE_ANON_KEY` — Supabase publishable/anon key
- `ALLOWED_ORIGINS` — comma-separated browser origins; default is `https://crowrulesentertainment-oss.github.io`

Never place `LIVEKIT_API_SECRET` in GitHub Pages, browser JavaScript, or a committed file.

## Endpoints

- `GET /health` — service health/configuration (does not reveal secrets)
- `POST /api/livekit/token` — body: `{ "sessionId": "...", "role": "host", "displayName": "..." }`; requires `Authorization: Bearer <Supabase access token>`

The first version intentionally issues host tokens only. It verifies that the signed-in user owns the live session. Co-host invites should be server-issued and validated before allowing co-host publishing; the current browser-only invite token is not sufficient for production authorization.

## Deploy on Render

Create a Node web service from this repository with:
- Build command: `cd livekit-token-service && npm install`
- Start command: `cd livekit-token-service && npm start`
- Health check path: `/health`

Set all required environment variables in the Render service dashboard, then redeploy. The service returns `configured: true` from `/health` when all required settings exist.
