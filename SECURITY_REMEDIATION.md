# Targeted Podcasting Security Remediation

Branch: `security/targeted-remediation-2026-11-14`

## Scope

This change is intentionally narrow. It does not alter existing records, Stripe settings, authentication providers, premium playback, or unrelated RLS policies.

## Included

1. Restrict authenticated reads of `creator_profiles` to the profile owner or profiles explicitly marked `is_discoverable = true`.
2. Enforce podcast/creator ownership for monetization products with a database trigger. The trigger also protects writes made by service-role Edge Functions, which bypass RLS.
3. Tighten the existing creator product management RLS policy with the same podcast ownership condition.
4. Version-control a patched `create-podcast-product` Edge Function that validates the submitted podcast belongs to the authenticated creator before creating Stripe objects.

## Preflight observations

- Existing monetization products: 7.
- Existing podcast-linked products: 7.
- Existing cross-creator mismatches: 0.
- Creator profiles: 8; 7 discoverable, 1 private or unset.
- The migration preserves existing data and the existing public active-product SELECT policy.

## Deployment status

This is a review branch only. The SQL migration has not been applied to production, and the Edge Function has not been deployed. Apply the migration and deploy the Edge Function only after review and staging verification.

## Remaining remediation work

- Move draft episode uploads out of the public published-media bucket; requires storage/path and playback workflow review.
- Add server-side upload size, MIME and file-signature validation to premium uploads.
- Validate Stripe redirect URLs against an explicit allowlist.
- Add abuse controls to public presence and application endpoints.
- Review SECURITY DEFINER views/RPC grants and the separate LiveKit token service.
