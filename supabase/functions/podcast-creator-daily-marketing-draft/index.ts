import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://crowrulesentertainment-oss.github.io";
const headers = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

const clean = (value: unknown, max = 240) =>
  String(value ?? "").replace(/[\r\n]/g, " ").trim().slice(0, max);

async function brevoRequest(apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch("https://api.brevo.com/v3" + path, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
      ...(init.headers ?? {}),
    },
  });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { /* keep provider response opaque */ }
  if (!response.ok) {
    throw new Error("Brevo returned HTTP " + response.status + ": " +
      clean(data?.message || data?.code || "Campaign request rejected"));
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Supabase is not configured." }, 503);
  if (!brevoKey) return json({ error: "BREVO_API_KEY is not configured." }, 503);

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Sign-in required." }, 401);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
  if (authError || !authData?.user) return json({ error: "Your session is invalid or expired." }, 401);

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: admin, error: adminError } = await db.from("cr_admins")
    .select("user_id").eq("user_id", authData.user.id).eq("is_active", true).maybeSingle();
  if (adminError || !admin) return json({ error: "Active CrowRules administrator access is required." }, 403);

  let input: any = {};
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (input.action !== "create_test_draft" || input.confirm !== true) {
    return json({
      error: "This endpoint only creates a recipient-free Brevo test draft. Set action=create_test_draft and confirm=true.",
    }, 400);
  }

  // Fixed synthetic content only. No creator data, contacts, recipients, or lists are loaded.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = "CrowRules Creator Daily — API draft test — " + stamp;
  const subject = "CrowRules Creator Daily — marketing campaign draft test";
  const htmlContent = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#101014;color:#f5f5f5;font-family:Arial,sans-serif">
  <main style="max-width:640px;margin:0 auto;padding:32px">
    <h1 style="color:#d8b45a">CrowRules Creator Daily</h1>
    <p>This is a synthetic campaign-draft validation.</p>
    <p>No creator information is included. This draft has no recipient list and is not scheduled or sent.</p>
    <p>Brevo's default campaign footer and unsubscribe page are intentionally left enabled.</p>
  </main>
</body></html>`;

  try {
    // Brevo creates email campaigns in draft status by default. Recipients and
    // scheduling are deliberately omitted. Never add sendNow or scheduledAt here.
    const created = await brevoRequest(brevoKey, "/emailCampaigns", {
      method: "POST",
      body: JSON.stringify({
        name,
        subject,
        sender: { name: "CrowRules Entertainment", email: "crowrulesentertainment@gmail.com" },
        replyTo: "crowrulesentertainment@gmail.com",
        htmlContent,
        tag: "crowrules-creator-daily-draft-test",
        previewText: "A recipient-free draft validation; no email will be sent.",
        mirrorActive: true,
      }),
    });
    const campaignId = Number(created?.id);
    if (!Number.isSafeInteger(campaignId) || campaignId <= 0) {
      return json({ error: "Brevo did not return a valid campaign ID. Check the Brevo draft list before retrying." }, 502);
    }

    const verified = await brevoRequest(brevoKey, "/emailCampaigns/" + campaignId, {
      method: "GET",
    });
    const status = String(verified?.status ?? "").toLowerCase();
    const hasRecipients = Array.isArray(verified?.recipients?.lists) &&
      verified.recipients.lists.length > 0;
    const scheduledAt = clean(verified?.scheduledAt, 80);

    if (status !== "draft" || hasRecipients || scheduledAt) {
      return json({
        ok: false,
        campaign_id: campaignId,
        status,
        recipient_lists_present: hasRecipients,
        scheduled_at_present: !!scheduledAt,
        error: "Draft verification failed. Do not send or schedule this campaign; inspect it in Brevo.",
      }, 502);
    }

    return json({
      ok: true,
      provider: "Brevo",
      campaign_id: campaignId,
      status: "draft",
      recipient_lists_present: false,
      scheduled_at_present: false,
      creator_data_included: false,
      email_delivered: false,
      production_dispatch_enabled: false,
      unsubscribe_footer: "Brevo default footer retained; rendered footer and RFC 8058 headers require a controlled recipient test before launch.",
      message: "Brevo created and verified a recipient-free draft. No email was sent.",
    });
  } catch (error) {
    console.error("Creator Daily marketing draft validation failed:", error);
    return json({ error: clean(error instanceof Error ? error.message : "Brevo draft validation failed.", 400) }, 502);
  }
});
