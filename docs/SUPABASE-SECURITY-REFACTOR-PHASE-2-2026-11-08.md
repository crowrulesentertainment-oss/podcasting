# CrowRules Supabase SECURITY DEFINER redesign — 2026-11-08

Project: `cevylpnoexugwgygvtgu`

## Phase 2 completed

The 45 API-exposed SECURITY DEFINER functions that had been callable by `anon` and/or `authenticated` were moved into the non-exposed `private` schema as `*_impl` implementations. Their public RPC names, input signatures, defaults, return types, volatility and existing per-role execute permissions were retained as thin `SECURITY INVOKER` SQL wrappers.

This preserves existing PostgREST `rpc()` call names and parameter shapes while keeping the privileged implementation out of the public API schema. Existing internal dependencies and RLS policy references were preserved by PostgreSQL's schema move; policies now refer to private admin-check implementations where appropriate.

The migration also:
- grants private-schema usage only to the roles needed by the preserved wrappers;
- removes PUBLIC execute grants from each implementation and wrapper;
- restores only the exact anon/authenticated/service_role grants previously present;
- sets an empty search_path on every public wrapper;
- revokes default PUBLIC function execution for future functions created by postgres in public;
- notifies PostgREST to reload its schema cache.

Migration: `supabase/migrations/20261108000000_move_exposed_definer_rpcs_to_private.sql`

## Verification on the live project

- Public API SECURITY DEFINER functions executable by anon/authenticated: **0**
- Private SECURITY DEFINER implementations: **45**
- Public SECURITY INVOKER wrappers: **45**
- Supabase Security Advisor notices: **0**
- RLS-enabled public tables without policies: **0** (from phase 1)
- Mutable function search-path notices: **0** (from phase 1)

Anonymous-role smoke test passed:
- membership plans returned 4 rows;
- public follow-count, listener leaderboard and visitor-count calls completed;
- launch-interest aggregate returned 31;
- anonymous access to the admin dashboard RPC was denied.

No table data was deleted or truncated. Existing OAuth, Stripe, podcast media and Edge Function secrets were not changed.

## Scope and follow-up

The wrapper design assumes the Supabase API exposed-schema configuration continues to exclude `private` (the standard Supabase configuration). Do not add `private` to the exposed schemas. The private implementation functions require schema usage for their invoker wrappers, but are not intended to be exposed as direct REST RPC endpoints.

The smoke tests exercise public/anonymous RPC paths. Authenticated user-specific workflows (playback ownership, CrowPoints, Hub moderation, chat and Tacoma Nights host approval) still require browser-level tests using real signed-in test accounts. The security advisor is clean, but a clean advisor is not a substitute for end-to-end authorization testing.

Supabase project: `crowrulesentertainment`.
