# Policy acceptance implementation plan

Status: Phase 1D implementation prepared on the feature branch. The migration remains unapplied; no production schema, authentication enforcement, or policy publication has been changed.

## Audit findings (2026-11-20)

- Email/password registration is handled in `assets/js/app.js` through `sb.auth.signUp()`.
- The current registration form asks for a display name, email, and password. It does not require a Terms of Service or Privacy Policy acknowledgement.
- The signup view also renders OAuth provider buttons. A checkbox added only to the email form would therefore leave social registration outside the acceptance flow.
- OAuth completion and email verification are handled in `auth-callback.html`. The current callback sends verified users back to sign-in; it does not check policy acceptance.
- The account settings view has profile-visibility and local notification preferences, but no policy history or agreement center.
- The database has `podcast_marketing_consents`, which is specifically for promotional email consent. It must remain separate from required service terms/privacy acknowledgements.
- A read-only schema-name check found no existing general policy, terms, agreement, or acceptance table. This is not a full audit of every function, trigger, or authorization policy.

## Recommended design

### 1. Keep document versions immutable

Use a policy-document registry and immutable version records. Each version should carry a stable document key, version label, publication/effective timestamps, status, canonical URL, and a content checksum. Publishing a revision creates a new version; it must not overwrite a version that members previously accepted.

Initial document keys:
- `terms_of_service`
- `privacy_policy`
- `community_guidelines`

Cookie and copyright/DMCA pages should be tracked as published policy information where appropriate, but should not automatically be treated as contractual signup consent without a specific legal/product reason.

### 2. Record acceptance as an append-only event

Store one event per member, policy version, and acceptance action. Capture:
- authenticated user ID (derived server-side from `auth.uid()`)
- immutable policy-version ID
- accepted timestamp (database-generated)
- acceptance source (email signup, OAuth completion, or later re-acceptance)
- optional application/build identifier

Do not treat browser-supplied user metadata, timestamps, user IDs, or a checkbox value alone as authoritative evidence. Never use `raw_user_meta_data` as an authorization signal.

### 3. Use a narrow authenticated RPC

A small authenticated database function should accept only the published policy-version identifiers being accepted. It should derive the member ID and timestamp inside Postgres, validate that each version is currently eligible for acceptance, and insert append-only records. Revoke broad table writes from client roles; expose only the minimum read path needed for a member to see their own history and current required versions.

The exact RLS and grants must be designed against the live schema and tested before deployment. Avoid broad policy replacements or disabling existing RLS.

### 4. Cover every authentication path

- Email/password signup: require explicit, unchecked-by-default acknowledgement of the currently published Terms and Privacy versions before calling `signUp()`.
- OAuth signup: do not assume an OAuth button is covered by an email-form checkbox. After first OAuth authentication, route the member through the same required-acceptance screen before granting access to member features.
- Email confirmation: preserve the pending acceptance context across the confirmation round-trip, then record acceptance only after the authenticated member explicitly confirms.
- Existing members: require acceptance only when a newly published version is designated as requiring re-acceptance. Do not silently backfill historical consent or mark existing members as having accepted a document they never saw.
- Password recovery and ordinary sign-in: do not treat these as fresh acceptance events.

### 5. Member-facing Agreements & Policies

Add an account section showing:
- current required policy versions and their effective dates
- accepted/not-yet-accepted status
- acceptance date and source for each version
- links to the exact immutable version accepted
- a clear re-acceptance flow when required

Do not expose another member's acceptance history.

### 6. Separate required policies from optional marketing

The existing `podcast_marketing_consents` workflow remains a distinct, optional promotional-email opt-in. Accepting service terms or a privacy notice must never subscribe a member to promotional email. Preserve the existing explicit opt-in and unsubscribe behavior.

## Implementation gates

1. Finish verifying the actual signup/OAuth/callback/account routing and current RLS conventions.
2. Have CrowRules review and approve the final policy text and version identifiers. The current public legal pages are drafts and are not ready to be represented as effective agreements.
3. Add a migration file on the feature branch only; do not apply it to the production Supabase project until separately approved.
4. Test RLS, RPC behavior, duplicate submissions, policy-version rollover, email confirmation, OAuth first-time signup, existing-member re-acceptance, and member-only history access.
5. Enable mandatory acceptance only after the documents, database records, and all authentication routes are verified together.

## Explicit non-goals

- No legal advice or guarantee that a document is enforceable.
- No collection of IP addresses or device fingerprints for acceptance evidence by default.
- No backfilling of acceptance for existing users.
- No changes to promotional-email consent.
- No production database changes or mandatory signup gate as part of this design phase.


