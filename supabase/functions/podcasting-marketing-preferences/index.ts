import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://crowrulesentertainment-oss.github.io";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store"
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const hash = async (value: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
};
const page = (title: string, message: string) => new Response(
  "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + title + "</title><body style=\"margin:0;background:#090a0d;color:#f4f4f5;font:16px Arial,sans-serif;display:grid;min-height:100vh;place-items:center\"><main style=\"max-width:560px;padding:36px;background:#17191f;border:1px solid #343741;border-radius:16px\"><p style=\"color:#d8b45a;letter-spacing:2px;font-weight:bold\">CROWRULES PODCASTING</p><h1>" + title + "</h1><p>" + message + "</p><a style=\"color:#e7c46d\" href=\"https://crowrulesentertainment-oss.github.io/podcasting/\">Return to CrowRules Podcasting</a></main></body></html>",
  { status: 200, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } }
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const requestOrigin = req.headers.get("origin");
  const sameFunctionOrigin = new URL(req.url).origin;
  if (requestOrigin && requestOrigin !== ORIGIN && requestOrigin !== sameFunctionOrigin) return json({ error: "Origin not allowed." }, 403);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Marketing preferences are not configured." }, 503);
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (req.method === "GET") {
    const raw = new URL(req.url).searchParams.get("token") || "";
    if (!/^[a-f0-9]{64}$/i.test(raw)) return page("Link not recognized", "This unsubscribe link is invalid or incomplete.");
    const tokenHash = await hash(raw);
    const { data: token, error } = await db.from("podcast_marketing_unsubscribe_tokens").select("created_at,used_at").eq("token_hash", tokenHash).maybeSingle();
    if (error || !token || token.used_at || Date.now() - new Date(token.created_at).getTime() > 30 * 86400000) return page("Link not recognized", "This unsubscribe link is invalid, already used, or expired.");
    return new Response(
      "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Confirm unsubscribe</title><body style=\"margin:0;background:#090a0d;color:#f4f4f5;font:16px Arial,sans-serif;display:grid;min-height:100vh;place-items:center\"><main style=\"max-width:560px;padding:36px;background:#17191f;border:1px solid #343741;border-radius:16px\"><p style=\"color:#d8b45a;letter-spacing:2px;font-weight:bold\">CROWRULES PODCASTING</p><h1>Confirm unsubscribe</h1><p>Click below to stop promotional emails. Opening this link alone will not change your preferences. Essential account and service notices are separate.</p><form method=\"post\"><input type=\"hidden\" name=\"action\" value=\"unsubscribe_token\"><input type=\"hidden\" name=\"token\" value=\"" + raw + "\"><button style=\"background:#c8202f;color:white;border:0;border-radius:8px;padding:13px 18px;font-weight:bold;cursor:pointer\" type=\"submit\">Unsubscribe from promotional emails</button></form></main></body></html>",
      { status: 200, headers: { ...cors, "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      let form: FormData | URLSearchParams;
      if (contentType.includes("multipart/form-data")) {
        form = await req.formData();
      } else {
        form = new URLSearchParams(await req.text());
      }
      const oneClick = form.get("List-Unsubscribe") === "One-Click";
      const manualConfirm = form.get("action") === "unsubscribe_token";
      if (!oneClick && !manualConfirm) return page("Request not recognized", "This request could not be processed.");

      // RFC 8058 one-click requests carry the opaque token in the HTTPS URL,
      // not in cookies, authorization headers, or request-body metadata.
      const raw = oneClick
        ? (new URL(req.url).searchParams.get("token") || "")
        : (form.get("token") || "");
      if (!/^[a-f0-9]{64}$/i.test(raw)) {
        return oneClick
          ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })
          : page("Link not recognized", "This unsubscribe link is invalid or incomplete.");
      }

      const tokenHash = await hash(raw);
      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: token, error: tokenError } = await db
        .from("podcast_marketing_unsubscribe_tokens")
        .select("user_id,created_at")
        .eq("token_hash", tokenHash)
        .gte("created_at", cutoff)
        .maybeSingle();
      if (tokenError || !token) {
        return oneClick
          ? new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } })
          : page("Link not recognized", "This unsubscribe link is invalid or expired.");
      }

      const now = new Date().toISOString();
      const { error: updateError } = await db.from("podcast_marketing_consents").upsert({
        user_id: token.user_id,
        consented: false,
        unsubscribed_at: now,
        updated_at: now,
      }, { onConflict: "user_id" });
      if (updateError) {
        return oneClick
          ? json({ error: "Unsubscribe could not be completed." }, 503)
          : page("Unable to update preferences", "Please contact CrowRules support for help.");
      }

      // Mark used after the opt-out write. Repeated RFC 8058 POSTs remain
      // idempotent: a previously used but unexpired token still enforces opt-out.
      await db.from("podcast_marketing_unsubscribe_tokens")
        .update({ used_at: now })
        .eq("token_hash", tokenHash)
        .is("used_at", null);

      if (oneClick) return new Response(null, {
        status: 204,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
      return page("You are unsubscribed", "Your CrowRules Podcasting promotional email preference has been updated. Essential account and service notices are separate.");
    }
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
  if (!bearer) return json({ error: "Sign-in required." }, 401);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: "Bearer " + bearer } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
  if (authError || !authData?.user) return json({ error: "Your sign-in session is invalid or expired." }, 401);
  let input: any = {};
  try { input = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const userId = authData.user.id;
  if (input.action === "status") {
    const { data, error } = await db.from("podcast_marketing_consents").select("consented,consent_at,consent_source,unsubscribed_at,updated_at").eq("user_id", userId).maybeSingle();
    if (error) return json({ error: "Could not load marketing preferences." }, 500);
    return json({ ok: true, consented: !!data?.consented && !data?.unsubscribed_at, consent_at: data?.consent_at ?? null, consent_source: data?.consent_source ?? null, unsubscribed_at: data?.unsubscribed_at ?? null });
  }
  if (input.action === "subscribe") {
    if (input.confirm !== true) return json({ error: "Explicit promotional email consent is required." }, 400);
    const now = new Date().toISOString();
    const { error } = await db.from("podcast_marketing_consents").upsert({
      user_id: userId, consented: true, consent_at: now, consent_source: "account_preferences",
      unsubscribed_at: null, updated_at: now
    }, { onConflict: "user_id" });
    if (error) return json({ error: "Could not save marketing consent." }, 500);
    return json({ ok: true, consented: true, consent_at: now });
  }
  if (input.action === "unsubscribe") {
    const now = new Date().toISOString();
    const { error } = await db.from("podcast_marketing_consents").upsert({
      user_id: userId, consented: false, unsubscribed_at: now, updated_at: now
    }, { onConflict: "user_id" });
    if (error) return json({ error: "Could not update marketing preferences." }, 500);
    return json({ ok: true, consented: false, unsubscribed_at: now });
  }
  return json({ error: "Unsupported action." }, 400);
});