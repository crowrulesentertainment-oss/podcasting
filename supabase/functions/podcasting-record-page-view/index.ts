import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigin = "https://crowrulesentertainment-oss.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== allowedOrigin) {
    return new Response("Forbidden origin", { status: 403 });
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  if (!req.headers.get("authorization")) return json({ ok: false, reason: "authorization_required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ ok: false, reason: "not_configured" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "invalid_request" }, 400);
  }

  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  const visitorId = typeof body.visitor_id === "string" ? body.visitor_id : "";
  const sessionId = typeof body.session_id === "string" ? body.session_id : "";
  if (![idempotencyKey, visitorId, sessionId].every((value) => uuidPattern.test(value))) {
    return json({ ok: false, reason: "invalid_identifiers" }, 400);
  }

  const rawPath = typeof body.page_path === "string" ? body.page_path : "/";
  const pagePath = rawPath.split(/[?#]/, 1)[0].slice(0, 300);
  if (!pagePath.startsWith("/") || pagePath.includes("?") || pagePath.includes("#")) {
    return json({ ok: false, reason: "invalid_page_path" }, 400);
  }
  const title = typeof body.page_title === "string" ? body.page_title.slice(0, 180) : null;
  let referrerDomain: string | null = null;
  if (typeof body.referrer_domain === "string") {
    const candidate = body.referrer_domain.trim().toLowerCase();
    if (/^[a-z0-9.-]+(:[0-9]{1,5})?$/.test(candidate)) referrerDomain = candidate.slice(0, 253);
  }
  const device = body.device_type === "mobile" || body.device_type === "tablet" || body.device_type === "desktop"
    ? body.device_type
    : "unknown";

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/podcasting_record_page_view`, {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_idempotency_key: idempotencyKey,
        p_visitor_id: visitorId,
        p_session_id: sessionId,
        p_page_path: pagePath,
        p_page_title: title,
        p_referrer_domain: referrerDomain,
        p_device_type: device,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      // Do not log request identifiers, page titles, or any location data.
      return json({ ok: false, reason: "record_failed" }, 502);
    }
    const result = await response.json();
    return json({ ok: true, duplicate: result?.duplicate === true });
  } catch {
    return json({ ok: false, reason: "temporarily_unavailable" }, 503);
  }
});
