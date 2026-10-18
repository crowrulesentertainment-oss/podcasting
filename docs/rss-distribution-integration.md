# RSS distribution integration

CrowRules Podcasting uses its public RSS feed as the canonical source for podcast directories. The creator Distribution Center now runs a server-side feed preflight and supports a real Podcast Index submission API path when write credentials are configured.

## What is automated

- Authenticated `podcast-rss-distribution` Edge Function checks that the signed-in user can manage the podcast.
- RSS preflight checks publication state, metadata, HTTPS URLs, feed XML structure, published episodes, enclosure fields, GUIDs, publication dates, artwork reachability, and audio URL reachability.
- Podcast Index submission calls `GET https://api.podcastindex.org/api/1.0/add/byfeedurl` using the documented API key/date/SHA-1 authorization headers.
- A submission is marked `submitted` only when Podcast Index returns a successful provider response. The returned feed ID and provider-confirmed result are written to `podcast_distribution_status` and an audit event is recorded in `podcast_distribution_events`.
- Manual directory updates are audited and remain separate from provider-confirmed submissions.

## Required Supabase Edge Function secrets

Set these secrets in Supabase project `cevylpnoexugwgygvtgu` before using the automated Podcast Index button:

- `PODCAST_INDEX_API_KEY` — Podcast Index API key with **write** permission.
- `PODCAST_INDEX_API_SECRET` — matching Podcast Index API secret.

Keep both values in Supabase Edge Function secrets. Do not add them to GitHub, `config.js`, browser JavaScript, or client-side settings. The page only receives a boolean indicating whether the credentials exist.

If either secret is missing, the endpoint returns a configuration warning and does not call Podcast Index.

## Platforms that still require manual submission

Apple Podcasts Connect, Spotify for Creators, Amazon Music, and YouTube Music/RSS ingestion require creator account steps and/or review through their official portals. This implementation provides portal links and readiness information but does not claim these providers have public APIs for submitting a new show. A user must complete the portal workflow and record the actual outcome.

Apple provides an RSS-prefilled submission URL. Passing RSS preflight is not a guarantee of directory acceptance; provider validation and editorial review remain authoritative.

## Audit and access controls

- `podcast_distribution_events` has RLS enabled. Authenticated users can read events only for podcasts they manage through `podcast_creators.can_manage`.
- Event writes are performed by the Edge Function using the service role; no client insert policy is granted.
- Provider credentials and the Supabase service-role key are never returned to the browser.
- Do not mark a directory as `listed` unless a public listing has actually been verified.

## Deployment checklist

1. Confirm migration `202610170001_podcast_distribution_events.sql` is applied.
2. Configure the two Podcast Index secrets above.
3. Open Creator → Distribution Center, select a published podcast, and run **Run live feed checks**.
4. Resolve all blocking checks and review warnings.
5. Use **Submit to Podcast Index** only when ready. Confirm the provider response and listing link.
6. Complete other directory submissions in their official portals and record their real status.