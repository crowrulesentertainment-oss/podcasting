# Policy version expiration: design and validation

Status: formal migration prepared and validated in isolated local environments. No hosted/production changes are authorized or performed.

## Decision

Add nullable `policy_versions.expires_at timestamptz`. A null value means no scheduled expiration. A non-null value must be strictly later than `effective_at`.

## Required selection semantics

1. For each policy document, first select the latest effective, published version using the existing ordering: `effective_at DESC, published_at DESC, id`.
2. Only after selecting that latest version, evaluate its expiration.
3. If the latest version requires acceptance and is expired, reject the acceptance operation with a clear validation error. Do not silently drop that document from the required set.
4. A newer version that is not yet effective does not replace the current version. If the current required version has expired, acceptance remains blocked until the replacement becomes effective.
5. An expired newer version never causes an older version to become current again. This applies whether the newer version was required or optional.
6. A latest optional version does not create a new acceptance requirement. It still supersedes older versions for that document.
7. Expired published content remains readable as historical policy content. Expiration prevents new acceptance; it does not erase prior acceptances or the policy text needed to understand them.
8. Withdrawal does not restore an older version. For current-version selection, the latest effective published or withdrawn version is authoritative. If that version is withdrawn, the document has no current version until a new replacement is published and becomes effective. Older published versions remain historical only and cannot be accepted as a fallback.

## Member-facing expiration language

- Store and compare expiration as an exact timestamp; do not reinterpret it as the end of a calendar day.
- Display the date, time, and explicit timezone in the member interface. Avoid ambiguous phrases such as “expires tonight.”
- When a required version has expired and no effective replacement exists, explain that policy acceptance is temporarily unavailable until a replacement becomes effective.
- Describe the restriction narrowly as an acceptance-flow restriction. Do not say or imply that expiration itself suspends the member's account or removes access to unrelated Podcasting features.
- Keep the expired published policy available as historical text, clearly labeled as expired.

## Integrity and lifecycle

- `expires_at IS NULL` is allowed.
- Otherwise `expires_at > effective_at` is required.
- Expiration can be set or corrected while a version is draft; after publication it is immutable.
- Corrections require a new policy version.
- Withdrawal remains a separate administrator lifecycle action; expiration is time-based and does not rewrite status. Withdrawing the latest effective version does not revive an older version. A new replacement must be published and become effective before the document has a current version again.
- Existing acceptance rows remain append-only and retain their original `accepted_at` timestamps.

## Formal migration

- CLI-generated migration: `supabase/migrations/20261121070329_policy_version_expiration.sql`
- Generated with Supabase CLI 3.0.0 using `supabase migration new policy_version_expiration`.
- Its SQL body matches `docs/policy-version-expiration-migration-draft.sql`.
- The migration exists on draft PR #68 only. It has not been applied to a hosted database.

## Test files and coverage

- `docs/policy-version-expiration-tests.sql`: synthetic transaction-rolled-back tests.
- `docs/policy-acceptance-local-tests.sql`: RLS and acceptance ledger smoke tests.
- `docs/policy-acceptance-negative-lifecycle-tests.sql`: negative, duplicate, lifecycle, and immutability tests.

Coverage includes:
- No expiry remains valid.
- Future expiry remains valid.
- Expiry at/before effective date is rejected.
- Expiration exactly at the current transaction time is expired.
- An effective replacement supersedes an expired prior version.
- An expired required version blocks acceptance while a replacement remains future-effective.
- An expired newer optional version does not revive an older required version.
- Draft expiration can be edited; published expiration cannot.
- Existing acceptance history remains intact.

## Validation results

**Passed**: [isolated local Supabase validation run #44878712477](https://github.com/crowrulesentertainment-oss/podcasting/actions/runs/44878712477).
- Supabase CLI initialized an unlinked temporary workspace.
- The policy base migration and formal expiration migration were applied locally.
- Local migration reset and migration-history verification passed.
- Two synthetic Auth identities were created.
- RLS/ledger, negative/lifecycle, and expiration tests passed.
- Supabase database advisors reported **No issues found**.
- The local Supabase stack was stopped after testing.

The separate disposable PostgreSQL 16 workflow also passed: [run #44876860809](https://github.com/crowrulesentertainment-oss/podcasting/actions/runs/44876860809).

## Isolation note

A full-repository local Supabase start encountered an unrelated historical migration dependency: `20261107223000_secure_podcast_subscriptions_and_email_worker.sql` references `public.podcast_subscriptions`, which is not created by the available migration chain. No unrelated migration was modified. Policy validation uses a temporary project containing only the two policy migrations, so the test does not depend on or alter other Podcasting schema work.

## Remaining review before any hosted rollout

- Review the actual hosted project's Data API exposed-schema configuration and confirm `crowrules_policy_private` remains non-exposed. This was not checked against production because no hosted connection was used.
- Review the migration and policy language with the appropriate stakeholders.
- Any hosted migration, deployment, policy publication, or acceptance enforcement requires separate explicit approval.

## Safety boundary

No Supabase project credentials, remote database connection, production migration, deployment, policy publication, or acceptance enforcement is part of this work.
