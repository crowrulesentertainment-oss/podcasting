# CrowRules Tacoma Community Partner Network

Standalone development build stored in the CrowRules Podcasting repository under `tacoma-community-partner-network/`. It remains intentionally separate from the live Podcasting homepage, navigation and existing partnership pages.

## Public experience
- Expanded cinematic, responsive landing page focused on Tacoma, Pierce County and the South Sound.
- Mission, community principles and six practical collaboration pathways.
- Ten organization categories.
- Searchable and filterable approved partner directory.
- Clear participation expectations: no application fee, membership dues, required donation or financial contribution.
- Five-step application and collaboration explanation.
- Community commitments and frequently asked questions.
- Accessible skip link, responsive navigation, semantic sections and reduced-motion support.
- Expanded partner application fields for audience served and collaboration interests.

## Files
- `index.html` — public network homepage, directory, application form and informational sections.
- `assets/network.css` — responsive visual system and expanded page styles.
- `assets/network.js` — public partner directory and application submission.
- `admin.html` and `assets/admin.js` — separate Supabase-authenticated partner listing administration interface.

## Current integrations
- Uses the existing Supabase project `cevylpnoexugwgygvtgu`.
- Reads active records from `podcast_public_partners`.
- Submits applications through the existing `partnership-application` Edge Function.
- Uses only the browser-safe Supabase publishable key. No service-role key or server secret is included.
- Partner listing visibility and administrator permissions remain governed by existing database RLS policies.
- The expanded application fields are included in the existing message field to avoid requiring a database schema or Edge Function contract change.

## Isolation and release status
The files are committed to the repository's `main` branch, but no link has been added to the live CrowRules Podcasting homepage or navigation. The page should be treated as a development build until the live directory schema, Edge Function payload, form delivery, email notifications, administrator access and responsive behavior have been tested end to end.

Do not add a live-site link or describe the application flow as production-ready until those checks are complete and the owner approves the release.

## Testing checklist
1. Preview the directory from a staging deployment or temporary Pages workflow.
2. Confirm public SELECT returns only approved active partner records.
3. Confirm the selected directory fields match the actual `podcast_public_partners` schema.
4. Submit a controlled test application and verify it appears in the existing administration workflow.
5. Confirm the notification result and email delivery.
6. Test administrator sign-in, partner creation, editing and publishing under existing RLS controls.
7. Test mobile navigation, keyboard access, search, category filtering, form validation and honeypot behavior.
8. Only after approval, decide whether to add a link from the live Podcasting site.

## Scope protection
This page update does not create or alter database tables, RLS policies, authentication settings, Edge Functions or existing live Podcasting pages.
