# CrowRules Tacoma Community Partner Network

Standalone development build stored in the CrowRules Podcasting repository under `tacoma-community-partner-network/`. It remains intentionally separate from the live Podcasting homepage, navigation and existing partnership pages.

## Public experience
- Expanded cinematic, responsive landing page focused on Tacoma, Pierce County and the South Sound.
- Mission, community principles and six practical collaboration pathways.
- Ten organization categories.
- Searchable and filterable approved partner directory, including category, organization, location, mission and profile-description matching.
- Featured partner section controlled from the administration center.
- Expanded organization profiles with mission, full description, city/community, approved public contact details and social links.
- Partner verification status (pending, verified or unverified); only administrator-approved verified records display a public verification marker.
- Organization logo and cover-image support on partner profiles. Application logos can be submitted through the existing secure Edge Function upload; cover and profile image URLs are managed by administrators.
- Clear participation expectations: no application fee, membership dues, required donation or financial contribution.
- Five-step application and collaboration explanation.
- Community commitments and frequently asked questions.
- Accessible skip link, responsive navigation, semantic sections and reduced-motion support.
- Expanded partner application fields for audience served and collaboration interests.
- Optional organization logo upload with image preview; accepts JPG, PNG or WebP up to 2 MB.

## Files
- `index.html` — public network homepage, directory, application form and informational sections.
- `assets/network.css` — responsive visual system and expanded page styles.
- `assets/network.js` — public partner directory and application submission.
- `admin.html` and `assets/admin.js` — separate Supabase-authenticated partner listing administration interface, featured controls, verification status and partner-application review tools.

## Current integrations
- Uses the existing Supabase project `cevylpnoexugwgygvtgu`.
- Reads active records from `podcast_public_partners` using the existing public-read RLS policy.
- Phase 1 adds nullable profile fields and a constrained `verification_status` column to the existing `podcast_public_partners` table. Existing partner records and RLS policies are retained.
- Application review reads and updates `business_inquiries` records where `interest='partnership'`, using the existing administrator-only RLS policy and existing status values. No new application table or public application-data access is added.
- Submits applications through the existing `partnership-application` Edge Function.
- The Edge Function securely uploads optional logos to the existing public `podcast-artwork` bucket using its server-side credential, then includes the public logo URL in the saved inquiry message and notification email. No storage upload permission is granted to anonymous browsers.
- Uses only the browser-safe Supabase publishable key. No service-role key or server secret is included.
- Partner listing visibility and administrator permissions remain governed by existing database RLS policies.
- The expanded application fields are included in the existing message field to avoid requiring a database schema or Edge Function contract change.

## Phase 2 implementation notes
- Public community board with collaboration, volunteer, resource-offer and resource-request opportunity types.
- Collaboration Matchmaker suggests potential connections based on matching categories, city/community and overlapping terms in published offers and requests. Suggestions are automated prompts, not endorsements or confirmed matches.
- Partner announcements and a month-navigable community events calendar.
- Public submission forms for opportunities, announcements and events. Submissions enter a pending state and are not public until approved.
- Administration moderation queues for all three Phase 2 content tables, with pending, published, rejected and archived states.
- New tables: `community_opportunities`, `community_announcements` and `tacoma_partner_events`. RLS is enabled on all three. Anonymous and authenticated users may submit pending records and read published records; only authenticated CrowRules administrators authorized by the existing `private.crowrules_is_admin_impl()` helper can review, update or delete records.
- Public content fields contain no applicant email or private contact fields. Submitters may provide a public website/contact URL, which is displayed only after publication.
- Events store timezone-aware timestamps; event listings display in each visitor's local timezone.

## Phase 1 implementation notes
- Partner directory now supports featured cards, expanded details, public-approved contact channels, social links, city/community search and verification badges.
- Administration supports profile editing, logo/cover image URLs, mission and full profile text, featured status, publication status and verification status.
- Application review displays private submission details, allows status changes using the existing allowed statuses (`new`, `reviewing`, `contacted`, `qualified`, `closed`, `spam`) and saves administrator-only notes.
- Applicant logo upload remains server-side through the existing Edge Function and `podcast-artwork` bucket. No anonymous Storage upload policy was added. For cover photos, administrators currently provide an HTTPS image URL; direct cover-photo upload is not part of this phase.

## Isolation and release status
The files are committed to the repository's `main` branch, but no link has been added to the live CrowRules Podcasting homepage or navigation. The page should be treated as a development build until the live directory schema, Edge Function payload, form delivery, email notifications, administrator access, Phase 2 submissions and moderation, and responsive behavior have been tested end to end.

Do not add a live-site link or describe the application flow as production-ready until those checks are complete and the owner approves the release.

## Testing checklist
1. Preview the directory from a staging deployment or temporary Pages workflow.
2. Confirm public SELECT returns only approved active partner records.
3. Confirm the selected directory fields match the actual `podcast_public_partners` schema.
4. Submit a controlled test application and verify it appears in the existing administration workflow.
5. Confirm the notification result and email delivery.
6. Test administrator sign-in, partner creation, editing and publishing under existing RLS controls.
7. Test mobile navigation, keyboard access, search, category filtering, form validation and honeypot behavior.
8. Test all three Phase 2 public submission forms and verify new rows remain pending and invisible until administrator approval.
9. Test all three moderation queues, including publishing, rejection and archiving.
10. Test match suggestions, category filtering, event month navigation and timezone display.
11. Only after approval, decide whether to add a link from the live Podcasting site.

## Scope protection
Phase 2 adds three isolated community-content tables with RLS. It does not change the existing `community_events` table or its policies, Phase 1 partner records, authentication settings, Edge Functions or existing live Podcasting pages.
