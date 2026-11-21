# Local policy acceptance validation plan

Status: implementation-preparation test plan. All execution is limited to disposable PostgreSQL or local Supabase environments. Never run these commands against production or a shared Supabase branch.

## Candidate and migration history

The approved design is in PR #70, which GitHub now reports as merged. The implementation branch keeps the SQL candidate in `docs/policy-acceptance-reconciliation-draft.sql` until Supabase CLI creates a formal migration filename.

The expected local migration order is:

1. `20261120110000_versioned_policy_acceptance_ledger.sql`
2. `20261121070329_policy_version_expiration.sql`
3. A CLI-generated, test-only admin-helper bootstrap migration.
4. A CLI-generated `policy_acceptance_reconciliation` migration containing the SQL candidate.

The test-only helper returns admin authorization only when the synthetic JWT role claim is `admin`. It is not production authorization code and must never be copied into a hosted database.

## Security model under test

- `crowrules_policy_owner` is a dedicated NOLOGIN, NOINHERIT, NOBYPASSRLS role and must not own the policy tables. PostgreSQL 16+ automatically grants the CREATEROLE creator an ADMIN-only membership (`INHERIT FALSE`, `SET FALSE`). The migration temporarily adds a SET-capable grant for ownership transfer, revokes only that temporary grant, and tests that the sole remaining member is the trusted migration executor with ADMIN true and INHERIT/SET false. No application/client role is a member.
- The public member acceptance wrapper is SECURITY DEFINER, owned by `crowrules_policy_owner`, and has an empty search path. It validates identity through a private, empty-search-path SECURITY DEFINER bridge owned by the migration executor; that bridge calls fully qualified `auth.uid()` and is executable only by `crowrules_policy_owner`. The acceptance implementation itself remains SECURITY INVOKER.
- The private implementation in `crowrules_policy_private` is SECURITY INVOKER, owned by the same restricted role. PUBLIC, anon, authenticated, and service_role have no schema USAGE or helper EXECUTE.
- The public wrapper is the only member acceptance write path. Admin lifecycle RPCs are separately granted to authenticated users and authorize through the existing `private.crowrules_is_admin_impl()` helper.
- The restricted function owner is not the policy-table owner and has no BYPASSRLS. Current/history discovery uses fixed-search-path SECURITY DEFINER RPCs owned by that restricted role; the underlying table RLS policies still apply.
- Anonymous and authenticated users can read published policy content intended for public display. Withdrawn and draft content is not returned as active/public policy content. Acceptance history is member-owned.
- Client roles have no direct acceptance INSERT/UPDATE/DELETE. Authenticated members can read only their own rows; anon and service_role have no ledger read grant. The restricted non-login owner has internal SELECT/INSERT only for the idempotent acceptance operation. The ledger remains append-only.
- Policy acceptance and lifecycle RPCs require READ COMMITTED isolation. Stronger isolation is rejected rather than risking a stale transaction snapshot after a lock wait.
- The catalog sentinel is locked first to serialize document-set membership. Then all parent documents are locked in ascending UUID order, followed by version rows ordered by parent ID and version ID. Document creation locks the same sentinel before inserting a new parent.
- Current discovery uses `public.get_current_policy_versions()`; historical published display uses `public.get_published_policy_history()`. Clients must not infer current policy by sorting the raw version list.

## Repeatable CI execution

The workflow is `.github/workflows/policy-acceptance-sql.yml`. It has two independent disposable test jobs:

1. PostgreSQL 16 service: bootstraps minimal Supabase-compatible roles and Auth helpers, applies the two formal migrations plus the reconciliation SQL candidate, and runs the SQL and two-session concurrency tests.
2. Local Supabase: initializes a temporary project, uses `supabase migration new` to create the test-helper and reconciliation migration files, applies the full local migration chain with `supabase db reset`, verifies `supabase migration list`, runs the SQL/concurrency tests, and runs `supabase db advisors`.

The local job uploads the CLI-generated reconciliation migration as an artifact so its exact generated filename and contents can be reviewed before creating a repository migration file.

