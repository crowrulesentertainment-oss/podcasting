# Stripe Integration TODO

## Values to Replace

There are currently **no Checkout Studio placeholder values** in the repository Checkout integration.

The active membership flow retrieves its real recurring Stripe Price IDs from Supabase at runtime. The repository `create-checkout` function also receives a real Stripe Price ID from its authenticated caller.

**Files containing placeholders:**
- None.

## Configured Parameters

These Checkout Session parameters are configured in the existing integration.

**Files containing these parameters:**
- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts)
- Supabase Edge Function `membership-checkout`
- [js/podcasting.js](js/podcasting.js)
- [membership.html](membership.html)

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

## Setup and Next Steps

1. Keep `STRIPE_SECRET_KEY` in Supabase Edge Function secrets only. Never put the secret key in browser code or GitHub.
2. Keep the Stripe publishable key in [js/config.js](js/config.js) only if it is intended for the currently connected/test Stripe account.
3. Ensure every active paid membership plan has a real recurring Stripe Price ID in `membership_plans.stripe_price_id`.
4. Test the active embedded membership Checkout flow in Stripe test mode before going live.
5. Verify the Checkout Session returns `client_secret` and that the embedded form mounts into `#checkout-form`.
6. Keep subscription fulfillment webhook-driven; do not treat browser confirmation as the source of truth.
7. Automatic Stripe Tax is intentionally disabled because Checkout Studio configured `automatic_tax.enabled=false`. Enable and configure Stripe Tax separately when the CrowRules tax requirements are ready.
8. If the new CrowRules Stripe Connect platform account is being adopted, update the Supabase `STRIPE_SECRET_KEY` to the new platform account's test key before testing payments against that account.
9. Re-onboard connected creators under the new Connect platform account before production payouts are enabled.

## Project Structure

- [membership.html](membership.html) — loads Stripe.js from the required Dahlia build and provides `#checkout-form`.
- [js/podcasting.js](js/podcasting.js) — resolves the selected membership plan, invokes `membership-checkout`, initializes `initCheckoutFormSdk`, mounts the expanded form, and wires confirmation.
- [js/config.js](js/config.js) — browser-safe CrowRules configuration including the publishable Stripe key.
- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts) — existing server-side Checkout Session implementation; updated surgically to match the configured fields.
- Supabase Edge Function `membership-checkout` — active recurring membership Checkout implementation.

## How It Works

1. A signed-in member chooses a paid membership plan.
2. The browser resolves the selected plan to its `plan_key`.
3. The browser invokes the authenticated `membership-checkout` Edge Function.
4. The server retrieves the active recurring Stripe Price ID.
5. The server creates a subscription-mode Checkout Session using the configured Checkout parameters.
6. The server returns JSON containing `client_secret`.
7. Stripe.js initializes the Checkout Form with the configured appearance.
8. The expanded form mounts into `#checkout-form`.
9. The Checkout SDK confirmation action completes the payment.
10. Subscription fulfillment remains webhook-driven.

## Testing

Use Stripe test mode and Stripe's documented test payment methods.

Verify:

- Checkout Session mode is `subscription`.
- `ui_mode` is `form` for the active membership flow.
- `billing_address_collection` is `auto`.
- `phone_number_collection.enabled` is `false`.
- `payment_method_collection` is `always`.
- `automatic_tax.enabled` is `false`.
- `submit_type` is `auto`.
- `integration_identifier` is `custom_embedded_web_0001`.
- The response contains `client_secret`.
- Stripe.js loads from https://js.stripe.com/dahlia/stripe.js.
- The Checkout Form mounts successfully.
- The confirm action completes successfully.
- Subscription webhook processing records the resulting subscription.
- Existing subscription upgrade behavior remains intact.

## Remaining Production Work

The Checkout form integration itself is configured. Before production:

1. Connect the correct new Stripe platform account.
2. Replace/update the Supabase Stripe secret with the new account's key.
3. Verify the new Connect platform configuration.
4. Re-onboard creators under the new Connect platform.
5. Configure Stripe Tax when tax calculation is ready.
6. Test payment, refund, Connect transfer, and webhook reconciliation flows end-to-end.
7. Only then switch production credentials and live mode.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout/quickstarts
