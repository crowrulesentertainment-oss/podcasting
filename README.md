# CrowRules Podcasting

**Every Voice. Every Story. One Universe.**

CrowRules Podcasting is a static GitHub Pages podcast network and creator platform built around Supabase, Stripe-backed creator monetization, browser playback, creator publishing, live production and CrowPoints.

## Current platform

- Cinematic intro at `index.html`
- Launch countdown at `launch.html`
- Listener home, discovery, charts, search, library and subscriptions
- Podcast and episode publishing workflows
- Creator Studio / Creator OS
- Audience analytics, growth and reporting
- Google authentication through Supabase Auth
- Episode progress, saved episodes, follows and listening events
- CrowPoints
- Stripe-backed subscription checkout and creator Connect onboarding
- Live rooms, chat, broadcast sessions and replay lifecycle
- **Podcasting 5.1 Live Production Studio**
  - Camera and microphone capture
  - Browser program preview
  - Scene switching
  - Branded overlays
  - Guest count controls
  - Local WebM recording
  - LiveKit transport bridge
  - Server broadcast state
  - Automated replay/egress hooks
- Responsive single-shell navigation on application pages
- Keyboard command palette with **Ctrl/Cmd + K**
- Mobile navigation
- Lazy image loading and async decoding
- Automated GitHub Pages deployment

## Architecture

```
GitHub Pages
   |
   +-- HTML application pages
   +-- css/podcasting.css
   +-- js/app.js
   +-- js/platform-upgrade.js
   +-- js/live-production.js
   |
   +-- Supabase
   |     +-- Auth
   |     +-- PostgreSQL
   |     +-- Realtime
   |     +-- Storage
   |     +-- Edge Functions
   |
   +-- Stripe
   |     +-- Creator Connect
   |     +-- Products / Prices
   |     +-- Checkout
   |
   +-- LiveKit / broadcast transport
```

## Important security boundary

Only public client configuration belongs in this repository. Supabase publishable/anonymous configuration is suitable for a browser client only when database RLS and server-side authorization are correctly configured. Stripe secret keys, Supabase service-role keys, LiveKit secrets and webhook signing secrets must remain server-side.

GitHub Pages serves static files; server-side work is handled through Supabase Edge Functions and external transport services.

## Podcasting standards direction

The publishing layer is designed to evolve toward standards-based RSS and Podcasting 2.0 support, including transcripts, chapters, people, funding, live items and richer episode metadata.

## Deployment

The repository includes `.github/workflows/pages.yml` for deployment from `main`. Configure GitHub Pages to use **GitHub Actions** as the source.

