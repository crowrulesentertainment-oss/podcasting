# CrowRules Tacoma Community Partner Network

Standalone development build. This project is intentionally isolated from the live CrowRules Podcasting pages and navigation.

## Files
- `index.html` — public network homepage, categories, searchable partner directory and application form.
- `assets/network.css` — responsive cinematic visual system.
- `assets/network.js` — public partner directory and application submission.

## Current integrations
- Uses the existing Supabase project `cevylpnoexugwgygvtgu`.
- Reads approved active records from `podcast_public_partners`.
- Submits applications through the existing `partnership-application` Edge Function.
- Uses only the browser-safe Supabase publishable key. No service-role key or server secret is included.
- Partner listing visibility remains governed by the existing database RLS policies.

## Important isolation
This work is on the `tacoma-community-partner-network-build` branch under this directory. It has not been added to the live Podcasting homepage, navigation, or existing partnership pages. Do not merge or add a live-site link until the public application flow, directory permissions, mobile layout, and admin review process have been tested and approved.

## Deployment / testing checklist
1. Preview this directory from a separate staging deployment or temporary branch Pages workflow.
2. Confirm Supabase public SELECT returns only approved active partner records.
3. Submit a test application and verify it appears in the existing administration center.
4. Confirm the notification result and Brevo delivery.
5. Test mobile navigation, search, category filtering, form validation and honeypot.
6. Test administrator access and partner publishing through existing RLS-controlled admin tools.
7. Only after approval, decide whether to merge/deploy and add a link from the live Podcasting site.

## Current limitation
The public site reuses the existing partnership Edge Function and public partner table. This initial isolated build does not create or alter database tables, RLS policies, authentication settings, Edge Functions, or the existing live site.
