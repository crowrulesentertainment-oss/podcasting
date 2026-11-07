# Supabase security hardening — 2026-11-07

Project: `cevylpnoexugwgygvtgu`

## Changes applied and verified

1. **RLS-enabled tables with no policies (169 → 0).** All 169 affected public tables already had RLS enabled and no direct anon/authenticated grants for SELECT or INSERT. Added an explicit `FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)` policy to each. This preserves the existing fail-closed behavior and does not open client access. Service-role backend workflows continue to use their existing bypass.
2. **Mutable function search_path (1 → 0).** Set `public.create_crew_draft_from_approved_host_application()` to `search_path = ''`. Its table references are schema-qualified.
3. **Default PUBLIC function grants removed.** For exposed SECURITY DEFINER functions that were callable by anon/authenticated, revoked inherited PUBLIC EXECUTE and re-granted only the exact anon/authenticated/service_role role privileges that existed before. Verified there are zero remaining flagged functions with an EXECUTE grant to the PUBLIC pseudo-role.
4. **Podcast admin bootstrap 401 root cause corrected.** The Edge Function parsed the Authorization header with a literal escaped `\\s` expression, so a normal `Bearer <JWT>` header was not stripped correctly before `auth.getUser()`. Corrected it to `/^Bearer\s+/i` and deployed `podcasting-admin-bootstrap` version 66 with JWT verification still enabled.

## Remaining advisor notices: SECURITY DEFINER RPCs

After hardening, the advisor reports:
- 17 functions callable by `anon`
- 45 functions callable by `authenticated`

These are not inherited PUBLIC grants anymore; each grant is explicit and role-scoped. The remaining functions are intentionally exposed RPC contracts used across CrowRules sites:
- Anonymous public output: public trust certificate verification, published award results, published podcast download/follower counts, public listener badges/leaderboards, active membership plan catalogue, and aggregate visitor/launch-interest counters.
- Anonymous telemetry: page-view and presence heartbeats, visitor count increments and launch-interest opt-in.
- Authenticated member operations: own playback authorization/session/heartbeat, own CrowPoints/achievements, own follows/friend requests, guest/live cohost workflows, award voting and admin-gated moderation/administration.

Their SECURITY DEFINER bodies were inspected for scoped outputs or caller checks; the podcast functions use `auth.uid()` / creator authorization for private member operations, public profile functions filter on public-profile flags, and admin functions call existing admin checks. These remaining lints cannot safely be removed by blanket revocation: doing so would break live public pages and authenticated workflows. A zero-warning redesign requires replacing the public RPC surface with reviewed SECURITY INVOKER views or narrowly scoped Edge Function endpoints, then updating and end-to-end testing every connected CrowRules site before revoking these grants.

## Verification snapshot

- RLS-enabled public tables without policies: **0**
- Mutable search_path warning: **0**
- SECURITY DEFINER functions with inherited PUBLIC EXECUTE: **0**
- Remaining explicit role-scoped SECURITY DEFINER RPC notices: **17 anon / 45 authenticated**
- Admin bootstrap function deployed: **version 66**
- No tables dropped, data truncated, or service-role secrets committed.
