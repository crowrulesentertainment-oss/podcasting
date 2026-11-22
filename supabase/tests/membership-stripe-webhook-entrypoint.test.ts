import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  createWebhookHandler,
  handlePodcastEvent,
} from "../functions/membership-stripe-webhook/index.ts";

const env: Record<string, string> = {
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_SECRET_KEY: "sk_test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
};

function handlerHarness(options: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const event = { id: "evt_test", type: "customer.subscription.updated", created: 1_800_000_000, data: { object: { id: "sub_test" } } };
  const handler = createWebhookHandler({
    getEnv: (name) => options.missingEnv === name ? undefined : env[name],
    createStripe: (secret) => { calls.push("stripe:" + secret); return { marker: "stripe" }; },
    verify: async (_stripe, raw, signature, secret) => {
      calls.push("verify:" + raw + ":" + signature + ":" + secret);
      if (options.signatureError) throw new Error(String(options.signatureError));
      return event;
    },
    createAdmin: (url, key) => { calls.push("admin:" + url + ":" + key); return { marker: "admin" }; },
    processMembership: async () => { calls.push("membership"); if (options.membershipError) throw new Error("membership db failure"); return { outcome: String(options.outcome ?? "processed") }; },
    processPodcast: async (_admin, received, _stripe) => { calls.push("podcast:" + received.type); if (options.podcastError) throw new Error("podcast db failure"); },
  });
  return { handler, calls, event };
}

Deno.test("handler verifies exact raw body once before membership and podcast processing", async () => {
  const h = handlerHarness();
  const raw = '{"id":"evt_test","livemode":false}';
  const response = await h.handler(new Request("https://example.test/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": "t=123,v1=abc" },
    body: raw,
  }));
  assertEquals(response.status, 200);
  assertEquals(h.calls.filter((c) => c.startsWith("verify:")).length, 1);
  assertEquals(h.calls[1], "verify:" + raw + ":t=123,v1=abc:whsec_test");
  assertEquals(h.calls.slice(-2), ["membership", "podcast:customer.subscription.updated"]);
});

Deno.test("invalid or expired signature is rejected before any side effect", async () => {
  for (const signatureError of ["signature mismatch", "timestamp outside tolerance"]) {
    const h = handlerHarness({ signatureError });
    const response = await h.handler(new Request("https://example.test/webhook", { method: "POST", body: "{}" }));
    assertEquals(response.status, 400);
    assertEquals(h.calls.some((c) => c === "membership" || c.startsWith("podcast:")), false);
  }
});

Deno.test("busy membership event returns retryable 503 and skips podcast side effects", async () => {
  const h = handlerHarness({ outcome: "busy" });
  const response = await h.handler(new Request("https://example.test/webhook", { method: "POST", body: "{}" }));
  assertEquals(response.status, 503);
  assertEquals(h.calls.includes("podcast:customer.subscription.updated"), false);
});

Deno.test("database failures return retryable 500", async () => {
  const membership = handlerHarness({ membershipError: true });
  assertEquals((await membership.handler(new Request("https://example.test/webhook", { method: "POST", body: "{}" }))).status, 500);
  const podcast = handlerHarness({ podcastError: true });
  assertEquals((await podcast.handler(new Request("https://example.test/webhook", { method: "POST", body: "{}" }))).status, 500);
});

Deno.test("non-POST requests are rejected and missing configuration is not processed", async () => {
  const h = handlerHarness();
  assertEquals((await h.handler(new Request("https://example.test/webhook", { method: "GET" }))).status, 405);
  const missing = handlerHarness({ missingEnv: "STRIPE_WEBHOOK_SECRET" });
  assertEquals((await missing.handler(new Request("https://example.test/webhook", { method: "POST", body: "{}" }))).status, 500);
  assertEquals(missing.calls.length, 0);
});

