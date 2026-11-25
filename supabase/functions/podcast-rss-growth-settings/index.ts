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
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: cors });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST required." });
  const origin = req.headers.get("origin");
  if (origin && origin !== ORIGIN) return reply(403, { error: "Origin not allowed." });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !bearer) return reply(401, { error: "Sign in required." });

  const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
  const user = authData?.user;
  if (authError || !user) return reply(401, { error: "Your session is invalid or expired." });

  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON body." }); }

  const { data: member, error: memberError } = await db.from("members")
    .select("id").eq("user_id", user.id).maybeSingle();
  if (memberError) return reply(500, { error: "Could not verify creator membership." });
  if (!member) return reply(403, { error: "A CrowRules member profile is required." });

  const { data: creator, error: creatorError } = await db.from("creators")
    .select("id").eq("member_id", member.id).maybeSingle();
  if (creatorError) return reply(500, { error: "Could not verify creator ownership." });
  if (!creator) return reply(403, { error: "A creator profile is required." });

  const { data: shows, error: showsError } = await db.from("podcasts")
    .select("id,title").eq("creator_id", creator.id);
  if (showsError) return reply(500, { error: "Could not load your shows." });
  const showIds = (shows || []).map((show: any) => show.id);

  if (body.action === "list") {
    if (!showIds.length) return reply(200, { settings: [] });
    const { data, error } = await db.from("podcast_rss_growth_settings")
      .select("podcast_id,enabled,frequency,weekday,send_time,timezone,email_enabled,social_enabled,directory_tracking_enabled,last_run_at,next_run_at,updated_at")
      .in("podcast_id", showIds);
    if (error) return reply(500, { error: "Could not load RSS Growth preferences." });
    return reply(200, { settings: data || [] });
  }

  if (body.action === "save") {
    const podcastId = String(body.podcast_id || "");
    if (!UUID.test(podcastId) || !showIds.includes(podcastId)) return reply(403, { error: "That show does not belong to your creator account." });
    const frequency = String(body.frequency || "weekly");
    if (!["manual", "weekly", "new_episode", "weekly_and_new_episode"].includes(frequency)) return reply(400, { error: "Invalid promotion frequency." });
    const weekday = Number(body.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return reply(400, { error: "Choose a valid day of the week." });
    const sendTime = String(body.send_time || "10:00");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime)) return reply(400, { error: "Choose a valid promotion time." });
    const timezone = String(body.timezone || "America/Los_Angeles");
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); }
    catch { return reply(400, { error: "Choose a supported time zone." }); }
    const row = {
      user_id: user.id,
      podcast_id: podcastId,
      enabled: frequency !== "manual",
      frequency,
      weekday,
      send_time: sendTime,
      timezone,
      email_enabled: body.email_enabled === true,
      social_enabled: body.social_enabled === true,
      directory_tracking_enabled: body.directory_tracking_enabled === true,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await db.from("podcast_rss_growth_settings")
      .upsert(row, { onConflict: "podcast_id" })
      .select("podcast_id,enabled,frequency,weekday,send_time,timezone,email_enabled,social_enabled,directory_tracking_enabled,last_run_at,next_run_at,updated_at")
      .single();
    if (error) return reply(500, { error: "Could not save RSS Growth preferences.", detail: error.message });
    return reply(200, { ok: true, settings: data });
  }

  return reply(400, { error: "Unsupported action." });
});
