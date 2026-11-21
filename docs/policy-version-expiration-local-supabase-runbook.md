# Local Supabase validation runbook — policy expiration

Status: preparation only. This runbook is for a disposable local Supabase stack. It must not be used to connect to or modify a hosted project.

## Safety rules

- Do not run `supabase link`, `supabase login`, `supabase db push --remote`, `supabase db reset --remote`, or any command with `--remote`.
- Do not add production project refs, database URLs, API keys, or service-role credentials to this test.
- Supabase CLI v3 runs database commands against the local stack by default; keep commands local and inspect the command output before proceeding.
- Use only the two synthetic Auth identities below.
- Keep PR #68 open and unmerged. Do not publish policies or enable acceptance enforcement.

## Prerequisites

- Windows with Docker Desktop running (or another Docker-compatible runtime).
- Node.js 20 or later.
- Supabase CLI 3.0.0 pinned for repeatability.
- PostgreSQL client `psql` available in PATH.

The repository currently has the policy migration directory but no `supabase/config.toml`. Initialize the local CLI project from the repository root. Review the CLI prompt carefully; preserve the existing `supabase/migrations/` directory and its files.

```powershell
npx --yes supabase@3.0.0 --version
npx --yes supabase@3.0.0 init
```

Confirm that `supabase/config.toml` now exists and that `api.schemas` does not expose `crowrules_policy_private`. Do not add that private schema to the Data API schemas.

## Start and inspect the local stack

```powershell
npx --yes supabase@3.0.0 start
npx --yes supabase@3.0.0 status
```

This starts a local-only Postgres/Auth/API stack. Do not sign in or link this directory to a hosted project.

## Generate the formal migration locally

Only after the draft has been reviewed:

```powershell
npx --yes supabase@3.0.0 migration new policy_version_expiration
```

The CLI generates the timestamped filename. Copy the reviewed contents of `docs/policy-version-expiration-migration-draft.sql` into that generated file. Do not invent or hand-type the timestamp.

Reset the disposable local database so migrations replay in order:

```powershell
npx --yes supabase@3.0.0 db reset
npx --yes supabase@3.0.0 migration list
```

Both commands are intentionally local. Never append `--remote`.

## Create synthetic Auth users and run SQL tests

Use the local database connection string printed by `supabase status` as the argument to `psql`. Do not substitute any hosted database URL.

Create the two test identities:

```sql
insert into auth.users (id) values
  ('10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;
```

Then run the existing RLS/ledger smoke tests, the expanded lifecycle tests, and the expiration tests with `psql -v ON_ERROR_STOP=1`. The expiration test file uses psql meta-commands (`\\gset`), so it must be run with `psql`, not pasted into the SQL Editor.

```powershell
psql "<LOCAL_DB_URL>" -v ON_ERROR_STOP=1 -c "insert into auth.users (id) values ('10000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002') on conflict (id) do nothing;"
psql "<LOCAL_DB_URL>" -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -v member_b="20000000-0000-0000-0000-000000000002" -f docs/policy-acceptance-local-tests.sql
psql "<LOCAL_DB_URL>" -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -v member_b="20000000-0000-0000-0000-000000000002" -f docs/policy-acceptance-negative-lifecycle-tests.sql
psql "<LOCAL_DB_URL>" -v ON_ERROR_STOP=1 -v member_a="10000000-0000-0000-0000-000000000001" -v member_b="20000000-0000-0000-0000-000000000002" -f docs/policy-version-expiration-tests.sql
```

Replace `<LOCAL_DB_URL>` only with the local connection string shown by `supabase status`. The SQL fixtures are synthetic and transaction-rolled-back.

## Security review

After local migration reset and tests:

- Confirm RLS is enabled on `policy_documents`, `policy_versions`, and `policy_acceptances`.
- Confirm anonymous users cannot read acceptance rows or execute the acceptance RPC.
- Confirm authenticated users can read only their own acceptance rows.
- Confirm direct INSERT/UPDATE/DELETE on the acceptance ledger is denied.
- Confirm the public RPC is SECURITY INVOKER and the private implementation is SECURITY DEFINER with an empty search path and an `auth.uid()` check.
- Confirm `crowrules_policy_private` is not listed in the PostgREST exposed schemas.
- Run `npx --yes supabase@3.0.0 db advisors` if supported by the pinned CLI version; review all findings.
- Confirm accepted ledger rows and their timestamps remain unchanged after policy expiry.

## Stop the local stack

```powershell
npx --yes supabase@3.0.0 stop
```

## What this runbook does not authorize

No hosted project link, remote schema pull, remote migration, production deployment, policy publication, or acceptance enforcement is part of this procedure.
