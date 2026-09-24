# CrowRules Podcasting — Stripe Connect V2 Demo

This repository now contains a server-side Stripe Connect sample for CrowRules Podcasting.

## What is included

- `stripe-connect-demo.html` — creator onboarding, live status, product creation, subscription checkout, and billing portal UI.
- `stripe-storefront.html` — public storefront for one connected account.
- `stripe-success.html` — simple Checkout return page.
- Supabase Edge Function `stripe-connect-demo` — server-side Stripe Client for:
  - V2 connected-account creation
  - V2 Account Links onboarding
  - direct account status checks
  - connected-account product creation
  - connected-account product listing
  - direct-charge hosted Checkout with an application fee
  - connected-account subscription Checkout
  - billing portal
- Supabase Edge Function `stripe-connect-v2-webhook` — Stripe V2 thin-event parser and handlers.
- Existing `payouts.html` — now links creator payout onboarding to the V2 flow and exposes the commerce manager/storefront.

## Stripe SDK

The Edge Functions use:

```
import Stripe from "npm:stripe@22.6.2";
const stripeClient = new Stripe(STRIPE_SECRET_KEY);
```

The version is pinned to the latest `stripe-node` release found when this integration was created. The SDK is responsible for its default API version; the code does **not** manually set `apiVersion`.

## Required Supabase secrets

Configure these as **server-side Supabase Edge Function secrets**. Never put them in HTML or browser JavaScript.

```text
STRIPE_SECRET_KEY=sk_test_***YOUR_STRIPE_SECRET_KEY***
APPLICATION_FEE_AMOUNT=123
PRICE_ID=price_***YOUR_RECURRING_PRICE_ID***
STRIPE_WEBHOOK_SECRET=whsec_***YOUR_THIN_EVENT_ENDPOINT_SECRET***
```

### Helpful missing-value behavior

The code deliberately fails with a clear message when a required value is missing:

- `STRIPE_SECRET_KEY` → tells you to configure the Stripe secret key.
- `APPLICATION_FEE_AMOUNT` → tells you to configure the CrowRules application fee before one-time checkout.
- `PRICE_ID` → tells you to create/configure the recurring subscription Price.
- `STRIPE_WEBHOOK_SECRET` → tells you to configure the V2 thin-event endpoint secret.

## Connect platform setup

Before creators can connect:

1. Enable Stripe Connect for the CrowRules Stripe platform.
2. Make sure the platform is configured for the SaaS/direct-charge model.
3. The V2 account creation code intentionally uses:
   - `dashboard: "full"`
   - Stripe as fees collector
   - Stripe as losses collector
   - merchant configuration
   - requested `card_payments`
4. It never sends legacy top-level `type: "express"`, `type: "standard"`, or `type: "custom"`.

## User/account mapping

CrowRules already has `creator_monetization`.

The integration stores only the mapping:

```text
CrowRules authenticated user ID -> Stripe V2 account ID
```

Live onboarding state is read directly from Stripe rather than trusting the local status columns.

## V2 onboarding

The creator clicks **Onboard to collect payments**.

The server:

1. Authenticates the CrowRules user.
2. Creates a V2 connected account if none exists.
3. Saves the account ID in `creator_monetization`.
4. Creates a V2 Account Link.
5. Sends the browser to Stripe-hosted onboarding.
6. Returns the creator to `payouts.html`.
7. The status endpoint retrieves the account directly from Stripe and checks:
   - `configuration.merchant.capabilities.card_payments.status`
   - `requirements.summary.minimum_deadline.status`

## Products

The creator can create a product from `stripe-connect-demo.html`.

Product creation uses the connected-account request option:

```js
stripeClient.products.create(
  {
    name,
    description,
    default_price_data: {
      unit_amount: priceInCents,
      currency: "usd",
    },
  },
  { stripeAccount: accountId },
);
```

The public storefront also uses `stripeAccount` when listing products.

## One-time purchases

The storefront creates a hosted Checkout Session against the connected account.

CrowRules can collect an application fee:

```js
payment_intent_data: {
  application_fee_amount: fee,
}
```

The fee amount is intentionally configured through `APPLICATION_FEE_AMOUNT` rather than hard-coded.

## Subscriptions

The demo uses the connected account ID as the V2 customer account:

```js
stripeClient.checkout.sessions.create({
  customer_account: accountId,
  mode: "subscription",
  line_items: [{ price: PRICE_ID, quantity: 1 }],
  ...
});
```

Set `PRICE_ID` to a real recurring Stripe Price before testing this flow.

## Billing portal

The creator/customer can open the hosted Billing Portal with:

```js
stripeClient.billingPortal.sessions.create({
  customer_account: accountId,
  return_url: DASHBOARD_URL,
});
```

## V2 thin-event webhook

Supabase function:

```text
stripe-connect-v2-webhook
```

Configure a Stripe webhook/event destination for connected accounts using thin events.

Subscribe to the V2 account events required by the application, including:

```text
v2.account[requirements].updated
v2.account[configuration.merchant].capability_status_updated
v2.account[configuration.customer].capability_status_updated
```

The handler:

1. Reads the raw request body.
2. Verifies/parses the signed thin event with `stripeClient.parseThinEvent(...)`.
3. Retrieves the complete event with `stripeClient.v2.core.events.retrieve(thinEvent.id)`.
4. Dispatches separate handlers for requirements and merchant/customer capability changes.

### Local Stripe CLI

For local testing, use the Stripe CLI thin-event forwarding pattern:

```bash
stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[.recipient].capability_status_updated,v2.core.account[configuration.merchant].capability_status_updated,v2.core.account[configuration.customer].capability_status_updated' --forward-thin-to <YOUR_LOCAL_ENDPOINT>
```

Replace `<YOUR_LOCAL_ENDPOINT>` with your local webhook endpoint.

## Security notes

- Never expose `STRIPE_SECRET_KEY` in a GitHub Pages file.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser JavaScript.
- The existing `js/config.js` contains the browser-safe Supabase publishable key.
- The public storefront accepts a connected account ID in the URL for this demo only.
- For production, replace the URL account ID with a stable public creator/store slug and resolve that slug server-side.
- Never trust a browser-supplied connected account ID for creator-management operations. Creator management actions in the demo are authenticated and resolve the account from the CrowRules user mapping.

## Test order

1. Enable Connect.
2. Configure the Supabase secrets.
3. Sign in to CrowRules.
4. Open `payouts.html`.
5. Click **Connect with Stripe**.
6. Complete Stripe onboarding.
7. Refresh the payout page and confirm live status.
8. Open **Commerce Manager**.
9. Create a test product.
10. Open the storefront.
11. Buy the product with Stripe test payment details.
12. Configure a recurring Price and test subscription Checkout.
13. Configure the V2 thin-event webhook and test requirement/capability changes.

This is a sample integration foundation; production launch should add authorization rules, idempotency, webhook persistence/reconciliation, refunds/disputes, product ownership checks, rate limiting, and audit logging.
