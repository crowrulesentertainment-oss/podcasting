# Versioned policy acceptance: corrected foundation and expiration design

**Status:** Design revision for review only. This document supersedes the earlier expiration-only design notes where they conflict with the decisions below. It is not migration SQL and is not authorization to deploy.

**Scope of this milestone:** reconcile the versioned-policy foundation and expiration behavior as one coherent design. Do not apply database changes, publish policy content, enable member acceptance enforcement, or generate replacement migration SQL during this milestone.

## 1. Decisions and invariants

The design must preserve all of these invariants:

1. **Withdrawal never revives an older version.** For a document, the latest effective lifecycle version is authoritative. If it is withdrawn, the document has no current version. A new replacement version must be published and become effective before the document has a current version again.
2. **Expiration never revives an older version.** Select the latest effective lifecycle version first, then evaluate its expiry. An expired latest version does not fall back to an earlier version.
3. **The public acceptance RPC is the only member-facing write path.** Authenticated members can execute the public wrapper, but cannot use SQL privileges or the Data API to invoke the private implementation directly.
4. **Acceptance and lifecycle changes serialize per document.** Acceptance, publication, and withdrawal use the same parent-document lock and lock order.
5. **Acceptance history is append-only.** Prior acceptance rows and timestamps are not rewritten when a policy expires or is withdrawn.
6. **Legal acceptance is not marketing consent.** Existing marketing and creator-daily consent tables remain separate and must not be repurposed.
7. **Existing `cr_internal` functionality is out of scope.** Do not merge legal policy acceptance into unrelated alert, evidence, security, recovery, or notification functions.

## 2. Version lifecycle and authoritative selection

A policy version has a lifecycle status of `draft`, `published`, or `withdrawn`, with an `effective_at` timestamp and optional `expires_at` timestamp.

For each policy document:

1. Consider versions whose `effective_at <= transaction_timestamp()` and whose lifecycle status is either `published` or `withdrawn`.
2. Select the single latest candidate using a deterministic ordering: `effective_at DESC, published_at DESC, id DESC`. The final unique tie-breaker must be stable and identical in every query and RPC.
3. Only after selecting that candidate, evaluate its status and expiry:
   - If it is `withdrawn`, the document has **no current version**.
   - If it is `published` and `expires_at IS NOT NULL AND expires_at <= transaction_timestamp()`, it is expired and the document has **no current version**.
   - Otherwise, the selected published version is current.
4. A future-effective version does not supersede the current version early.
5. Never filter withdrawn or expired versions out before choosing the latest candidate. Doing so would incorrectly make an older published version appear current.
6. A new replacement after withdrawal must be a new version. Restoring or re-publishing the withdrawn row is prohibited.
7. A latest optional version still supersedes earlier versions for current-version discovery. It does not create an acceptance requirement unless its own `requires_acceptance` is true.

### Required acceptance behavior

- Determine the current version using the same authoritative selection algorithm.
- A current required version must be accepted before the member can complete the acceptance flow.
- If the latest effective version is withdrawn or expired and no effective replacement exists, do not silently omit the document from the required set and do not accept an older version as a fallback. Return a clear unavailable-policy error and block completion of the acceptance operation.
- A future-effective replacement does not cure the gap until its effective timestamp is reached.
- Validate the complete required set before inserting any acceptance rows. The operation must be all-or-nothing.
- Duplicate acceptance of the same user/version pair must be idempotent and must not alter the original `accepted_at` timestamp.

## 3. Public policy discovery and historical visibility

The database must provide an explicit, stable public current-version query contract (for example, a narrowly scoped view or equivalent server-side query). Client code must not infer “current” by sorting all visible versions itself.

The current-version query must apply the exact authoritative selection algorithm in Section 2. A withdrawn or expired latest candidate produces no current row; it must never return an older version as current.

Visibility rules:

- Anonymous and authenticated users may read published policy text intended for public/member display, including prior published versions needed as historical evidence.
- Draft versions are never publicly readable.
- Withdrawn version content is not presented as an active policy. Whether its text is retained for administrators/audit is a separate privileged access decision; it must not appear as a current public policy.
- Historical published versions may remain readable, but every client presentation must identify them as historical, superseded, withdrawn/expired where applicable, and not available for new acceptance.
- Acceptance history is readable only by the owning authenticated member and authorized administrative roles.
- Public current-version discovery must not expose private acceptance rows or administrative metadata.

RLS policies and the view/query contract must be tested together. A broad “all effective published versions” read policy may support historical display, but it is not a substitute for an explicit current-version contract.

## 4. RPC privilege boundary

### Member-facing entry point

Expose one public function, conceptually `public.accept_current_required_policy_versions(...)`, as the only member-facing acceptance operation.

