# Local Supabase validation runbook — policy acceptance reconciliation

Status: preparation only. Use a disposable, isolated local Supabase workspace containing only the policy acceptance foundation, expiration migration, a test-only admin helper, and the reconciliation candidate. Do not run this test against a hosted project.

## Why the workspace is isolated

The repository contains unrelated historical migrations, including one that expects a podcast subscription table not created by the migration chain available in this repository. A full-repository local reset can therefore fail before policy tests begin. The test workspace must contain only:

1. `20261120110000_versioned_policy_acceptance_ledger.sql`
2. `20261121070329_policy_version_expiration.sql`
3. A CLI-generated test-only admin authorization helper migration.
4. A CLI-generated `policy_acceptance_reconciliation` migration containing `docs/policy-acceptance-reconciliation-draft.sql`.

The test helper returns admin authorization only for a synthetic JWT role claim equal to `admin`. It is test-only and must never be used in a hosted project.

## Safety rules

- Do not run `supabase link`, `supabase login`, `supabase db push --remote`, `supabase db reset --remote`, or any command with `--remote`.
- Do not add production project refs, database URLs, API keys, or service-role credentials to this test.
- Supabase CLI v3 runs database commands against the local stack by default. Keep commands local and inspect command output before proceeding.
- Use only the two synthetic Auth identities below.
- Do not merge the implementation PR, publish policies, or enable acceptance enforcement without separate approval.

## Prerequisites

- Windows with Docker Desktop running (or another Docker-compatible runtime).
- Node.js 20 or later.
- Supabase CLI 3.0.0 pinned for repeatability.
- PostgreSQL client `psql` available in PATH.

## Create the isolated local workspace

Run these commands from the repository root in PowerShell. The test project is created under the Windows temporary directory, not inside the repository:

```powershell
$RepoRoot = (Get-Location).Path
$TestRoot = Join-Path $env:TEMP "crowrules-policy-supabase"
New-Item -ItemType Directory -Force -Path $TestRoot | Out-Null
Set-Location $TestRoot

npx --yes supabase@3.0.0 --version
npx --yes supabase@3.0.0 init

New-Item -ItemType Directory -Force -Path ".\supabase\migrations" | Out-Null
Copy-Item (Join-Path $RepoRoot "supabase\migrations\20261120110000_versioned_policy_acceptance_ledger.sql") ".\supabase\migrations\"
Copy-Item (Join-Path $RepoRoot "supabase\migrations\20261121070329_policy_version_expiration.sql") ".\supabase\migrations\"

npx --yes supabase@3.0.0 migration new test_admin_authorization_helper
$HelperMigration = Get-ChildItem ".\supabase\migrations\*_test_admin_authorization_helper.sql" | Select-Object -First 1
if (-not $HelperMigration) { throw "Supabase CLI did not create the helper migration." }

@'
create schema if not exists private;
create or replace function private.crowrules_is_admin_impl()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select current_setting('request.jwt.claim.role', true) = 'admin'
$$;
revoke all on schema private from public, anon, authenticated, service_role;
revoke all on function private.crowrules_is_admin_impl() from public, anon, authenticated, service_role;
'@ | Set-Content -Path $HelperMigration.FullName -Encoding ascii

Start-Sleep -Seconds 1
npx --yes supabase@3.0.0 migration new policy_acceptance_reconciliation
$ReconciliationMigration = Get-ChildItem ".\supabase\migrations\*_policy_acceptance_reconciliation.sql" | Select-Object -First 1
if (-not $ReconciliationMigration) { throw "Supabase CLI did not create the reconciliation migration." }

Copy-Item (Join-Path $RepoRoot "docs\policy-acceptance-reconciliation-draft.sql") $ReconciliationMigration.FullName -Force

if (Select-String -Path ".\supabase\config.toml" -Pattern "crowrules_policy_private" -Quiet) {
  throw "Private policy schema must not be exposed through the Data API."
}
```

The CLI initialization and `migration new` commands create local files only. They do not log in or connect to a hosted Supabase project. The helper migration must sort before the reconciliation migration.

