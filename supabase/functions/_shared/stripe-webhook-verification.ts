// Stripe's official SDK verification helper for the shared webhook entrypoint.
// Call once on the exact raw request body before JSON parsing or any side effects.
import Stripe from "npm:stripe@17.7.0";

const cryptoProvider = Stripe.createSubtleCryptoProvider();

export function createStripeClient(secretKey: string): Stripe {
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function verifyStripeWebhookRequest(
  stripe: Stripe,
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
): Promise<Stripe.Event> {
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header");
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");

  // constructEventAsync uses Stripe's signature format and default 300-second
  // timestamp tolerance. Never parse/re-serialize the body before this call.
  return await stripe.webhooks.constructEventAsync(
    rawBody,
    signatureHeader,
    webhookSecret,
    undefined,
    cryptoProvider,
  );
}
