# CrowRules Podcasting

Cinematic podcasting platform for CrowRules Entertainment.

**Launch target:** January 1, 2027  
**Tagline:** Your Voice. Your Story. Your Universe.

## Repository ecosystem

The repository contains the multi-page Podcasting ecosystem: public discovery, listening, membership, creator publishing, Creator Studio, analytics, monetization, support, administration, and account workflows.

### Navigation

- Master Site Map: site-map.html
- Public entry: index.html
- Browse: podcasts.html, episodes.html, creators.html, discover.html, rankings.html
- Listening: podcast.html, episode.html, live.html, feed.html, my-library.html
- Membership: signup.html, login.html, verify.html, reset-password.html, profile.html
- Creator: create-podcast.html, upload-episode.html, episode-studio.html, creator-studio.html, creator-dashboard.html
- Management: podcast-manager.html, episode-manager.html, edit-podcast.html, edit-episode.html
- Growth & intelligence: analytics.html, podcast-growth.html, podcast-intelligence.html, creator-analytics.html, creator-insights.html
- Monetization: monetization.html, creator-monetization.html, creator-monetization-hub.html, payouts.html
- Support: support.html, support-creator.html
- Administration: admin.html, admin/sponsorship.html

The Site Map links every HTML page currently present in the repository and groups the ecosystem by purpose.

## Supabase

The browser-safe configuration lives in js/config.js. It defines both the current CROWRULES_CONFIG object and legacy aliases used by older pages.

Configured project:
https://cevylpnoexugwgygvtgu.supabase.co

Never put a Supabase service-role key in a GitHub Pages repository.

## GitHub Pages

This repository is structured as a static GitHub Pages site with a top-level index.html entry point, a root-level 404.html recovery page, and a .nojekyll marker.

## Architecture

/
├── index.html
├── site-map.html
├── 404.html
├── css/
│   ├── intro.css
│   └── podcasting.css
├── js/
│   ├── app.js
│   ├── config.js
│   └── intro.js
├── admin/
├── supabase/
└── *.html

## Next validation layer

The next hardening step is automated browser-level smoke testing of the major flows: intro → browse → podcast → episode → login/signup → creator studio → create podcast → upload episode → support/monetization.


## Navigation & User Journey 2.0

The Podcasting ecosystem now includes a dedicated `navigation.html` journey hub plus explicit account, membership, creator-guide, and audio-guide destinations. Legacy creator-dashboard paths were repaired, and a navigation audit runs in GitHub Actions to detect broken local HTML routes and missing core journey pages.

Key entry points:
- `navigation.html` — central listener/member/creator journey
- `membership.html` — universal membership hub
- `account.html` — account center compatibility route
- `creator-guide.html` — creator onboarding path
- `audio-guide.html` — audio production path
- `tools/navigation-audit.mjs` — local route and journey audit
