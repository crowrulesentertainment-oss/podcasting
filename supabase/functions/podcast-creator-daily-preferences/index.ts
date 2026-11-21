import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGIN = "https://crowrulesentertainment-oss.github.io";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== ORIGIN) return json({ error: "Origin not allowed." }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "Creator Daily preferences are not configured." }, 503);

  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Sign-in required." }, 401);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
  const user = authData?.user;
  if (authError || !user) return json({ error: "Your sign-in session is invalid or expired." }, 401);

  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let input: any = {};
  try { input = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  if (input.action === "status") {
    const { data, error } = await db.from("podcast_creator_daily_consents")
      .select("consented,consent_at,consent_source,unsubscribed_at,updated_at")
      .eq("user_id", user.id).maybeSingle();
    if (error) return json({ error: "Could not load Creator Daily subscription status." }, 500);
    const subscribed = data?.consented === true && !!data?.consent_at && !!data?.consent_source && !data?.unsubscribed_at;
    return json({
      ok: true,
      product: "CrowRules Creator Daily",
      consented: subscribed,
      consent_at: data?.consent_at ?? null,
      consent_source: data?.consent_source ?? null,
      unsubscribed_at: data?.unsubscribed_at ?? null,
    });
  }

  if (input.action === "subscribe") {
    if (input.confirm !== true) return json({ error: "Please affirmatively confirm Creator Daily email consent." }, 400);
    const now = new Date().toISOString();
    const { error } = await db.from("podcast_creator_daily_consents").upsert({
      user_id: user.id,
      consented: true,
      consent_at: now,
      consent_source: "creator_studio_dashboard",
      unsubscribed_at: null,
      updated_at: now,
    }, { onConflict: "user_id" });
    if (error) return json({ error: "Could not save Creator Daily consent." }, 500);
    const { error: auditError } = await db.from("podcast_creator_daily_consent_events").insert({
      user_id: user.id, event_type: "subscribe", event_source: "creator_studio_dashboard", event_at: now,
    });
    if (auditError) return json({ error: "Consent was saved, but its audit event could not be recorded. Please contact support before retrying." }, 500);
    return json({ ok: true, product: "CrowRules Creator Daily", consented: true, consent_at: now });
  }

  if (input.action === "unsubscribe") {
    const now = new Date().toISOString();
    const { data: existing, error: readError } = await db.from("podcast_creator_daily_consents")
      .select("consent_at").eq("user_id", user.id).maybeSingle();
    if (readError) return json({ error: "Could not read Creator Daily consent." }, 500);
    const { error } = await db.from("podcast_creator_daily_consents").upsert({
      user_id: user.id,
      consented: false,
      consent_at: existing?.consent_at ?? null,
      consent_source: "creator_daily_unsubscribe",
      unsubscribed_at: now,
      updated_at: now,
    }, { onConflict: "user_id" });
    if (error) return json({ error: "Could not save your Creator Daily unsubscribe request." }, 500);
    const { error: auditError } = await db.from("podcast_creator_daily_consent_events").insert({
      user_id: user.id, event_type: "unsubscribe", event_source: "creator_studio_dashboard", event_at: now,
    });
    if (auditError) return json({ error: "Your unsubscribe was saved, but its audit event could not be recorded. Please contact support." }, 500);
    return json({ ok: true, product: "CrowRules Creator Daily", consented: false, unsubscribed_at: now });
  }

  return json({ error: "Unsupported action." }, 400);
});