## Start and reset the local stack

```powershell
npx --yes supabase@3.0.0 start
npx --yes supabase@3.0.0 status
npx --yes supabase@3.0.0 db reset
npx --yes supabase@3.0.0 migration list
```

This stack contains only the two historical policy migrations plus the test helper and reconciliation candidate. Confirm that the generated reconciliation migration appears in local migration history. Never append `--remote`.

Copy the local database URL shown by `supabase status` into the `$LocalDbUrl` variable below. It must be the local URL, normally bound to localhost.

## Create synthetic Auth identities and run tests

```powershell
$LocalDbUrl = "<LOCAL_DB_URL_FROM_SUPABASE_STATUS>"

psql $LocalDbUrl -v ON_ERROR_STOP=1 -c "insert into auth.users (id) values ('10000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002') on conflict (id) do nothing;"

psql $LocalDbUrl -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -v member_b="20000000-0000-0000-0000-000000000002" -f (Join-Path $RepoRoot "docs\policy-acceptance-local-tests.sql")

psql $LocalDbUrl -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -v member_b="20000000-0000-0000-0000-000000000002" -f (Join-Path $RepoRoot "docs\policy-acceptance-negative-lifecycle-tests.sql")

psql $LocalDbUrl -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -v member_b="20000000-0000-0000-0000-000000000002" -f (Join-Path $RepoRoot "docs\policy-version-expiration-tests.sql")

psql $LocalDbUrl -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -f (Join-Path $RepoRoot "docs\policy-acceptance-reconciliation-tests.sql")

psql $LocalDbUrl -v ON_ERROR_STOP=1 -f (Join-Path $RepoRoot "docs\policy-acceptance-isolation-test.sql")

$env:DB_URL = $LocalDbUrl
bash (Join-Path $RepoRoot "docs\policy-acceptance-concurrency-test.sh")
Remove-Item Env:\DB_URL
```

The SQL files use psql meta-commands such as `\gset`; run them with `psql`, not by pasting them into the SQL Editor. SQL fixtures use synthetic identities and roll back. The two-session concurrency script creates disposable test rows in the local database; the entire stack is stopped and discarded after validation.

## Security review

- Confirm RLS is enabled on `policy_documents`, `policy_versions`, `policy_acceptances`, and the private catalog guard.
- Confirm `crowrules_policy_owner` is NOLOGIN, NOINHERIT, NOBYPASSRLS and does not own the policy tables. On PostgreSQL 16+, allow only the creator's automatic ADMIN-only membership (`INHERIT FALSE`, `SET FALSE`); verify no application/client role is a member and the temporary SET-capable ownership-transfer grant has been revoked.
- Confirm the public wrapper is SECURITY DEFINER with an empty search path and the private helper is SECURITY INVOKER with an empty search path; both are owned by the restricted role.
- Confirm the identity bridge is SECURITY DEFINER with an empty search path, owned by the trusted migration executor, calls only fully qualified `auth.uid()`, and is executable only by `crowrules_policy_owner`; the restricted owner role itself has no `auth` schema usage.
- Confirm anon, authenticated, and service_role cannot use `crowrules_policy_private` or execute the private helper or identity bridge.
- Confirm authenticated can execute the public acceptance wrapper, anon cannot, and direct client ledger writes are denied.
- Confirm the current/history views return only the intended public rows and do not expose withdrawn content or acceptance rows.
- Confirm admin lifecycle RPCs reject a non-admin synthetic user.
- Confirm acceptance and lifecycle RPCs reject non-READ COMMITTED isolation.
- Confirm `crowrules_policy_private` is not listed in PostgREST exposed schemas.
- Run `npx --yes supabase@3.0.0 db advisors` and review all findings, including any view-security warning against the restricted view owner and RLS policies.
- Confirm acceptance rows and their timestamps remain unchanged after expiry or withdrawal.

## Stop the local stack

```powershell
npx --yes supabase@3.0.0 stop
```

## What this runbook does not authorize

No hosted project link, remote schema pull, remote migration, production deployment, policy publication, or acceptance enforcement is part of this procedure.
