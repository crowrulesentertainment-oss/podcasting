# CrowRules Podcasting Partnership Headquarters

Public URL: https://crowrulesentertainment-oss.github.io/podcasting/tacoma-community-partner-network/

A cinematic, multi-page partnership hub for CrowRules Podcasting, a division of CrowRules Entertainment. Tacoma and the Pacific Northwest are the founding community; the network welcomes businesses, organizations and individuals from across the United States.

## Public pages
- `index.html` — main partnership headquarters, application, approved directory, FAQ, community board and matchmaker.
- `about.html` — network mission, local roots and participation model.
- `opportunities.html` — collaboration, community, volunteer and media opportunity pathways.
- `directory.html` — live, searchable and filterable Supabase-backed partner directory.
- `sponsorships.html` — sponsorship and advertising overview.
- `creators-guests.html` — cinematic creator and guest recruitment center with six participation pathways, show/format overview, collaboration process, FAQ and introduction form.
- `sponsorships.html` — dedicated sponsorship center with six pathways, transparent process, editorial integrity terms, FAQ and inquiry form.
- All public pages use the shared cinematic visual system in `assets/headquarters.css`.
- `assets/directory.js` and `assets/directory.css` — live partner directory search, filtering and profile cards.
- `assets/sponsorships.js` and `assets/sponsorships.css` — responsive sponsorship experience and secure submission through the existing `partnership-application` Edge Function.
- `assets/creators-guests.js` and `assets/creators-guests.css` — creator/guest pathways, form interactions and secure introduction submission through the existing `partnership-application` Edge Function.

## Administration
- `admin.html` — restricted, noindex administration command center.
- `assets/admin.js` — Supabase-authenticated partner listing editor, application review, visitor analytics, community moderation and email draft center.
- Existing administration sections include overview/analytics, partner editor, directory management, applications, community submission moderation and email templates.
- Existing database RLS remains the authority for administrator access and write permissions.

## Existing integrations preserved
- Supabase project: `cevylpnoexugwgygvtgu`.
- Browser client uses the publishable key only. No service-role key or Resend secret is included in public assets.
- Partner directory reads `podcast_public_partners`.
- General partnership and sponsorship inquiries continue through the existing `partnership-application` Edge Function and private `business_inquiries` review workflow. Sponsorship details are stored in the private inquiry message; no new table or public pricing is introduced.
- Community exchange continues using `community_opportunities`, `community_announcements` and `tacoma_partner_events`; public submissions remain pending until reviewed and published.
- Anonymous traffic measurement continues using `partner_network_analytics` and the existing `partner_network_live_visitors` RPC.
- Public applicants may be businesses, organizations, independent professionals or individuals. Organization/affiliation is optional; applicant type is included in the private application message.
- Network participation is free. Sponsorships and advertising are optional commercial arrangements negotiated separately in writing.

## Security and limitations
- Existing Supabase RLS policies were inspected and retained; this UI rebuild does not create new tables, relax policies or expose private application records.
- Existing global CrowRules administrator authorization remains in force. Fine-grained delegated staff roles are not introduced by this visual rebuild; those require a separately designed and tested authorization model before granting staff database access.
- The Email Center prepares/copies email drafts; it does not send email from the browser. Live sending requires a secured server-side delivery workflow and verified sender domain.
- Partner applications do not guarantee acceptance, a public listing, an interview or a paid role.

## Release validation
After GitHub Pages publishes the latest commits, verify desktop/mobile navigation, all page links, application submission for both individuals and organizations, directory rendering, admin login, partner editing, private application review, community moderation and email draft copying. Confirm public pages never expose private application fields.
