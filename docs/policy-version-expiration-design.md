# Policy version expiration: design and test plan

Status: design prepared; migration candidate and CI tests are isolated drafts. No production work is authorized or performed.

## Decision

Add nullable `policy_versions.expires_at timestamptz` before production readiness. A null value means no scheduled expiration. A non-null value must be strictly later than `effective_at`.

## Required selection semantics

1. For each policy document, first select the latest effective, published version using the existing ordering: `effective_at DESC, published_at DESC, id`.
2. Only after selecting that latest version, evaluate its expiration.
3. If the latest version requires acceptance and is expired, reject the acceptance operation with a clear validation error. Do not silently drop that document from the required set.
4. A newer version that is not yet effective does not replace the current version. If the current required version has expired, acceptance remains blocked until the replacement becomes effective.
5. An expired newer version never causes an older version to become current again. This applies whether the newer version was required or optional.
6. A latest optional version does not create a new acceptance requirement. It still supersedes older versions for that document.
7. Expired published content remains readable as historical policy content. Expiration prevents new acceptance; it does not erase prior acceptances or the policy text needed to understand them.

## Integrity and lifecycle

- `expires_at IS NULL` is allowed.
- Otherwise `expires_at > effective_at` is required.
- Expiration is immutable after publication, alongside the other version identity/content fields.
- Corrections require a new policy version.
- Withdrawal remains a separate administrator lifecycle action; expiration is time-based and does not rewrite status.
- Existing acceptance rows remain append-only and retain their original accepted_at timestamps.

## Candidate files

- `docs/policy-version-expiration-migration-draft.sql`: additive SQL candidate, deliberately outside `supabase/migrations/` until it can be generated/reviewed with the Supabase CLI.
- `docs/policy-version-expiration-tests.sql`: synthetic transaction-rolled-back tests.
- CI applies the candidate after the existing migration in a disposable PostgreSQL 16 service only.

## Test coverage

- No expiry remains valid.
- Future expiry remains valid.
- Expiry at/before effective date is rejected.
- An effective replacement supersedes an expired prior version.
- An expired required version blocks acceptance while a replacement remains future-effective.
- An expired newer optional version does not revive an older required version.
- Published expiration cannot be edited.
- Existing acceptance history remains intact.

## Remaining verification before promoting to a real Supabase migration

- Run the full disposable PostgreSQL CI workflow.
- Run a full local Supabase stack test when a local Docker-compatible environment is available.
- Review function security, grants, RLS behavior, and Data API exposure against the actual Supabase project configuration.
- Generate the final migration with `supabase migration new` in the local repository, place the reviewed SQL in that generated file, and run local migration reset/tests.
- Keep all production migration, deployment, policy publication, and enforcement actions separately gated by explicit approval.

## Safety boundary

No Supabase project credentials, remote database connection, production migration, deployment, policy publication, or acceptance enforcement is part of this work.
