import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// Contract harness only. These helpers model the required behavior from
// docs/MEMBERSHIP-STRIPE-WEBHOOK-RELIABILITY-PATCH-PROPOSAL.md.
// They are deliberately isolated from production code and make no network,
// Stripe, Supabase, or database calls.

const TOLERANCE_SECONDS = 300;
const signatureFor = (payload, secret, timestamp) =>
  createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

function verifyStripeSignature(payload, header, secret, nowSeconds, tolerance = TOLERANCE_SECONDS) {
  if (!payload || !header || !secret) return false;
  const parts = header.split(",");
  const timestamp = Number(parts.find((p) => p.startsWith("t="))?.slice(2));
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;
  const expected = signatureFor(payload, secret, timestamp);
  return signatures.some((candidate) =>
    candidate.length === expected.length &&
    Buffer.from(candidate, "hex").length === Buffer.from(expected, "hex").length &&
    Buffer.from(candidate, "hex").equals(Buffer.from(expected, "hex"))
  );
}

class EventLedger {
  #events = new Map();

  async claim(eventId) {
    // Synchronous Map insertion is atomic within this JS event loop.
    const existing = this.#events.get(eventId);
    if (existing?.status === "processed") return { owner: false, duplicate: true };
    if (existing?.status === "processing") return { owner: false, duplicate: false, busy: true };
    this.#events.set(eventId, { status: "processing", attempts: (existing?.attempts ?? 0) + 1 });
    return { owner: true, duplicate: false };
  }

  async finish(eventId, status) {
    const row = this.#events.get(eventId);
    if (!row || row.status !== "processing") throw new Error("event not claimed");
    this.#events.set(eventId, { ...row, status });
  }

  get(eventId) { return this.#events.get(eventId); }
}

function chooseGlobalSubscription(subscriptions) {
  return subscriptions
    .filter((s) => s.site_key == null)
    .sort((a, b) => {
      const rank = (s) => ["active", "pending"].includes(s.status) ? 0 : 1;
      return rank(a) - rank(b) || b.created_at - a.created_at;
    })[0] ?? null;
}

function applyIfNewer(current, incoming) {
  if (!current) return incoming;
  if (incoming.stripe_created_at < current.stripe_created_at) return current;
  if (incoming.stripe_created_at === current.stripe_created_at) {
    throw new Error("equal timestamp requires canonical refetch and per-subscription serialization");
  }
  return incoming;
}

async function processWithCheckedWrites(operations) {
  for (const operation of operations) {
    const result = await operation();
    if (result?.error) throw new Error("database operation failed");
  }
  return { status: 200 };
}

test("valid current Stripe signature is accepted", () => {
  const payload = '{"id":"evt_1"}', secret = "whsec_test", now = 1_800_000_000;
  const header = `t=${now},v1=${signatureFor(payload, secret, now)}`;
  assert.equal(verifyStripeSignature(payload, header, secret, now), true);
});

test("missing signature is rejected", () => {
  assert.equal(verifyStripeSignature("{}", "", "whsec_test", 1_800_000_000), false);
});

test("missing secret is rejected", () => {
  assert.equal(verifyStripeSignature("{}", "t=1,v1=abc", "", 1), false);
});

test("tampered payload is rejected", () => {
  const secret = "whsec_test", now = 1_800_000_000, payload = '{"id":"evt_1"}';
  const header = `t=${now},v1=${signatureFor(payload, secret, now)}`;
  assert.equal(verifyStripeSignature('{"id":"evt_tampered"}', header, secret, now), false);
});

test("expired signature outside the 300-second tolerance is rejected", () => {
  const secret = "whsec_test", timestamp = 1_800_000_000, payload = "{}";
  const header = `t=${timestamp},v1=${signatureFor(payload, secret, timestamp)}`;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp + 301), false);
});

test("signature at the tolerance boundary is accepted", () => {
  const secret = "whsec_test", timestamp = 1_800_000_000, payload = "{}";
  const header = `t=${timestamp},v1=${signatureFor(payload, secret, timestamp)}`;
  assert.equal(verifyStripeSignature(payload, header, secret, timestamp + 300), true);
});

test("malformed timestamp and absent v1 signature are rejected", () => {
  assert.equal(verifyStripeSignature("{}", "t=not-a-number,v1=abc", "s", 10), false);
  assert.equal(verifyStripeSignature("{}", "t=10", "s", 10), false);
});

