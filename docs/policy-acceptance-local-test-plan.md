# Local policy acceptance validation plan

Status: prepared, not executed. Do not run against production or a shared Supabase branch.

## Environment

1. Verify the prerequisites with `supabase --version`, `docker --version`, and `docker info`. The local stack requires a Docker-compatible runtime.
2. This repository currently has no `supabase/config.toml`. Run `supabase init` in the repository root to generate the local config, preserving the existing migrations directory; review the generated file and do not add production secrets or link a remote project.
3. Run `supabase start` to launch only the local stack. Confirm the displayed project/API/DB URLs are local.
4. Run `supabase db reset` to recreate the local database and apply the repository migrations from scratch. This command is intentionally local-only; do not add `--remote`, `--linked`, or a project ref. Stop if any earlier migration fails.
5. Create two disposable Auth users (Member A and Member B) in local Studio/Auth. Use their UUIDs in the SQL harness placeholders.
6. Confirm the local database has the three policy tables, RLS enabled, the public wrapper, and the dedicated non-exposed `crowrules_policy_private` implementation function. Confirm `crowrules_policy_private` is not listed as an exposed Data API schema.


## Repeatable CI execution (added)

The repository includes `.github/workflows/policy-acceptance-sql.yml`. It starts a disposable PostgreSQL 16 service inside GitHub Actions, bootstraps only the minimal Supabase-compatible database roles and `auth.users` / `auth.uid()` objects required by this migration, applies the migration, inserts two synthetic Auth identities, and runs the SQL harness.

The job runs for pull requests that change the migration, harness, or workflow, and can also be started manually with `workflow_dispatch`. It is isolated from Supabase projects: it has no project reference, Supabase credentials, production secrets, deployment steps, or remote database connection.

The harness output is checked for any boolean assertion returning false, in addition to stopping on SQL errors. A green workflow therefore means the migration applied and all boolean smoke assertions passed against that disposable PostgreSQL database. It does **not** replace the additional negative/lifecycle tests listed above, a full Supabase local-stack run, or a review of Supabase-specific advisors and Data API exposure settings.

## SQL harness

Run `psql` using the local database URL printed by `supabase status`, for example: `psql '<local-db-url>' -v member_a='<member-a-uuid>' -v member_b='<member-b-uuid>' -f docs/policy-acceptance-local-tests.sql`. Replace the placeholder UUIDs with the two disposable local Auth users. The harness opens a transaction and rolls back its policy fixtures. The CLI v3 default is local; do not run hosted/remote commands for this test.

The harness checks:
- Anonymous users can read effective published policy versions.
- Anonymous users cannot read acceptance history.
- Member A can accept the current required version.
- Repeating acceptance is idempotent.
- Member A can read their own acceptance row.
- Member A cannot read Member B's acceptance rows.
- Direct client writes to the acceptance ledger are denied.
- Member B's acceptance is attributed to Member B, never Member A.
- Acceptance rows reject mutation.

## Additional negative / lifecycle checks

Run these as separate local-only checks after the smoke harness:

1. Call the RPC as anon; expect permission denied. The smoke harness also checks that anon has no EXECUTE privilege.
2. Call the RPC as the authenticated database role with no JWT subject; expect SQLSTATE 28000 (Authentication required).
2. Call the RPC as an authenticated session with no JWT subject; expect Authentication required.
3. Submit an empty array, an unknown version UUID, a draft version, a withdrawn version, an expired/not-yet-effective version, and an incomplete set; each must fail without inserting any row.
4. Submit a duplicate version ID; expect rejection because supplied cardinality does not match the distinct valid count.
5. Publish a newer version for the same document. Confirm the older version is no longer accepted as current.
6. Publish a newer non-required version. Confirm it supersedes the old required version and the old version is no longer in the required set.
7. Attempt to rewrite a version's URL, checksum, acceptance requirement, effective date, or document association; expect the immutable-version trigger to reject it.
8. Attempt invalid lifecycle transitions (published back to draft, withdrawn back to published); expect rejection.
9. Verify a user cannot update/delete acceptance rows even when they can select their own row.
10. Verify policy document metadata remains hidden until an effective published version exists.

## RLS identity setup

For SQL role tests, set the local JWT subject before switching to the role:

    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '<member-uuid>', true);
    select auth.uid();
    rollback;

Use a separate transaction for each identity when possible. Never substitute a real member UUID or real user data into this test.

## Acceptance criteria

- All positive assertions return true.
- Every negative test fails for the expected authorization / validation reason.
- No cross-member rows are visible.
- No direct client write path exists for acceptance rows.
- RPC calls are idempotent and accept only the exact current required set.
- Security advisor findings are reviewed after local migration.
- The public RPC is invoker-security; only the dedicated crowrules_policy_private implementation is definer-security, with empty search path and explicit auth.uid() validation.

## Not in scope yet

- No signup enforcement or OAuth gating.
- No acceptance checkbox or button.
- No publishing / admin policy editor.
- No production migration or policy seed data.
- No marketing-email consent changes.