- Grant EXECUTE to `authenticated` only.
- Revoke EXECUTE from `PUBLIC` and `anon`.
- The public wrapper is `SECURITY DEFINER`, has a fixed empty search path (`SET search_path = ''`), and is owned by a tightly controlled, non-login function-owner role.
- The wrapper must obtain and validate the caller identity using the fully qualified `auth.uid()` before delegating. A null identity is rejected.
- All object references are schema-qualified. Use no untrusted dynamic SQL, caller-controlled object names, or caller-controlled role switching.
- The function owner must have only the table/schema privileges required for this operation and must not have `BYPASSRLS`. The final migration review must verify the actual owner, grants, role attributes, and RLS interaction rather than assuming the migration runner's role.

### Private implementation

- Keep the implementation in `crowrules_policy_private`, which is not exposed through Supabase Data API schemas.
- Revoke schema USAGE and function EXECUTE from `PUBLIC`, `anon`, and `authenticated`.
- Do not grant the private implementation to authenticated users. In particular, do not repeat the existing grants that allow authenticated schema usage and direct execution.
- The private implementation should be an owner-only helper, preferably `SECURITY INVOKER`, called only while the public wrapper's controlled definer context is active. It must not independently widen privileges.
- The wrapper's owner must be able to resolve and execute the helper; client roles must not.
- Revoke direct INSERT/UPDATE/DELETE privileges on the acceptance ledger from client roles. Members must not be able to write acceptance rows through direct table access or alternate RPCs.
- Preserve member-only SELECT access to a member's own acceptance history.

### Required privilege verification

Tests must inspect, not merely assume:

- `has_schema_privilege('authenticated', 'crowrules_policy_private', 'USAGE') = false`.
- `has_function_privilege('authenticated', private_helper_oid, 'EXECUTE') = false`.
- The equivalent checks for `anon` and `PUBLIC` are false.
- Authenticated can execute the public wrapper; anon cannot.
- The wrapper owner, helper owner/security mode, function configuration, role attributes, schema grants, and Data API exposed-schema configuration match this design.
- Direct ledger writes by anon/authenticated fail.
- Direct invocation of the private helper by an authenticated SQL/API session fails, even if the caller knows the helper's exact signature.

The database privilege boundary is primary. Excluding the private schema from Data API exposure is additional defense-in-depth, not a replacement for revoking SQL privileges.

## 5. Concurrency and lock protocol

Acceptance must not race publication or withdrawal and record acceptance for a version that ceased to be current during the operation.

### Common lock order

Use the parent `policy_documents` row as the serialization point for every operation that changes the effective policy state or accepts current required policies.

1. Acquire parent document row locks in ascending document ID order.
2. Only after acquiring those locks, read/lock the relevant policy version rows and evaluate the current required set.
3. Perform acceptance inserts or the lifecycle mutation.
4. Commit the transaction, releasing locks.

All code paths must follow this order. Never lock a version row and then attempt to acquire its parent document row; that reverses the lock order and can deadlock with acceptance.

### Acceptance path

- Determine the set of policy documents in scope.
- Lock their parent rows in deterministic ascending ID order.
- After locks are held, re-evaluate the authoritative current version for each document using the transaction's consistent timestamp.
- Validate that every required document has a current, non-expired, non-withdrawn version.
- Validate the submitted/accepted version IDs against that exact current required set.
- Insert the complete acceptance set atomically. On any validation failure, insert none.

### Publication and withdrawal path

- Route publication and withdrawal through controlled administrative RPCs or an equivalent single trusted server-side mutation path.
- Each mutation path must lock the parent document row first, then update the version row.
- Revoke direct DML from application/client roles so clients cannot bypass the controlled path.
- A trigger may enforce immutable content and legal lifecycle transitions as defense-in-depth, but a row trigger that first locks the parent after the UPDATE has already locked the version row must not be treated as the concurrency protocol; that can invert the lock order.
- Any privileged administrative script or service that changes policy lifecycle must use the same parent-first protocol. Document this as an operational invariant and test the supported mutation entry points.
- Publication/withdrawal must re-check lifecycle preconditions after acquiring the parent lock.

### Concurrency acceptance criterion

Two-session tests must demonstrate serializable outcomes at the document level:

- If acceptance obtains the document lock first, it may accept the then-current version; the later withdrawal/publication commits afterward.
- If withdrawal obtains the lock first, acceptance observes the withdrawn latest version and fails until a replacement is effective.
- If publication obtains the lock first, acceptance observes the newly effective version and requires that version.
- No interleaving may accept an older version after a newer effective version has been published or after the latest version has been withdrawn.
- Test multiple documents locked in different input orders to confirm deterministic ordering avoids deadlocks.

## 6. Expiration semantics

Add nullable `policy_versions.expires_at timestamptz`.

