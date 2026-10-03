# Stripe Integration TODO

## Values to Replace

The following value is a placeholder and must be updated before using the embedded Checkout form.

**Files containing placeholders:**
- [js/config.js](js/config.js)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| stripePublishableKey | pk_test_... | Your Stripe publishable key for the new CrowRules Connect platform account. Do not use the old platform account key. |

The Checkout Session's `mode` and `line_items[].price` are not placeholders in the server implementation: this existing membership flow uses recurring subscriptions and supplies the Stripe Price ID at runtime.

## Configured Parameters

**Files containing these parameters:**
- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | custom (Stripe SDK 18.5.0 is below 21.0.0; the Checkout Studio `form` value maps to `custom` for this SDK) |
| mode | subscription |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| payment_method_collection | always |
| submit_type | auto |
| integration_identifier | custom_embedded_web_0001 |

## Setup and Next Steps

1. Set `stripePublishableKey` in [js/config.js](js/config.js) to the publishable key for the new CrowRules Stripe Connect platform account.
2. Keep `STRIPE_SECRET_KEY` configured as a Supabase Edge Function secret; never put it in browser code or GitHub.
3. Ensure each active membership plan has a real recurring Stripe Price ID.
4. Deploy the updated `create-checkout` Supabase Edge Function.
5. Test the embedded Checkout form in Stripe test mode.
6. Because this is subscription mode, verify subscription lifecycle fulfillment is handled by verified Stripe webhooks.
7. Automatic Stripe Tax is intentionally disabled because Checkout Studio explicitly configured `automatic_tax.enabled=false`. Enable and configure Stripe Tax separately if/when CrowRules wants Checkout to calculate tax.

## Project Structure

- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts) — server-side Checkout Session creation.
- [js/config.js](js/config.js) — browser-safe Stripe publishable-key configuration.
- [js/podcasting.js](js/podcasting.js) — embedded Checkout Form initialization and confirmation.
- [membership.html](membership.html) — Stripe.js loading and Checkout Form mount point.

## How It Works

1. A signed-in member chooses a recurring membership plan.
2. The browser sends that plan's Stripe Price ID to the Supabase `create-checkout` function.
3. The server authenticates the Supabase user, obtains or creates the Stripe Customer, and creates a recurring Checkout Session.
4. The server returns JSON containing `client_secret`.
5. Stripe.js loads from the required Dahlia build and initializes the embedded Checkout Form.
6. The Checkout Form mounts in `#checkout-form` and confirms through Stripe's Checkout SDK.
7. Subscription fulfillment should be finalized from Stripe webhook events, not a browser success state.

## Testing

Use Stripe test mode and documented Stripe test payment methods. Verify:
- Checkout Session mode is `subscription`.
- `ui_mode` is `custom` for the current Stripe Node SDK 18.5.0.
- `payment_method_collection` is `always`.
- `automatic_tax.enabled` is `false`.
- The response contains `client_secret`.
- The embedded form loads from `https://js.stripe.com/dahlia/stripe.js`.

Do not use live credentials until the new Connect platform account, webhooks, creator Connect configuration, and subscription fulfillment have been verified.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/api/checkout/sessions/create