The workflow has no project reference, hosted credentials, remote database connection, deployment step, or production mutation. CLI commands run against the temporary local project only.

## Required test coverage

- Anonymous current-version discovery returns the current published version.
- A withdrawn or expired latest effective version produces no current row and never revives an older published version.
- Historical published versions remain displayable with clear historical/document state; withdrawn content is not returned by the public history RPC.
- Future-effective versions do not supersede early.
- A required latest withdrawn/expired version blocks acceptance until an effective replacement exists.
- A latest optional version supersedes earlier required versions without requiring acceptance.
- Exact expiry timestamp boundary and draft-only expiry editing.
- Published content and expiry are immutable; withdrawn rows cannot be republished.
- The public wrapper is executable by authenticated and not anon; the private schema/helper is unavailable to client roles.
- Wrapper/helper owners, SECURITY DEFINER/INVOKER modes, fixed search paths, role attributes, RLS, and grants are inspected.
- Direct acceptance ledger writes fail; members can read only their own acceptance rows; duplicate acceptance is idempotent and preserves the original accepted timestamp. The restricted function owner has INSERT plus column-level SELECT only on `(user_id, policy_version_id)` for `ON CONFLICT`; it cannot read `accepted_at` or `acceptance_context`.
- Admin lifecycle RPCs reject non-admin synthetic members.
- Acceptance and lifecycle calls reject non-READ COMMITTED isolation.
- Two-session tests cover acceptance-first vs withdrawal, withdrawal-first vs acceptance, publication-first vs stale acceptance, and multi-document calls supplied in opposite orders.
- The local Supabase job confirms the private implementation schema is not listed among exposed Data API schemas.

## Running locally

Use a temporary workspace, not the repository's production configuration:

1. Verify `supabase --version`, `docker --version`, and `docker info`.
2. Create a temporary directory and run `supabase init` there. Do not run `supabase link` and do not add a production project reference.
3. Copy only the two policy migrations into the temporary workspace.
4. Generate a test-only admin helper migration and then a reconciliation migration with `supabase migration new`. Ensure the helper migration sorts before the reconciliation migration.
5. Put the synthetic admin-helper stub in the helper migration and copy the reviewed candidate SQL into the generated reconciliation migration.
6. Run `supabase start`, `supabase db reset`, and `supabase migration list` locally.
7. Create two disposable Auth users, then run the SQL harnesses and `bash docs/policy-acceptance-concurrency-test.sh` using the local DB URL.
8. Run `supabase db advisors`, review the results, and stop the stack with `supabase stop`.

Do not add `--remote`, `--linked`, a project ref, or production credentials to these commands. Stop if an unrelated earlier migration is pulled into the temporary workspace or any command attempts a hosted connection.

## SQL test files

- `docs/policy-acceptance-local-tests.sql`: smoke tests for Auth identity, RLS, own-row history, direct-write denial, and idempotency.
- `docs/policy-acceptance-negative-lifecycle-tests.sql`: invalid inputs, exact required set, optional supersession, and immutable/lifecycle checks.
- `docs/policy-version-expiration-tests.sql`: expiration boundary, history, expiry immutability, and withdrawal no-fallback checks.
- `docs/policy-acceptance-reconciliation-tests.sql`: restricted owner/RPC privileges, public current/history discovery RPCs, withdrawal no-fallback, admin authorization, and replacement behavior.
- `docs/policy-acceptance-isolation-test.sql`: confirms repeatable-read calls are rejected.
- `docs/policy-acceptance-concurrency-test.sh`: two-session lock-order and stale-acceptance regression tests.

## Acceptance criteria

- Every boolean assertion is true.
- Every negative test fails with the expected SQLSTATE/message.
- Both PostgreSQL 16 and the isolated local Supabase migration chain pass.
- Migration history contains the generated candidate migration in the local test workspace.
- No private schema is exposed through the Data API.
- Supabase advisors are reviewed; any view/function warning is assessed against the restricted owner, empty search path, RLS, and grants.
- No production schema, policy, configuration, or acceptance enforcement is changed.
