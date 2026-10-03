# Stripe Integration TODO

## Current Stripe Platform Status

**New live CrowRules Podcasting platform account verified:** `acct_1UMQltAEVUNQd17S`.

The Stripe connection now exposes both the old test account and the new live account. The new account is **not yet production-ready**: Stripe currently reports `details_submitted=false`, `charges_enabled=false`, `payouts_enabled=false`, and required platform business/representative information is still due.

The old account `acct_1UJ6opAcvLNLtuQD` remains untouched.

### What has been completed

- New live Stripe account is visible to the Stripe integration.
- CrowRules marketplace architecture is confirmed as Connect Marketplace.
- Destination charges remain the intended payment flow.
- CrowRules platform fee remains 20%; creator proceeds remain 80%.
- Marketplace connected accounts use recipient/transfer capability checks.
- Embedded Connect onboarding/components remain the intended creator experience.
- Existing Checkout Studio/embedded Checkout work remains configured.
- Existing creator mappings in Supabase were **not deleted or overwritten**.

### Required before production

1. Complete the new Stripe platform account's required business and representative information in Stripe Dashboard.
2. Accept/configure the Connect platform liability settings required for marketplace operation.
3. Create/obtain the new account's restricted API key and store it as the Supabase Edge Function `STRIPE_SECRET_KEY` secret. Never commit it to GitHub or browser code.
4. Obtain the new account's publishable key and replace the old test publishable key in `js/config.js` when moving the browser integration to the new live account.
5. Configure the new platform's webhook endpoint and signing secret for the existing reconciliation flow.
6. Re-onboard existing creators under the new Connect platform. Do not reuse or delete old connected-account records until migration is verified.
7. Verify recipient `stripe_balance.stripe_transfers.status` before every creator transfer.
8. Run end-to-end live-mode verification with a controlled transaction before opening production payments.

## Values to Replace

There are currently **no Checkout Studio placeholder values** in the repository Checkout integration.

The active membership flow retrieves its real recurring Stripe Price IDs from Supabase at runtime. The repository `create-checkout` function also receives a real Stripe Price ID from its authenticated caller.

**Files containing placeholders:**
- None.

## Configured Checkout Parameters

| Parameter | Value |
|-----------|-------|
| ui_mode | custom for `stripe@18.5.0` in `create-checkout`; form for the active membership Checkout flow |
| mode | subscription |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| payment_method_collection | always |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |
| line_items | Real Stripe Price ID supplied at runtime |
| Stripe API version | 2026-03-25.dahlia; custom_checkout_payment_form_preview=v1 |
| Stripe.js build | https://js.stripe.com/dahlia/stripe.js |
| Checkout Form layout | expanded |

The `create-checkout` server function uses Stripe SDK `18.5.0`, so the Checkout SDK version rule requires `ui_mode: "custom"`. The active membership flow uses the embedded `form` mode and already loads the required Dahlia Stripe.js build.

The unused `customer` parameter was removed from `create-checkout` because it was not part of the configured Checkout Studio fields.

## Project Structure

- `membership.html` — loads Stripe.js and provides `#checkout-form`.
- `js/podcasting.js` — invokes membership Checkout and mounts the embedded form.
- `js/config.js` — browser-safe CrowRules configuration and current publishable test key.
- `supabase/functions/create-checkout/index.ts` — server-side Checkout Session implementation.
- Supabase Edge Function `membership-checkout` — active recurring membership Checkout implementation.
- Supabase Edge Function `creator-connect-onboarding` — creator Connect onboarding/readiness flow.
- Supabase Edge Function `member-payment-checkout-v2` — creator-payment destination-charge flow with the 20% platform fee.

## Important Credential Boundary

The new Stripe account is live, but its secret and publishable keys are not exposed through the Stripe connector. They must be created/retrieved in Stripe Dashboard and placed in their intended locations:

- `STRIPE_SECRET_KEY` → Supabase Edge Function secret only.
- Publishable key → `js/config.js` only.
- `STRIPE_WEBHOOK_SECRET` → Supabase Edge Function secret only.

Do **not** paste secret keys into chat or commit them to GitHub.

## Existing Creator Records

The current Supabase creator mappings remain intact:

- `acct_1UJTFpPNTMuZr8sz` — Jonathan Riehle II — pending
- `acct_1UMIwuATixwmfaLu` — Jason Riehle — pending

These accounts were created under the previous platform context. They should be re-onboarded under `acct_1UMQltAEVUNQd17S` after the new platform is fully configured.

## Production Flow

1. Customer chooses a membership/payment.
2. CrowRules server creates the Checkout Session on the new platform account.
3. Customer completes embedded Checkout.
4. Stripe records the payment/subscription.
5. Webhooks reconcile payment state.
6. For creator marketplace payments, CrowRules retains the configured 20% application/platform fee.
7. The connected creator receives the remaining 80% through the destination-charge/Connect flow.
8. Refund/reversal handling reconciles the application fee and creator transfer.

## Testing

Before production, verify:

- New platform account is fully enabled.
- Checkout Session creation succeeds using the new platform credentials.
- `client_secret` is returned.
- Embedded Checkout mounts and confirms successfully.
- Creator onboarding completes.
- Recipient transfer capability reports `active`.
- A controlled creator payment produces the expected 20%/80% split.
- Webhooks reconcile payment, refund, and transfer records.
- No old-platform credentials are being used by active production functions.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/connect
- https://docs.stripe.com/api/v2/core/accounts
- https://docs.stripe.com/connect/marketplace
- https://docs.stripe.com/connect/embedded-onboarding
- https://docs.stripe.com/connect/supported-embedded-components/notification-banner
