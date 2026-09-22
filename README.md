# CrowRules Podcasting

Cinematic multi-page podcasting platform for CrowRules Entertainment.

Launch target: **January 1, 2027**.

## Current foundation
- Cinematic responsive UI
- Universal CrowRules membership entry points
- Supabase client foundation
- Launch countdown
- Podcast discovery
- Rankings UI
- Creator page
- Profile/login/signup pages
- Audio-player shell
- Live chat shell

## Supabase
Set the browser-safe Supabase anon key as `window.CROWRULES_SUPABASE_ANON_KEY` before `js/config.js`, or replace the empty value in `js/config.js`. Never place a service-role key in GitHub Pages.

The configured project URL is the CrowRules Supabase project: `cevylpnoexugwgygvtgu.supabase.co`.

## Planned database layer
`podcasts`, `podcast_episodes`, `podcast_hosts`, `podcast_profiles`, `podcast_listening_history`, `podcast_featured`, `podcast_live_rooms`, `podcast_live_messages`, `podcast_live_presence`, and `crowpoints_ledger` should connect to the existing Universal CrowRules Membership identity.
