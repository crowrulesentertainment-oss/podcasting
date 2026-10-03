# Stripe Integration TODO

## Values to Replace

The following values are placeholders and must be updated before the repository `create-checkout` flow is used in production.

**Files containing placeholders:**
- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts)

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| success_url | https://example.com/success?session_id={CHECKOUT_SESSION_ID} | Your actual post-payment success page URL. Keep the `{CHECKOUT_SESSION_ID}` template. |
| cancel_url | https://example.com/cancel | Your actual cancel/return page URL. |

`line_items[].price` is **not** a placeholder: the function receives the real Stripe Price ID from `body.price_id`.

## Configured Parameters

These parameters were configured in the existing Checkout Session creation call.

**Files containing these parameters:**
- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts)

| Parameter | Value |
|-----------|-------|
| ui_mode | hosted |
| mode | subscription |
| billing_address_collection | auto |
| phone_number_collection.enabled | false |
| automatic_tax.enabled | false |
| allow_promotion_codes | false |
| payment_method_collection | always |
| submit_type | auto |
| integration_identifier | hosted_web_0004 |
| origin_context | web |
| success_url | https://example.com/success?session_id={CHECKOUT_SESSION_ID} — placeholder; replace before production |
| cancel_url | https://example.com/cancel — placeholder; replace before production |
| line_items | Real Stripe Price ID supplied at runtime |
| line_items[].quantity | 1 |

The repository uses Stripe SDK `18.5.0`, so the configured hosted Checkout value follows the requested SDK versioning rule: `ui_mode: "hosted"` for SDKs below 21.0.0.

Only the parameters inside the existing `stripe.checkout.sessions.create(...)` call were changed. Surrounding authentication, customer lookup, response handling, and other code were left untouched.

The separate active membership flow and creator-payment destination-charge flow were not refactored because this task applies the surgical Scenario A change to the existing repository Checkout Session call.

## Setup and Next Steps

1. Replace `success_url` with the actual CrowRules post-payment URL.
2. Replace `cancel_url` with the actual CrowRules cancel/return URL.
3. Keep `STRIPE_SECRET_KEY` server-side in Supabase secrets; never commit it to GitHub or browser code.
4. Ensure `body.price_id` is always a real Stripe Price ID from the intended Stripe account.
5. Verify the Stripe account/credentials used by the deployed function match the intended CrowRules Stripe platform.
6. Test the hosted Checkout redirect in Stripe test mode before enabling production payments.
7. Keep webhook-driven fulfillment for subscriptions and payment state.
8. Configure and verify Connect creator onboarding separately; the 20% CrowRules / 80% creator marketplace flow remains outside this surgical Checkout change.

## Environment Variables

No new environment variables were introduced by this Scenario A change.

The existing server-side `STRIPE_SECRET_KEY` naming remains unchanged. The repository does not use Vite for this server-side function.

## Project Structure

No new files, routes, middleware, or infrastructure were added by this task.

The changed Checkout implementation is:
- [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts)

## How the Integration Works

1. An authenticated caller sends a real `price_id` to the existing `create-checkout` function.
2. The existing server authentication validates the Supabase user.
3. The existing Stripe client creates a subscription Checkout Session.
4. Stripe-hosted Checkout uses the configured Hosted Checkout parameters.
5. The customer is intended to return to the configured `success_url` or `cancel_url`.
6. Subscription fulfillment remains webhook-driven.

## Testing

Use Stripe test mode and Stripe's documented test payment methods.

Verify:
- Checkout Session mode is `subscription`.
- `ui_mode` is `hosted`.
- `billing_address_collection` is `auto`.
- `phone_number_collection.enabled` is `false`.
- `automatic_tax.enabled` is `false`.
- `allow_promotion_codes` is `false`.
- `payment_method_collection` is `always`.
- `submit_type` is `auto`.
- `integration_identifier` is `hosted_web_0004`.
- `origin_context` is `web`.
- `line_items[].price` resolves to a real Stripe Price ID.
- Hosted Checkout redirects correctly after the endpoint's response flow is exercised.
- Successful subscriptions are reconciled by webhook processing.

Use Stripe's official test-mode payment methods rather than real card details.

## Remaining Production Work

1. Replace the two URL placeholders above.
2. Verify the deployed Supabase function uses the intended Stripe secret key.
3. Test a complete subscription in Stripe test mode.
4. Verify webhook delivery and subscription fulfillment.
5. Complete the new CrowRules Stripe platform account setup before live Connect payouts.
6. Re-onboard creators under the new Connect platform before production creator payouts.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/api/checkout/sessions/create
- https://docs.stripe.com/payments/checkout/quickstarts
