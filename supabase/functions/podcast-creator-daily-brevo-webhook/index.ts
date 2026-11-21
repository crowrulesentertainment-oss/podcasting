import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const expectedSecret = Deno.env.get("BREVO_CREATOR_DAILY_WEBHOOK_SECRET") ?? "";
  const suppliedSecret = req.headers.get("x-crowrules-webhook-secret") ?? "";
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: "Webhook authentication failed." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Webhook processor is not configured." }, 503);

  const raw = await req.text();
  if (raw.length > 32_768) return json({ error: "Payload too large." }, 413);

  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return json({ error: "Expected a single Brevo event object." }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON payload." }, 400);
  }

  const event = String(payload.event ?? "").toLowerCase();
  if (event !== "unsubscribe" && event !== "unsubscribed") {
    return json({ ok: true, ignored: true, reason: "Not an unsubscribe event." });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "A valid recipient email is required." }, 400);
  }

  const eventSeconds = Number(payload.ts_event ?? payload.ts);
  const eventDate = Number.isFinite(eventSeconds) && eventSeconds > 0
    ? new Date(eventSeconds * 1000)
    : new Date(String(payload.date_event ?? ""));
  if (!Number.isFinite(eventDate.getTime())) return json({ error: "A valid event timestamp is required." }, 400);

  const stableEvent = [
    "brevo", "marketing", "unsubscribe", email,
    String(payload.ts_event ?? payload.ts ?? eventDate.toISOString()),
    String(payload.camp_id ?? ""), String(payload.id ?? ""),
  ].join("|");
  const [eventKey, emailHash] = await Promise.all([
    sha256(stableEvent),
    sha256(email),
  ]);

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("apply_creator_daily_brevo_unsubscribe", {
    p_event_key: eventKey,
    p_email: email,
    p_email_sha256: emailHash,
    p_event_at: eventDate.toISOString(),
  });

  if (error) {
    console.error("Brevo Creator Daily unsubscribe processing failed:", error.message);
    return json({ error: "Could not process the unsubscribe event." }, 500);
  }

  return json({ ok: true, provider: "Brevo", ...data });
});
