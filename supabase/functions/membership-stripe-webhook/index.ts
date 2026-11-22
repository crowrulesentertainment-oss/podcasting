import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  processMembershipStripeEvent,
} from "../_shared/membership-webhook-core.ts";
import {
  createStripeClient,
  verifyStripeWebhookRequest,
} from "../_shared/stripe-webhook-verification.ts";

const activePodcastStatuses = new Set(["trialing", "active", "past_due", "paused"]);
const iso = (value: unknown): string | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? new Date(value * 1000).toISOString()
    : null;

function throwIfError(error: unknown, operation: string): void {
  if (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(operation + ": " + detail);
  }
}

async function syncPodcastSubscription(admin: any, subscription: any): Promise<void> {
  const metadata = subscription.metadata ?? {};
  let productId = metadata.product_id ?? null;
  let podcastId = metadata.podcast_id ?? null;
  let creatorId = metadata.creator_id ?? null;
  let userId = metadata.user_id ?? null;
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;

  if (!productId && priceId) {
    const { data, error } = await admin.from("cr_podcast_monetization_products")
      .select("id,podcast_id,creator_id")
      .eq("stripe_price_id", priceId)
      .maybeSingle();
    throwIfError(error, "resolve podcast monetization product");
    productId = data?.id ?? null;
    podcastId = data?.podcast_id ?? null;
    creatorId = data?.creator_id ?? null;
  }

  if (!userId && subscription.customer) {
    const { data, error } = await admin.from("podcast_subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", String(subscription.customer))
      .limit(1);
    throwIfError(error, "resolve podcast subscriber");
    userId = data?.[0]?.user_id ?? null;
  }

  if (!productId || !podcastId || !userId) {
    console.error("Podcast subscription missing linkage", subscription.id);
    throw new Error("Podcast subscription is missing required linkage");
  }

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
  const row = {
    user_id: userId,
    podcast_id: podcastId,
    product_id: productId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    started_at: iso(subscription.start_date),
    current_period_start: iso(subscription.current_period_start),
    current_period_end: iso(subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    canceled_at: iso(subscription.canceled_at),
    updated_at: new Date().toISOString(),
  };
  const { error: subscriptionError } = await admin.from("podcast_subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  throwIfError(subscriptionError, "upsert podcast subscription");

  const entitlement = {
    creator_id: creatorId,
    member_user_id: userId,
    product_id: productId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    status: activePodcastStatuses.has(subscription.status) ? "active" : "inactive",
    starts_at: iso(subscription.start_date),
    ends_at: iso(subscription.current_period_end),
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: lookupError } = await admin.from("cr_podcast_entitlements")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  throwIfError(lookupError, "read podcast entitlement");

  if (existing) {
    const { error } = await admin.from("cr_podcast_entitlements")
      .update(entitlement).eq("id", existing.id);
    throwIfError(error, "update podcast entitlement");
  } else {
    const { error } = await admin.from("cr_podcast_entitlements").insert(entitlement);
    throwIfError(error, "insert podcast entitlement");
  }
}

async function handlePodcastEvent(admin: any, event: any): Promise<void> {
  const object = event.data?.object;

  if (event.type === "checkout.session.completed" &&
    object?.metadata?.podcast_id && object?.metadata?.product_id && object.subscription) {
    await syncPodcastSubscription(admin, {
      id: typeof object.subscription === "string" ? object.subscription : object.subscription.id,
      customer: object.customer,
      status: "active",
      metadata: object.subscription_data?.metadata ?? object.metadata,
      items: { data: [{ price: { id: object.metadata.price_id ?? null } }] },
      start_date: event.created,
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
    });
    return;
  }

  if (["customer.subscription.created", "customer.subscription.updated",
    "customer.subscription.deleted"].includes(event.type)) {
    const { data: existing, error } = await admin.from("podcast_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", object.id)
      .maybeSingle();
    throwIfError(error, "lookup podcast subscription");
    if (existing || object.metadata?.podcast_id || object.metadata?.product_id) {
      await syncPodcastSubscription(admin, object);
    }
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = object;
    const rawSubscription = invoice.subscription ??
      invoice.parent?.subscription_details?.subscription ?? null;
    const subscriptionId = typeof rawSubscription === "string"
      ? rawSubscription
      : rawSubscription?.id ?? null;
    if (!subscriptionId) return;

    const { data: podcastSubscription, error: lookupError } = await admin
      .from("podcast_subscriptions")
      .select("id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    throwIfError(lookupError, "lookup podcast invoice subscription");

    if (podcastSubscription) {
      const { error: updateError } = await admin.from("podcast_subscriptions")
        .update({
          status: event.type === "invoice.paid" ? "active" : "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId);
      throwIfError(updateError, "update podcast subscription from invoice");

      const { data: entitlement, error: entitlementLookupError } = await admin
        .from("cr_podcast_entitlements")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      throwIfError(entitlementLookupError, "lookup podcast entitlement from invoice");
      if (entitlement) {
        const { error: entitlementUpdateError } = await admin
          .from("cr_podcast_entitlements")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", entitlement.id);
        throwIfError(entitlementUpdateError, "update podcast entitlement from invoice");
      }
    }
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!webhookSecret || !stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
      console.error("Webhook environment is missing a required secret or URL");
      return new Response("Webhook is not configured", { status: 500 });
    }

    // Verify the exact raw body once, before parsing or performing side effects.
    const rawBody = await request.text();
    const stripe = createStripeClient(stripeSecretKey);
    const event = await verifyStripeWebhookRequest(
      stripe,
      rawBody,
      request.headers.get("Stripe-Signature"),
      webhookSecret,
    );

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Membership processing is idempotent and runs first. A busy claim returns
    // 503 so Stripe retries before podcast side effects are attempted.
    const membership = await processMembershipStripeEvent(admin, stripe, event);
    if (membership.outcome === "busy") {
      return new Response("Membership webhook event is already processing", { status: 503 });
    }

    // Preserve the podcast monetization path in this shared deployed endpoint.
    await handlePodcastEvent(admin, event);

    return new Response(JSON.stringify({
      received: true,
      type: event.type,
      membership_outcome: membership.outcome,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    const isSignatureError = error instanceof Error &&
      /signature|timestamp|no signatures found/i.test(error.message);
    return new Response(
      isSignatureError ? "Invalid Stripe signature" : "Webhook processing failed",
      { status: isSignatureError ? 400 : 500 },
    );
  }
});