test("duplicate processed event is not claimed a second time", async () => {
  const ledger = new EventLedger();
  assert.equal((await ledger.claim("evt_dup")).owner, true);
  await ledger.finish("evt_dup", "processed");
  assert.deepEqual(await ledger.claim("evt_dup"), { owner: false, duplicate: true });
});

test("concurrent duplicate delivery has exactly one processing owner", async () => {
  const ledger = new EventLedger();
  const claims = await Promise.all(Array.from({ length: 20 }, () => ledger.claim("evt_race")));
  assert.equal(claims.filter((c) => c.owner).length, 1);
  assert.equal(claims.filter((c) => c.busy).length, 19);
});

test("failed event can be reclaimed for retry", async () => {
  const ledger = new EventLedger();
  await ledger.claim("evt_retry");
  await ledger.finish("evt_retry", "failed");
  const retry = await ledger.claim("evt_retry");
  assert.equal(retry.owner, true);
  assert.equal(ledger.get("evt_retry").attempts, 2);
});

test("unclaimed event cannot be marked processed", async () => {
  const ledger = new EventLedger();
  await assert.rejects(() => ledger.finish("evt_unknown", "processed"), /not claimed/);
});

test("older Stripe event cannot overwrite newer state", () => {
  const current = { status: "active", stripe_created_at: 500 };
  const older = { status: "canceled", stripe_created_at: 400 };
  assert.equal(applyIfNewer(current, older), current);
});

test("newer Stripe event advances stored state", () => {
  const current = { status: "active", stripe_created_at: 500 };
  const newer = { status: "canceled", stripe_created_at: 501 };
  assert.equal(applyIfNewer(current, newer), newer);
});

test("equal timestamps require canonical reconciliation instead of arbitrary event-ID ordering", () => {
  assert.throws(() => applyIfNewer(
    { status: "active", stripe_created_at: 500, id: "evt_a" },
    { status: "canceled", stripe_created_at: 500, id: "evt_z" }
  ), /canonical refetch/);
});

test("global subscription selector ignores newer site-scoped subscription", () => {
  const selected = chooseGlobalSubscription([
    { id: "global", site_key: null, status: "active", created_at: 100 },
    { id: "site", site_key: "crowrules-plus", status: "active", created_at: 999 }
  ]);
  assert.equal(selected.id, "global");
});

test("site-only subscriptions never create a global membership", () => {
  assert.equal(chooseGlobalSubscription([
    { id: "site", site_key: "crowrules-plus", status: "active", created_at: 999 }
  ]), null);
});

test("among global subscriptions, active/pending priority is preserved", () => {
  const selected = chooseGlobalSubscription([
    { id: "old-active", site_key: null, status: "active", created_at: 10 },
    { id: "new-canceled", site_key: null, status: "cancelled", created_at: 999 },
    { id: "new-pending", site_key: null, status: "pending", created_at: 20 }
  ]);
  assert.equal(selected.id, "new-pending");
});

test("a site subscription cancellation cannot downgrade the global plan", () => {
  const global = { id: "global", site_key: null, status: "active", created_at: 10 };
  const siteCanceled = { id: "site", site_key: "crowrules-plus", status: "cancelled", created_at: 1000 };
  assert.equal(chooseGlobalSubscription([global, siteCanceled]), global);
});

test("database write errors stop processing and propagate a retryable failure", async () => {
  let acknowledged = false;
  await assert.rejects(() => processWithCheckedWrites([
    async () => ({ data: "subscription saved" }),
    async () => ({ error: new Error("simulated RPC failure") }),
    async () => { acknowledged = true; return {}; }
  ]), /database operation failed/);
  assert.equal(acknowledged, false);
});

test("successful required writes complete and can then be acknowledged", async () => {
  const order = [];
  const response = await processWithCheckedWrites([
    async () => { order.push("subscription"); return {}; },
    async () => { order.push("member-sync"); return {}; },
    async () => { order.push("event-processed"); return {}; }
  ]);
  assert.deepEqual(order, ["subscription", "member-sync", "event-processed"]);
  assert.equal(response.status, 200);
});

test("unmapped Stripe price is treated as a processing failure, not silent success", async () => {
  const resolvePlan = async () => null;
  const plan = await resolvePlan();
  assert.equal(plan, null);
  await assert.rejects(async () => {
    if (!plan) throw new Error("unmapped price requires retry/operations review");
  }, /unmapped price/);
});
