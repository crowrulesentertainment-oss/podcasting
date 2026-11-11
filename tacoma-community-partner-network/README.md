# CrowRules Podcasting Partnership Headquarters

Public URL: https://crowrulesentertainment-oss.github.io/podcasting/tacoma-community-partner-network/

This project is the central partnership hub for CrowRules Podcasting, a division of CrowRules Entertainment. Tacoma and the Pacific Northwest are the founding community; the network is designed to welcome qualified relationships nationwide.

## Public portal
- Partnership-focused landing page explaining the network and its scope.
- Partnership pathways for business and brand partners, sponsors and advertisers, media and creators, guests and subject experts, community/nonprofit organizations, and production/project collaborators.
- Searchable, filterable approved partner directory with featured profiles, profile details, public contact channels, social links and verification markers.
- Partner application and inquiry form with optional organization logo upload through the existing secure Edge Function.
- Public opportunity exchange with collaboration, volunteer, resource offer/request posts, partner announcements and community events.
- Collaboration Matchmaker suggestions based on shared categories, communities and descriptive terms. Suggestions are not endorsements or confirmed matches.
- Public submissions remain pending until an administrator approves publication.
- Clear separation between voluntary network participation and any separately negotiated paid sponsorship or advertising arrangement.
- Responsive navigation, semantic structure, skip link and reduced-motion support.

## Administration
- Separate noindex administration page at admin.html.
- Existing Supabase-authenticated sign-in and RLS-governed partner record management.
- Visitor analytics, partner profile editor, partner directory controls, private application review and community submission moderation.
- Section navigation for administration workflows.
- Email Center with editable, personalized templates for application receipt, clarification, approval/welcome, decline, sponsorship inquiry, guest follow-up, creator collaboration and general follow-up.
- Email Center currently generates and copies ready-to-send drafts. It does not send email from the browser and does not expose Resend credentials. Automated sending requires a secured server-side delivery function and verified sender domain.

## Existing integrations and security
- Supabase project: cevylpnoexugwgygvtgu.
- Browser uses only the Supabase publishable key.
- Partner directory reads podcast_public_partners; admin changes remain subject to existing RLS policies.
- Applications are submitted through the existing partnership-application Edge Function and stored in the existing business_inquiries workflow.
- Community board uses existing Phase 2 tables: community_opportunities, community_announcements, tacoma_partner_events.
- No service-role key, Resend API key, private application fields or privileged credentials are included in the public frontend.
- No new database tables or RLS policies are introduced by this UI rebuild.
- Sponsorship pricing, paid deliverables, media usage rights and other commercial terms must be agreed separately in writing.

## Files
- index.html — public partnership headquarters.
- assets/network.css — shared responsive design system.
- assets/network.js — public directory, analytics, applications and community board.
- admin.html — restricted administration interface.
- assets/admin.js — authenticated partner management, application review, moderation, analytics and email draft templates.

## Release validation still required
The files are committed to the repository's main branch. GitHub Pages deployment and live Supabase workflows should be tested after the commit. Specifically verify:
1. Public page renders and all internal navigation anchors work on desktop and mobile.
2. Directory category values match the deployed podcast_public_partners schema.
3. Partner application form submits and the Edge Function confirms the saved application and notification result.
4. Admin sign-in, profile create/edit/publish, application review and community moderation work with current administrator RLS permissions.
5. The Email Center creates and copies each template correctly.
6. Opportunity, announcement and event submissions remain pending until approved.
7. No private contact or application data is exposed publicly.
8. Verify any future sender domain and connect a server-side email delivery function before describing email automation as active.

Do not change existing authentication, RLS policies, Edge Functions or unrelated Podcasting pages as part of this standalone partnership portal.