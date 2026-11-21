# Policy acceptance implementation plan

Status: the corrected design has been approved. Implementation preparation is in progress on `implementation/policy-acceptance-reconciliation`. All SQL remains a disposable-only candidate; no production schema, authentication enforcement, policy publication, or acceptance enforcement has been changed.

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

The public member acceptance wrapper is SECURITY DEFINER, owned by a dedicated NOLOGIN, NOINHERIT, NOBYPASSRLS role named `crowrules_policy_owner`, with an empty search path. It validates the member ID through a narrow private identity bridge that calls fully qualified `auth.uid()`. Supabase's `auth` schema ACL does not grant the restricted owner role direct access, so the bridge is SECURITY DEFINER, owned by the trusted migration executor, fixed to an empty search path, and executable only by `crowrules_policy_owner`. The acceptance implementation itself remains SECURITY INVOKER in the non-exposed `crowrules_policy_private` schema. The private implementation is SECURITY INVOKER and is owned by the same restricted role. The owner is not a policy-table owner and is not a member of any other role, so RLS continues to apply inside the wrapper and its owned discovery RPCs. PostgreSQL 16+ automatically gives a CREATEROLE creator an ADMIN-only membership in a newly created role (`INHERIT FALSE`, `SET FALSE`); the migration preserves only that trusted database-executor membership and revokes the temporary SET-capable grant used for ownership transfer. No application/client role is a member.

PUBLIC, anon, authenticated, and service_role have no USAGE on `crowrules_policy_private` and no EXECUTE on the private helper. Authenticated members receive EXECUTE only on the public wrapper. The wrapper cannot be invoked by anon and does not accept a caller-supplied user ID or timestamp. The private schema must remain absent from the project's exposed Data API schemas.

Current discovery is explicit through `public.get_current_policy_versions()`; historical published content is exposed through `public.get_published_policy_history()`. These fixed-search-path SECURITY DEFINER RPCs are owned by the restricted non-bypass role, not postgres or the policy tables' owner. Their narrow RLS policies allow them to evaluate withdrawn/expired candidates without exposing withdrawn content to public clients. RPCs are used instead of views because Supabase's security advisor flags security-definer views even when their owner is restricted and RLS remains enabled.

Acceptance and lifecycle RPCs require READ COMMITTED isolation. The lock protocol is catalog sentinel first, parent documents in ascending UUID order, then version rows in deterministic order. The catalog sentinel prevents a newly inserted policy document from becoming a phantom outside an acceptance transaction's complete required-set scan. Document creation locks that sentinel; publication, withdrawal, and draft mutation lock the parent before the version.

Admin-only lifecycle RPCs use the existing `private.crowrules_is_admin_impl()` authorization helper. They create documents/drafts, edit drafts, publish, and withdraw through the same controlled lock protocol. No client table write grants are added. Acceptance remains append-only and promotional email consent remains a separate opt-in system.

### Member Agreements & Policies area

Added an Agreements & Policies tab to the signed-in account center. It provides links to the five public policy documents, an acceptance-history area, and an optional live-ledger read path. If the schema is not present or not reachable, the page displays a clear not-connected state rather than claiming the member accepted or declined anything. No acceptance button, signup gate, or mandatory policy enforcement is enabled in this phase.

### Local validation assets

- docs/policy-acceptance-local-test-plan.md defines the disposable local Supabase workflow and anonymous, member A, member B, cross-member, RPC, idempotency, lifecycle, and immutability checks.
- docs/policy-acceptance-local-tests.sql provides a transaction-scoped SQL harness. It requires two disposable Auth users and is designed to be run only against a local development database; it rolls back its fixture data.

### Explicit limits

No Supabase branch/project was created and no production SQL was executed. At the time of Phase 1D, the migration, RLS policies, and RPC had not yet been run against Postgres; subsequent disposable-only validation is recorded in Phase 1E below. The member UI's live ledger path remains intentionally dormant pending formal migration review and a separately authorized rollout. No production deployment or merge of the Phase 1D follow-up commits was performed.


### Local execution readiness (2026-11-20)

The first static pass found that the migration referenced a private implementation schema without creating it. The migration now creates a dedicated `crowrules_policy_private` schema, revokes schema access from PUBLIC and anon, and grants the minimum schema usage and function execution needed by authenticated sessions. This schema must not be added to the Supabase Data API exposed-schema list.

The preceding Phase 1D note recorded that the interactive execution container lacked the Supabase CLI and Docker runtime. Subsequent CI validation now runs the candidate in a temporary local Supabase workspace, applies it with `supabase db reset`, verifies migration history, and uploads the CLI-generated migration artifact; current results are recorded in Phase 1E below.


## Corrected implementation preparation (2026-11-21)

The approved design has been translated into a source template at `docs/policy-acceptance-reconciliation-draft.sql`. It remains outside `supabase/migrations/` until the generated artifact is reviewed. CI uses `supabase migration new` in a temporary project, copies the source template into the timestamped migration, applies the local chain, and uploads the generated file.

The candidate does not edit either merged historical migration. It is additive after the foundation and expiration migrations. It adds a restricted function owner, private catalog-lock sentinel, fixed-search-path current/history discovery RPCs, the corrected wrapper/helper privilege boundary, controlled admin lifecycle RPCs, and parent-first locking. The candidate's acceptance selector chooses the latest effective published-or-withdrawn version before evaluating withdrawal or expiry; it never falls back to an older version. The restricted owner has only INSERT plus column-level SELECT on the acceptance conflict keys.

The tests use only synthetic Auth identities and fixtures. They cover the complete required set, idempotency, no-fallback after withdrawal/expiry, current/history discovery RPCs, admin authorization, private helper denial, READ COMMITTED enforcement, two-session lifecycle races, and the catalog-sentinel phantom case. Phase 1E validation results follow.

No production migration, production schema/grant/RLS/configuration change, policy publication, policy acceptance enforcement, or marketing-consent change is authorized by this implementation-preparation milestone.

## Phase 1E disposable validation results (2026-11-21)

- PostgreSQL 16 disposable service tests passed, including RLS, ledger writes, idempotency, lifecycle/immutability, expiry boundaries, current/history RPCs, identity-bridge privileges, READ COMMITTED enforcement, and two-session concurrency with catalog-sentinel phantom prevention.
- Isolated local Supabase tests passed the full migration chain via supabase db reset, migration-history verification, synthetic Auth tests, the same SQL and concurrency suites, and supabase db advisors.
- The Supabase security advisor returned No issues found after replacing security-definer views with fixed-search-path discovery RPCs.
- CI generated a timestamped reconciliation migration using supabase migration new in a disposable project and uploaded it as a review artifact. The source template remains in docs/; the formal repository migration is not yet committed.
- The role-owner implementation accounts for PostgreSQL 16's automatic ADMIN-only CREATEROLE creator membership. The trusted executor's automatic membership remains non-inheriting and non-SET-capable; only the temporary SET-capable grant used for ownership transfer is revoked. See the PostgreSQL 16 role attributes documentation: https://www.postgresql.org/docs/16/role-attributes.html.
- The private identity bridge calls fully qualified auth.uid() under the trusted migration executor because the restricted owner role has no auth schema usage. It exposes no table access and is executable only by the restricted owner role.
- Current/history discovery uses restricted SECURITY DEFINER RPCs rather than views; the RPCs expose only published policy content and preserve no-fallback semantics.
- No production database was accessed or changed. No production schema, grants, RLS, or configuration were modified. No policy was seeded or published, and acceptance enforcement remains disabled. PR #71 remains draft and unmerged.