function fakeAdmin(options: Record<string, unknown> = {}) {
  const calls: any[] = [];
  const admin = {
    from(table: string) {
      const state: any = { table, filters: [] };
      const result = () => ({ data: options.existingEntitlement ? { id: "ent_1" } : null, error: options.dbError ? new Error("db failed") : null });
      const builder: any = {
        select(columns: string) { state.select = columns; return builder; },
        eq(column: string, value: unknown) { state.filters.push([column, value]); return builder; },
        maybeSingle: async () => { calls.push({ op: "maybeSingle", ...state }); return result(); },
        limit: async () => { calls.push({ op: "limit", ...state }); return { data: [{ user_id: "user_1" }], error: null }; },
        upsert: async (row: any, config: any) => { calls.push({ op: "upsert", ...state, row, config }); return { error: options.dbError ? new Error("db failed") : null }; },
        insert: async (row: any) => { calls.push({ op: "insert", ...state, row }); return { error: options.dbError ? new Error("db failed") : null }; },
        update(row: any) {
          state.row = row;
          const operation: any = { eq: async (column: string, value: unknown) => { calls.push({ op: "update", ...state, filter: [column, value] }); return { error: options.dbError ? new Error("db failed") : null }; } };
          return operation;
        },
      };
      return builder;
    },
  };
  return { admin, calls };
}

Deno.test("podcast subscription lifecycle upserts subscription and grants active entitlement", async () => {
  const h = fakeAdmin();
  const stripe = { subscriptions: { retrieve: async (id: string) => {
    assertEquals(id, "sub_podcast");
    return {
      id, status: "active", metadata: { user_id: "user_1", podcast_id: "pod_1", product_id: "prod_1", creator_id: "creator_1" },
      customer: "cus_1", start_date: 1_800_000_000, current_period_start: 1_800_000_000,
      current_period_end: 1_802_592_000, cancel_at_period_end: false, canceled_at: null,
      items: { data: [{ price: { id: "price_1" } }] },
    };
  } } };
  await handlePodcastEvent(h.admin, {
    type: "checkout.session.completed", created: 1_800_000_000,
    data: { object: { metadata: { podcast_id: "pod_1", product_id: "prod_1" }, subscription: "sub_podcast", customer: "cus_1" } },
  }, stripe);
  assertEquals(h.calls.some((c) => c.op === "upsert" && c.table === "podcast_subscriptions" && c.row.stripe_subscription_id === "sub_podcast"), true);
  assertEquals(h.calls.some((c) => c.op === "insert" && c.table === "cr_podcast_entitlements" && c.row.status === "active"), true);
});

Deno.test("podcast subscription update refreshes existing entitlement", async () => {
  const h = fakeAdmin({ existingEntitlement: true });
  const stripe = { subscriptions: { retrieve: async () => { throw new Error("should not retrieve for subscription lifecycle event"); } } };
  await handlePodcastEvent(h.admin, {
    type: "customer.subscription.updated",
    data: { object: {
      id: "sub_podcast", status: "past_due",
      metadata: { user_id: "user_1", podcast_id: "pod_1", product_id: "prod_1", creator_id: "creator_1" },
      customer: "cus_1", start_date: 1_800_000_000, current_period_start: 1_800_000_000,
      current_period_end: 1_802_592_000, cancel_at_period_end: true, canceled_at: null,
      items: { data: [{ price: { id: "price_1" } }] },
    } },
  }, stripe);
  assertEquals(h.calls.some((c) => c.op === "upsert" && c.table === "podcast_subscriptions"), true);
  assertEquals(h.calls.some((c) => c.op === "update" && c.table === "cr_podcast_entitlements" && c.row.status === "active"), true);
});

Deno.test("podcast invoice paid and failed events update subscription state", async () => {
  for (const [type, expected] of [["invoice.paid", "active"], ["invoice.payment_failed", "past_due"]]) {
    const h = fakeAdmin({ existingEntitlement: true });
    await handlePodcastEvent(h.admin, {
      type, data: { object: { subscription: "sub_podcast" } },
    }, {});
    assertEquals(h.calls.some((c) => c.op === "update" && c.table === "podcast_subscriptions" && c.row.status === expected), true);
  }
});

Deno.test("podcast persistence errors propagate so Stripe receives a retryable failure", async () => {
  const h = fakeAdmin({ dbError: true });
  const stripe = { subscriptions: { retrieve: async () => ({
    id: "sub_podcast", status: "active",
    metadata: { user_id: "user_1", podcast_id: "pod_1", product_id: "prod_1" },
    customer: "cus_1", items: { data: [{ price: { id: "price_1" } }] },
  }) } };
  await assertRejects(() => handlePodcastEvent(h.admin, {
    type: "checkout.session.completed",
    data: { object: { metadata: { podcast_id: "pod_1", product_id: "prod_1" }, subscription: "sub_podcast" } },
  }, stripe), Error, "upsert podcast subscription");
});
