# Stripe Billing Webhooks

CrowRules Podcasting now has a dedicated Stripe Billing webhook for keeping subscription and customer billing state synchronized with Supabase.

## Edge Function

`stripe-billing-webhook`

Endpoint:

`https://cevylpnoexugwgygvtgu.supabase.co/functions/v1/stripe-billing-webhook`

This endpoint is intentionally public at the HTTP layer because Stripe calls it directly. It verifies every request with the Stripe webhook signature before processing.

## Secret

Configure:

`STRIPE_BILLING_WEBHOOK_SECRET=whsec_...`

The function also accepts the existing `STRIPE_WEBHOOK_SECRET` as a fallback, but a separate billing endpoint secret is recommended.

## Events handled

### Subscriptions

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`

The sync records status, price/product, billing period, cancellation-at-period-end, cancellation/end timestamps, latest invoice, and default payment method.

### Invoices

- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`
- `invoice.finalized`
- `invoice.voided`
- `invoice.marked_uncollectible`

Invoice state is attached to the corresponding synced subscription when Stripe provides a subscription ID.

### Payment methods

- `payment_method.attached`
- `payment_method.detached`

The customer sync tracks the latest attached/default payment method reference.

### Customers

- `customer.created`
- `customer.updated`
- `customer.deleted`

Customer email, name, metadata, payment-method reference, and connected-account context are synchronized.

### Tax IDs

The webhook accepts:

- `customer.tax_id.created`
- `customer.tax_id.updated`
- `customer.tax_id.deleted`

The Stripe object remains the source of truth for the complete tax-ID record.

## Supabase tables

The migration adds:

- `stripe_billing_subscriptions`
- `stripe_billing_customers`
- `stripe_billing_webhook_events`

The event table provides webhook idempotency and processing status.

## Webhook flow

1. Stripe sends the signed event.
2. CrowRules verifies `Stripe-Signature`.
3. The event is recorded.
4. Subscription/customer/invoice/payment-method state is synchronized.
5. The event is marked `processed`.
6. Stripe retries remain safe because event IDs are unique.

Stripe remains the authoritative billing system; Supabase is the application synchronization layer.

## Stripe Dashboard setup

Create a Billing webhook/event destination for the endpoint above and subscribe to the billing events listed in this document.

Use the signing secret generated for that endpoint as:

`STRIPE_BILLING_WEBHOOK_SECRET`

Do not put that secret in GitHub Pages or browser JavaScript.

## Current status

The webhook infrastructure is deployed. Once the Stripe Billing endpoint is configured with its signing secret, subscription lifecycle events will flow into CrowRules automatically.

