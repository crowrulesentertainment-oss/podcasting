// Candidate membership-only processor. Review-only until merged into the existing
// membership-stripe-webhook entrypoint without removing its podcast monetization path.

type AdminClient = any;
type StripeClient = any;

const membershipEventTypes = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

function mapStripeStatus(status: string): "active" | "pending" | "paused" | "cancelled" | "expired" {
  if (status === "canceled") return "cancelled";
  if (status === "active" || status === "trialing") return "active";
  if (["past_due", "incomplete", "incomplete_expired", "unpaid"].includes(status)) return "pending";
  if (status === "paused") return "paused";
  return "expired";
}

function asIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function throwIfError(error: unknown, operation: string): void {
  if (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(operation + ": " + detail);
  }
}

async function getSubscriptionId(event: any): Promise<string | null> {
  const object = event.data?.object;
  if (event.type.startsWith("customer.subscription.")) return object?.id ?? null;
  if (event.type === "checkout.session.completed") {
    return typeof object?.subscription === "string" ? object.subscription : object?.subscription?.id ?? null;
  }
  if (event.type.startsWith("invoice.")) {
    const direct = object?.subscription;
    if (typeof direct === "string") return direct;
    if (direct?.id) return direct.id;
    const nested = object?.parent?.subscription_details?.subscription;
    return typeof nested === "string" ? nested : nested?.id ?? null;
  }
  return null;
}

async function finishEvent(admin: AdminClient, eventId: string, status: "processed" | "failed", error?: unknown) {
  const { error: finishError } = await admin.rpc("finish_membership_stripe_event", {
    p_event_id: eventId,
    p_status: status,
    p_error: error instanceof Error ? error.message : error ? String(error) : null,
  });
  throwIfError(finishError, "finish_membership_stripe_event");
}

export async function processMembershipStripeEvent(
  admin: AdminClient,
  stripe: StripeClient,
  event: any,
): Promise<{ outcome: "ignored" | "duplicate" | "busy" | "processed" | "stale" }> {
  if (!membershipEventTypes.has(event?.type)) return { outcome: "ignored" };
  if (!event?.id || typeof event.created !== "number") throw new Error("Stripe event is missing its id or creation timestamp");

  const { data: claim, error: claimError } = await admin.rpc("claim_membership_stripe_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created: event.created,
  });
  throwIfError(claimError, "claim_membership_stripe_event");

  const claimStatus = typeof claim === "string" ? claim : claim?.status;
  if (claimStatus === "processed") return { outcome: "duplicate" };
  if (claimStatus === "busy") return { outcome: "busy" };
  if (claimStatus !== "claimed") throw new Error("Unexpected webhook claim result: " + String(claimStatus));

  try {
    const subscriptionId = await getSubscriptionId(event);
    if (!subscriptionId) {
      // Not every checkout session is a membership purchase. A session with no
      // subscription is safely acknowledged as unrelated to this processor.
      await finishEvent(admin, event.id, "processed");
      return { outcome: "ignored" };
    }

    const canonical = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = canonical.items?.data?.[0]?.price?.id ?? null;
    const checkoutMetadata = event.type === "checkout.session.completed" ? event.data.object.metadata ?? {} : {};
    const subscriptionMetadata = canonical.metadata ?? {};

    const { data: existing, error: existingError } = await admin
      .from("membership_subscriptions")
      .select("user_id,last_stripe_event_created")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    throwIfError(existingError, "read existing membership subscription");

    const userId = subscriptionMetadata.user_id
      ?? checkoutMetadata.user_id
      ?? event.data?.object?.client_reference_id
      ?? existing?.user_id
      ?? null;

    let planQuery = admin.from("membership_plans").select("id,plan_key,site_key,stripe_price_id");
    let planResult: any;
    if (priceId) {
      planResult = await planQuery.eq("stripe_price_id", priceId).maybeSingle();
    } else {
      const planKey = subscriptionMetadata.plan_key ?? checkoutMetadata.plan_key;
      if (!planKey) throw new Error("Membership subscription has no Stripe price or plan_key mapping");
      planResult = await planQuery.eq("plan_key", planKey).maybeSingle();
    }
    throwIfError(planResult?.error, "resolve membership plan");
    const plan = planResult?.data;
    if (!plan) throw new Error("No active membership plan maps to Stripe subscription " + subscriptionId);
    if (!userId) throw new Error("Membership subscription has no resolvable user_id");

    const previousEventCreated = Number(existing?.last_stripe_event_created ?? 0);
    if (previousEventCreated >= event.created) {
      await finishEvent(admin, event.id, "processed");
      return { outcome: "stale" };
    }

    const firstItem = canonical.items?.data?.[0];
    const periodStart = canonical.current_period_start ?? firstItem?.current_period_start ?? null;
    const periodEnd = canonical.current_period_end ?? firstItem?.current_period_end ?? null;

    const row = {
      user_id: userId,
      plan_id: plan.id,
      site_key: plan.site_key ?? null,
      status: mapStripeStatus(canonical.status),
      stripe_customer_id: typeof canonical.customer === "string" ? canonical.customer : canonical.customer?.id ?? null,
      stripe_subscription_id: canonical.id,
      started_at: asIsoTimestamp(canonical.start_date),
      current_period_start: asIsoTimestamp(periodStart),
      current_period_end: asIsoTimestamp(periodEnd),
      ends_at: asIsoTimestamp(canonical.ended_at),
      cancel_at_period_end: Boolean(canonical.cancel_at_period_end),
      last_stripe_event_created: event.created,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await admin
      .from("membership_subscriptions")
      .upsert(row, { onConflict: "stripe_subscription_id" });
    throwIfError(upsertError, "upsert membership subscription");

    if (plan.site_key == null) {
      const { error: syncError } = await admin.rpc("sync_member_membership_from_subscription", {
        p_user_id: userId,
      });
      throwIfError(syncError, "sync_member_membership_from_subscription");
    }

    await finishEvent(admin, event.id, "processed");
    return { outcome: "processed" };
  } catch (error) {
    try {
      await finishEvent(admin, event.id, "failed", error);
    } catch (finishError) {
      console.error("Unable to mark membership webhook event failed", finishError);
    }
    throw error;
  }
}
