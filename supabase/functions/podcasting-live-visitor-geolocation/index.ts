import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function visitorIp(req: Request): string | null {
  const raw =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  const ip = raw.trim();
  if (!ip || ip.length > 45 || !/^[0-9a-fA-F:.]+$/.test(ip)) return null;
  return ip;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !supabaseUrl || !anonKey) {
    return json({ ok: false, reason: "not_configured" }, 503);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: "invalid_request" }, 400); }

  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return json({ ok: false, reason: "invalid_session" }, 400);
  }

  const ip = visitorIp(req);
  if (!ip) return json({ ok: false, reason: "location_unavailable" });

  try {
    const geoResponse = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region,city,latitude,longitude`,
      { signal: AbortSignal.timeout(5000), headers: { "Accept": "application/json" } },
    );
    if (!geoResponse.ok) return json({ ok: false, reason: "geolocation_unavailable" });
    const geo = await geoResponse.json();
    if (geo?.success !== true) return json({ ok: false, reason: "geolocation_unavailable" });

    const country = typeof geo.country_code === "string" && /^[A-Z]{2}$/i.test(geo.country_code) ? geo.country_code.toUpperCase() : null;
    const city = typeof geo.city === "string" ? geo.city.slice(0, 100) : null;
    const region = typeof geo.region === "string" ? geo.region.slice(0, 100) : null;
    const latitude = Number.isFinite(Number(geo.latitude)) ? Number(geo.latitude) : null;
    const longitude = Number.isFinite(Number(geo.longitude)) ? Number(geo.longitude) : null;

    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/podcasting_touch_live_presence_geo`, {
      method: "POST",
      headers: { "apikey": anonKey, "Authorization": authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_session_id: sessionId, p_city: city, p_region: region, p_country_code: country,
        p_latitude: latitude, p_longitude: longitude,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!saveResponse.ok) return json({ ok: false, reason: "session_update_failed" });
    return json({ ok: true, located: !!(city || region || country) });
  } catch {
    // Never log the visitor IP or geolocation-provider response.
    return json({ ok: false, reason: "geolocation_unavailable" });
  }
});