- `NULL` means no scheduled expiration.
- A non-null value must be strictly later than `effective_at`.
- Expiration is evaluated as an exact timestamp, not as the end of a calendar day.
- A version's expiry can be edited while draft. Once published, it is immutable.
- Corrections to a published version require a new version.
- Expiration does not rewrite lifecycle status, acceptance history, or account state.
- An expired published version remains available as historical text where public historical visibility rules permit it; it cannot be newly accepted.
- When the latest required version expires and no replacement is effective, the acceptance operation fails clearly. Do not fall back to an older version or silently omit the document.
- Display expiration date/time with an explicit timezone. Avoid ambiguous phrases such as “expires tonight.”
- Describe any resulting restriction narrowly as an acceptance-flow restriction; do not imply expiration itself suspends the member's account or disables unrelated Podcasting features.

## 7. Migration architecture — design only, not SQL

The eventual replacement migration set should be generated only after this design is reviewed and approved. It should reconcile the foundation and expiration migrations as one consistent architecture.

### Foundation migration responsibilities

- Create policy documents, immutable policy versions, and append-only acceptance history.
- Define lifecycle constraints and content immutability.
- Define explicit current-version discovery and historical visibility.
- Establish the public-wrapper/private-helper privilege boundary correctly from the start.
- Establish controlled publication/withdrawal mutation paths and the parent-first lock protocol.
- Keep existing marketing consent, creator-daily consent, and `cr_internal` objects untouched.

### Expiration migration responsibilities

- Add and validate `expires_at`.
- Make published expiry immutable.
- Update current-version discovery and acceptance validation to apply expiration **after** latest-candidate selection.
- Preserve the same wrapper/helper privilege boundary and lock protocol; it must not re-grant private schema USAGE or helper EXECUTE to client roles.
- Ensure withdrawal and expiration share the no-fallback semantics without conflating their lifecycle meanings.

Do not patch the existing migration files in place as a shortcut. Replacement migration SQL must be generated and reviewed as a later, separately authorized implementation milestone, with a clear migration-history strategy for the already merged migration files.

## 8. Validation plan for the later implementation milestone

Validation must use a disposable local Supabase/PostgreSQL environment with synthetic identities and data. No production credentials or remote database are needed.

### Selection and lifecycle tests

- Draft, future-effective, published, withdrawn, and expired versions.
- Latest effective withdrawn version yields no current version.
- Older published versions remain historical only after withdrawal.
- No fallback to an older version after withdrawal or expiration.
- A new replacement becomes current only when published and effective.
- Future-effective replacement does not become current early.
- Latest optional version supersedes older versions without creating an acceptance requirement.
- Expired required version blocks acceptance until a replacement is effective.
- Expiration at the exact current timestamp is treated as expired.
- Invalid expiry at/before effective time is rejected.
- Published expiry and published policy content are immutable.

### RPC and RLS tests

- Anonymous current-policy reads behave as specified.
- Anonymous and authenticated historical visibility is limited to published history.
- Draft and withdrawn content is not exposed as active/public current policy.
- Authenticated can call the public acceptance wrapper.
- Anonymous cannot call the wrapper.
- Authenticated cannot use private schema or execute private helper directly.
- Neither anon nor authenticated can directly insert, update, or delete acceptance rows.
- Members can read only their own acceptance history.
- Function ownership, security mode, fixed search path, grants, role attributes, and Data API schema exposure are asserted in tests.
- Existing `cr_internal` behavior and unrelated consent tables remain unchanged.

### Concurrency tests

Use two independent database sessions and explicit barriers/transactions to test acceptance racing with publication and withdrawal. Assert the allowed serial orderings from Section 5 and verify there is no stale-version acceptance, deadlock, partial acceptance set, or duplicate timestamp rewrite.

### Regression and repository checks

- Apply the complete replacement migration chain to a clean disposable database.
- Run migration reset/history verification.
- Run the SQL/RLS/privilege/concurrency tests against the exact candidate commit.
- Re-run the relevant CI workflows after all design-driven SQL/test changes.
- Keep unrelated historical migration failures isolated; do not broaden scope to repair unrelated Podcasting migrations in this milestone.

## 9. Production and rollout boundary

This design revision does not authorize:

- Applying, repairing, or rolling back any production migration.
- Creating or modifying production tables, functions, grants, RLS policies, or Supabase settings.
- Publishing, activating, or editing any live policy.
- Enabling acceptance enforcement.
- Changing existing `cr_internal` functions or unrelated consent systems.

Before any production work, the reviewed design must be approved, replacement migrations and tests must pass in disposable environments, production Data API exposure and grants must be inspected read-only, and a separate explicit production authorization must be obtained.

**Current milestone exit criteria:** this document is ready for human review only when its decisions are accepted. No replacement migration SQL has been generated or applied as part of this revision.
