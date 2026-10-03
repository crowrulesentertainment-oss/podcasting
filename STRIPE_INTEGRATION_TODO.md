# Stripe Integration TODO

## Values to Replace

The following value is still a placeholder and must be updated before using the embedded Checkout form.

**Files containing placeholders:**
- [js/config.js](js/config.js)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| stripePublishableKey | pk_test_... | Your Stripe publishable key for the new CrowRules Stripe platform account. Keep the secret key server-side only. |

The Checkout Session's mode and line_items[0].price are not placeholders: this existing membership flow uses recurring subscriptions and retrieves the active Stripe Price ID from membership_plans at runtime.

## Configured Parameters

**Files containing these parameters:**
- Supabase Edge Function membership-checkout
- [js/podcasting.js](js/podcasting.js)

| Parameter | Value |
|-----------|-------|
| ui_mode | form |
| mode | subscription |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| payment_method_collection | always |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |
| Stripe API version | 2026-03-25.dahlia; custom_checkout_payment_form_preview=v1 |
| Stripe.js build | https://js.stripe.com/dahlia/stripe.js |
| Checkout Form layout | expanded |

SDK note: the browser integration uses the Dahlia Stripe.js build and form Checkout UI. The server currently uses Stripe's HTTP API directly, so no server SDK package version determines ui_mode.

## Setup and Next Steps

1. Replace stripePublishableKey in [js/config.js](js/config.js) with the publishable key for the new CrowRules Stripe platform account.
2. Keep STRIPE_SECRET_KEY configured as a Supabase Edge Function secret. Never put the secret key in browser code or GitHub.
3. Ensure each active paid membership plan has a real recurring Stripe Price ID in membership_plans.stripe_price_id.
4. The updated membership-checkout Edge Function is already deployed and requires an authenticated Supabase user.
5. Test the embedded Checkout form in Stripe test mode before switching to live mode.
6. Verify subscription lifecycle fulfillment continues to be handled by the signed Stripe webhook flow rather than browser-only success state.
7. Automatic Stripe Tax is intentionally disabled because Checkout Studio configured automatic_tax.enabled=false. Configure Stripe Tax separately before enabling tax calculation.
8. Do not place Stripe secret keys in js/config.js or any other browser-accessible file.

## Project Structure

- [membership.html](membership.html) — loads Stripe.js from the required Dahlia build and provides #checkout-form.
- [js/podcasting.js](js/podcasting.js) — resolves the selected membership plan, calls membership-checkout, initializes initCheckoutFormSdk, mounts the expanded form, and wires confirmation.
- [js/config.js](js/config.js) — browser-safe Stripe publishable-key configuration.
- Supabase membership-checkout — authenticates the member, resolves the active recurring Price ID, creates the Checkout Session, and returns client_secret.

## How It Works

1. A signed-in member chooses a paid membership plan.
2. The browser resolves the selected plan to its plan_key.
3. The browser invokes the authenticated Supabase membership-checkout function.
4. The server retrieves the active recurring Stripe Price ID and creates a Checkout Session in subscription mode.
5. The server returns JSON containing client_secret.
6. Stripe.js initializes the Checkout Form using the configured appearance.
7. The expanded form mounts into #checkout-form.
8. The Checkout SDK confirmation action completes the payment.
9. Subscription fulfillment remains webhook-driven.

## Testing

Use Stripe test mode and documented Stripe test payment methods. Verify:

- Checkout Session mode is subscription.
- ui_mode is form.
- billing_address_collection is auto.
- phone_number_collection.enabled is false.
- payment_method_collection is always.
- automatic_tax.enabled is false.
- submit_type is auto.
- integration_identifier is custom_embedded_web_0001.
- The response contains client_secret.
- Stripe.js loads from https://js.stripe.com/dahlia/stripe.js.
- The Checkout Form mounts successfully and the confirm action completes.
- Existing subscriptions still use the upgrade path correctly.

Stripe's Checkout Sessions API requires Checkout mode to match the product type; recurring Prices use subscription mode.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout/quickstarts
