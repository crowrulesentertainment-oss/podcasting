import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { processMembershipStripeEvent } from "../functions/_shared/membership-webhook-core.ts";

function makeHarness(options: Record<string, unknown> = {}) {
  const calls: any[] = [];
  const claim = (options.claim as string) ?? "claimed";
  const existing = (options.existing as any) ?? null;
  const plan = (options.plan as any) ?? { id: "plan-creator", plan_key: "creator", site_key: null, stripe_price_id: "price_creator" };
  const subscription = (options.subscription as any) ?? {
    id: "sub_123",
    status: "active",
    metadata: { user_id: "user_123", plan_key: "creator" },
    customer: "cus_123",
    start_date: 1_790_000_000,
    current_period_start: 1_790_000_000,
    current_period_end: 1_792_592_000,
    ended_at: null,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_creator" } }] },
  };
  const admin = {
    rpc: async (name: string, args: any) => {
      calls.push({ kind: "rpc", name, args });
      if (name === "claim_membership_stripe_event") return { data: claim, error: null };
      if (name === "finish_membership_stripe_event") {
        if (options.finishError) return { data: null, error: new Error("finish failed") };
        return { data: null, error: null };
      }
      if (name === "sync_member_membership_from_subscription") {
        if (options.syncError) return { data: null, error: new Error("sync failed") };
        return { data: null, error: null };
      }
      throw new Error("unexpected RPC " + name);
    },
    from: (table: string) => {
      const state: any = { filters: [] };
      const builder: any = {
        select(columns: string) { state.select = columns; return builder; },
        eq(column: string, value: unknown) { state.filters.push([column, value]); return builder; },
        maybeSingle: async () => {
          calls.push({ kind: "read", table, state });
          if (table === "membership_subscriptions") return { data: existing, error: null };
          if (table === "membership_plans") return { data: options.noPlan ? null : plan, error: null };
          throw new Error("unexpected read table " + table);
        },
        upsert: async (row: any, config: any) => {
          calls.push({ kind: "upsert", table, row, config });
          if (options.upsertError) return { data: null, error: new Error("write failed") };
          return { data: row, error: null };
        },
      };
      return builder;
    },
  };
  const stripe = {
    subscriptions: {
      retrieve: async (id: string) => {
        calls.push({ kind: "stripe.retrieve", id });
        return subscription;
      },
    },
  };
  const event = {
    id: "evt_123",
    type: "customer.subscription.updated",
    created: 1_800_000_100,
    data: { object: { id: "sub_123" } },
  };
  return { admin, stripe, event, calls };
}

Deno.test("global membership writes are checked and followed by global sync", async () => {
  const h = makeHarness();
  const result = await processMembershipStripeEvent(h.admin, h.stripe, h.event);
  assertEquals(result.outcome, "processed");
  const write = h.calls.find((c) => c.kind === "upsert");
  assertEquals(write.table, "membership_subscriptions");
  assertEquals(write.row.user_id, "user_123");
  assertEquals(write.row.last_stripe_event_created, h.event.created);
  assertEquals(h.calls.some((c) => c.name === "sync_member_membership_from_subscription"), true);
  assertEquals(h.calls.some((c) => c.name === "finish_membership_stripe_event" && c.args.p_status === "processed"), true);
});

Deno.test("site-scoped plan never synchronizes global member membership", async () => {
  const h = makeHarness({ plan: { id: "site-plan", plan_key: "founder", site_key: "crowrules-plus", stripe_price_id: "price_creator" } });
  const result = await processMembershipStripeEvent(h.admin, h.stripe, h.event);
  assertEquals(result.outcome, "processed");
  assertEquals(h.calls.some((c) => c.name === "sync_member_membership_from_subscription"), false);
});

Deno.test("processed duplicate and in-flight duplicate are not applied twice", async () => {
  const processed = makeHarness({ claim: "processed" });
  assertEquals((await processMembershipStripeEvent(processed.admin, processed.stripe, processed.event)).outcome, "duplicate");
  assertEquals(processed.calls.some((c) => c.kind === "upsert"), false);
  const busy = makeHarness({ claim: "busy" });
  assertEquals((await processMembershipStripeEvent(busy.admin, busy.stripe, busy.event)).outcome, "busy");
  assertEquals(busy.calls.some((c) => c.kind === "upsert"), false);
});

Deno.test("older or equal Stripe event timestamp is stale", async () => {
  const h = makeHarness({ existing: { user_id: "user_123", last_stripe_event_created: 1_800_000_100 } });
  const result = await processMembershipStripeEvent(h.admin, h.stripe, h.event);
  assertEquals(result.outcome, "stale");
  assertEquals(h.calls.some((c) => c.kind === "upsert"), false);
});

Deno.test("subscription write failure marks the event failed and propagates", async () => {
  const h = makeHarness({ upsertError: true });
  await assertRejects(() => processMembershipStripeEvent(h.admin, h.stripe, h.event), Error, "upsert membership subscription");
  assertEquals(h.calls.some((c) => c.name === "finish_membership_stripe_event" && c.args.p_status === "failed"), true);
});

Deno.test("membership sync failure is not acknowledged as processed", async () => {
  const h = makeHarness({ syncError: true });
  await assertRejects(() => processMembershipStripeEvent(h.admin, h.stripe, h.event), Error, "sync_member_membership_from_subscription");
  assertEquals(h.calls.some((c) => c.name === "finish_membership_stripe_event" && c.args.p_status === "failed"), true);
});

Deno.test("unmapped Stripe price fails closed", async () => {
  const h = makeHarness({ noPlan: true });
  await assertRejects(() => processMembershipStripeEvent(h.admin, h.stripe, h.event), Error, "No active membership plan maps");
});

Deno.test("unrelated podcast subscription events are ignored without failing webhook delivery", async () => {
  const h = makeHarness({
    noPlan: true,
    subscription: {
      id: "sub_podcast",
      status: "active",
      metadata: { user_id: "user_123", podcast_id: "podcast_123", product_id: "product_123" },
      customer: "cus_123",
      items: { data: [{ price: { id: "price_podcast" } }] },
    },
  });
  const result = await processMembershipStripeEvent(h.admin, h.stripe, h.event);
  assertEquals(result.outcome, "ignored");
  assertEquals(h.calls.some((c) => c.kind === "upsert"), false);
});
