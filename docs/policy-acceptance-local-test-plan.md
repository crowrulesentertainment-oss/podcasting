# Local policy acceptance validation plan

Status: prepared, not executed. Do not run against production or a shared Supabase branch.

## Environment

1. Install/start the Supabase CLI locally and verify the CLI version using supabase --version.
2. From the repository root, use the project's existing Supabase configuration and start a fresh local stack with supabase start.
3. Apply the repository migrations to the local database only. Inspect CLI output and migration history; stop if an earlier project migration fails. Do not use the remote project ref.
4. Create two disposable Auth users (Member A and Member B) in the local Auth service. Use their UUIDs in the SQL harness placeholders.
5. Confirm the local database has the three policy tables, RLS enabled, the public wrapper, and the private implementation function. Confirm private is not listed as an exposed Data API schema.

## SQL harness

Run docs/policy-acceptance-local-tests.sql with psql against the local database. Replace the two placeholder UUIDs with the disposable Auth users. The harness opens a transaction and rolls back its policy fixtures.

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

1. Call the RPC as anon; expect permission denied.
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
- The public RPC is invoker-security; only the private implementation is definer-security, with empty search path and explicit auth.uid() validation.

## Not in scope yet

- No signup enforcement or OAuth gating.
- No acceptance checkbox or button.
- No publishing / admin policy editor.
- No production migration or policy seed data.
- No marketing-email consent changes.
