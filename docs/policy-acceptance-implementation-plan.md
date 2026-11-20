# Policy acceptance implementation plan

Status: implementation design only. No database schema, authentication behavior, or production policy has been changed by this document.

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
