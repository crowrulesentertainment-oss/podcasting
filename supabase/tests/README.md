# Connection Groups database security test package

**Status:** Prepared for local validation; not executed yet.  
**Target:** Disposable local Supabase/PostgreSQL only.  
**Production:** No migration, schema, policy, storage, or data changes have been applied.

## Included files

- `supabase/drafts/community_groups_phase1.sql` — additive Phase 1 draft extending the existing `podcast_community_circles` model.
- `supabase/drafts/20261120_groups_social_permissions.sql` — narrowly scoped correction for reply cross-circle checks and member roster visibility.
- `supabase/tests/connection_groups_phase1_rls.sql` — synthetic multi-identity integration tests; all fixture data is rolled back.
- `docs/CONNECTION_GROUPS_DATABASE_SECURITY_TEST_PLAN.md` — review checklist and expected behavior.

## Important architecture decisions

1. Do not create a parallel `community_groups` table. The existing `podcast_community_circles` model and its related tables remain canonical.
2. Reuse existing posts, replies, invitations, events/RSVPs, member profiles, collaborations, activity, recognition, and direct messages.
3. Add a dynamic category directory while retaining the legacy `category` text field and syncing it with nullable `category_id`.
4. Keep legacy `is_public` clients compatible with the new public/private/hidden visibility model.
5. Private join-request approval is atomic. The privileged implementation remains in `private`; a narrowly granted public SECURITY INVOKER wrapper is used by the browser/PostgREST client.
6. Hidden-group membership must be backed by an accepted invitation for that exact circle.
7. Group-chat read/write policies correlate the message row to the same circle's membership. Cross-group access is explicitly tested.
8. Replies remain authenticated-only. No anonymous SELECT grant is added.
9. Existing RLS policies are preserved except the two specifically identified broken reply policies, which are corrected in the separate social-permissions patch.
10. No service-role key is used in browser code.

## Recover migration history before making a timestamped migration

The production project has a recorded migration ledger of 1,428 versions, and the repository baseline did not contain a recovered local migration chain. Do not invent a timestamp, use migration repair, or push the draft directly.

From PowerShell in the Podcasting repository:

```powershell
git status --short
git switch feature/connection-groups-db-security-2026-11-21

if (-not (Test-Path "supabase/config.toml")) {
  npx supabase init
}

npx supabase --version
npx supabase migration fetch --help
npx supabase link --project-ref cevylpnoexugwgygvtgu
npx supabase migration fetch --remote
npx supabase migration list --remote

(Get-ChildItem "supabase/migrations" -Filter "*.sql" -File).Count
git status --short
```

Expected: all recorded remote migration versions have matching local files and `migration list --remote` reports no missing or mismatched versions. Inspect the actual output. Stop if any version is missing, empty, or inconsistent.

Do not run `supabase pull`, `db pull`, `db push`, `migration repair`, or a hosted `migration up` as a shortcut.

## Local replay and migration generation

Only after history reconciliation is clean:

```powershell
npx supabase start
npx supabase db reset
```

This reset must target the local Supabase stack, never the linked production database. Resolve any historical replay failure before continuing. If the repository's older migration chain still fails locally, stop and document the exact failing migration; do not repair production history to force the reset through.

After the full local history replays successfully:

1. Generate the official timestamped Phase 1 migration with `npx supabase migration new community_groups_phase1`.
2. Copy the reviewed contents of `supabase/drafts/community_groups_phase1.sql` into that generated file.
3. Generate a separate migration with `npx supabase migration new groups_social_permissions`.
4. Copy the reviewed contents of `supabase/drafts/20261120_groups_social_permissions.sql` into the second generated file.
5. Run `npx supabase db reset` again against the local stack.
6. Confirm both new migrations are applied locally and inspect the schema, grants, triggers, policies, and Realtime publication membership.

Do not apply either draft directly to the hosted project.

## Run the synthetic integration tests

With the local Supabase stack running and both migrations applied:

```powershell
$localDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
psql $localDbUrl -v ON_ERROR_STOP=1 -f supabase/tests/connection_groups_phase1_rls.sql
```

The test file:
- creates synthetic Auth users and circles A/B/C/D;
- tests anonymous public/private/hidden discovery;
- tests private feed and member-roster isolation;
- tests public self-join and hidden accepted-invitation membership;
- tests exact-circle invitation binding;
- tests private join requests, impersonation rejection, duplicate pending requests, unauthorized review, and atomic owner approval;
- tests cross-circle post, reply, and group-chat isolation;
- tests disabled group chat;
- tests member role-escalation denial;
- tests admin-only dynamic category management;
- checks anonymous reply access remains ungranted;
- rolls back all fixtures.

A successful run must exit with code 0 and print no assertion errors. Save the terminal output with the PR review notes.

## Explicitly not authorized by this package

- No production SQL execution.
- No production migration-history edits.
- No production RLS policy changes.
- No storage bucket provisioning.
- No GitHub Pages deployment.
- No merge to `main`.
- No replacement of existing circle, messaging, event, or membership systems.