## Phase 1C: migration draft and live-schema review (2026-11-20)

### Live database findings

- `supabase_migrations.schema_migrations` exists; the latest observed applied migration at audit time was `20261120045815`.
- The three proposed policy tables do not exist in the live project.
- The existing marketing-consent table has a narrow owner-read policy; it is not a general agreement ledger.
- Existing `profiles` policies use `auth.uid() = id`; `members` uses `auth.uid() = user_id` for own-row reads. Admin checks also use existing private helper functions.
- The live project uses RLS broadly and has recent targeted security-hardening migrations. The proposed migration therefore adds narrowly scoped policies and explicit grants instead of changing existing tables or global defaults.

### Migration drafted on the feature branch

File: `supabase/migrations/20261120110000_versioned_policy_acceptance_ledger.sql`

Creates:
- `policy_documents`: stable document keys and public-facing titles.
- `policy_versions`: immutable version content reference, SHA-256 checksum, effective date, acceptance requirement, and controlled draft/published/withdrawn lifecycle.
- `policy_acceptances`: append-only member/version evidence with a database-generated timestamp.

Security model:
- RLS enabled on all three tables.
- Anonymous and authenticated users can read only effective published documents and versions.
- Members can read only their own acceptance history.
- Client roles receive no direct insert/update/delete access to the ledger.
- A security-definer RPC derives the member ID from `auth.uid()`, accepts only the complete set of current required versions, and inserts the records atomically.
- Acceptance rows cannot be updated or deleted; version content cannot be rewritten after creation.
- No IP address, device fingerprint, marketing subscription, or historical acceptance is created.

### Not yet done

This is a migration draft only. It has not been applied to the live Supabase project, and no policy versions have been seeded or published. Before applying it, review the SQL against the exact production role grants, test the migration in a disposable Supabase branch/project, and run authenticated/anonymous/RLS/RPC tests. The current policy pages must also be approved and their final content checksums and effective dates established before any version is published.


## Phase 1D implementation (2026-11-20)

### Security refinement

The member-callable RPC is now a SECURITY INVOKER function in the exposed public schema. It delegates to a narrowly granted implementation function in the dedicated non-exposed `crowrules_policy_private` schema. The implementation is SECURITY DEFINER, has an empty search path, derives the member identity exclusively from auth.uid(), and validates the complete set of current required versions before inserting. The `crowrules_policy_private` implementation is executable by authenticated users only; anonymous and PUBLIC execution are revoked. The `crowrules_policy_private` schema must remain absent from the project's exposed Data API schemas.

The public wrapper is not privileged and cannot itself bypass RLS. No client table write grants are added. Acceptance remains append-only and promotional email consent remains a separate opt-in system.

### Member Agreements & Policies area

Added an Agreements & Policies tab to the signed-in account center. It provides links to the five public policy documents, an acceptance-history area, and an optional live-ledger read path. If the schema is not present or not reachable, the page displays a clear not-connected state rather than claiming the member accepted or declined anything. No acceptance button, signup gate, or mandatory policy enforcement is enabled in this phase.

### Local validation assets

- docs/policy-acceptance-local-test-plan.md defines the disposable local Supabase workflow and anonymous, member A, member B, cross-member, RPC, idempotency, lifecycle, and immutability checks.
- docs/policy-acceptance-local-tests.sql provides a transaction-scoped SQL harness. It requires two disposable Auth users and is designed to be run only against a local development database; it rolls back its fixture data.

### Explicit limits

No Supabase branch/project was created. No production SQL was executed. The migration, RLS policies, and RPC have not been run against Postgres yet. The member UI's live ledger path is intentionally dormant until a safe database test and migration are completed. No production deployment or merge of the Phase 1D follow-up commits was performed.


### Local execution readiness (2026-11-20)

The first static pass found that the migration referenced a private implementation schema without creating it. The migration now creates a dedicated `crowrules_policy_private` schema, revokes schema access from PUBLIC and anon, and grants the minimum schema usage and function execution needed by authenticated sessions. This schema must not be added to the Supabase Data API exposed-schema list.

The local validation plan now includes CLI setup and safe local-only commands. The current execution container has no Supabase CLI, Docker-compatible runtime, or PostgreSQL client, and this repository has no `supabase/config.toml`. Therefore the local stack and SQL harness could not be executed in this session. This is an environment limitation, not a passing test result. The next execution must begin with `supabase init` (without linking a remote project), then `supabase start` and `supabase db reset` locally.
