import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "https://crowrulesentertainment-oss.github.io")
    .split(",").map((value) => value.trim()).filter(Boolean)
);
const rateBuckets = new Map();
const MAX_BODY = 16 * 1024;
const TOKEN_TTL_SECONDS = 10 * 60;

function send(res, status, payload, origin) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {})
  });
  res.end(JSON.stringify(payload));
}

function getClientIp(req) {
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(req) {
  const now = Date.now();
  const key = getClientIp(req);
  const bucket = rateBuckets.get(key) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 60_000; }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 5000) {
    for (const [ip, item] of rateBuckets) if (now > item.reset) rateBuckets.delete(ip);
  }
  return bucket.count <= 60;
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) throw Object.assign(new Error("Request body is too large."), { status: 413 });
  }
  try { return body ? JSON.parse(body) : {}; }
  catch { throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 }); }
}

async function verifySupabaseUser(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw Object.assign(new Error("The token service is missing its Supabase verification configuration."), { status: 503 });
  }
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_KEY, authorization: "Bearer " + accessToken },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  const origin = req.headers.origin || "";
  const corsOrigin = allowedOrigins.has(origin) ? origin : "";
  if (origin && !corsOrigin) return send(res, 403, { error: "Origin is not allowed.", requestId }, "");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...(corsOrigin ? { "access-control-allow-origin": corsOrigin, vary: "Origin" } : {}),
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-max-age": "600"
    });
    return res.end();
  }

  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      ok: true,
      service: "crowrules-livekit-token-service",
      configured: {
        supabase: Boolean(SUPABASE_URL && SUPABASE_KEY),
        livekit: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET)
      }
    }, corsOrigin);
  }
  if (req.method !== "POST" || url.pathname !== "/api/token") {
    return send(res, 404, { error: "Route not found.", requestId }, corsOrigin);
  }
  if (!rateLimit(req)) return send(res, 429, { error: "Too many token requests. Try again shortly.", requestId }, corsOrigin);
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return send(res, 401, { error: "Sign in is required to request a room token.", requestId }, corsOrigin);

  try {
    const user = await verifySupabaseUser(match[1]);
    if (!user) return send(res, 401, { error: "Your sign-in session is invalid or expired. Please sign in again.", requestId }, corsOrigin);
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return send(res, 503, { error: "LiveKit server credentials are not configured on this service.", requestId }, corsOrigin);
    }
    const body = await readJson(req);
    const room = String(body.roomName || "").trim();
    const displayName = String(body.participantName || user.user_metadata?.full_name || user.email || "CrowRules member").trim().slice(0, 80);
    const role = String(body.role || "guest").toLowerCase();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,99}$/.test(room)) {
      return send(res, 400, { error: "Room name must be 3–100 characters and use letters, numbers, dots, underscores, colons or hyphens.", requestId }, corsOrigin);
    }
    if (!["listener", "guest", "creator"].includes(role)) {
      return send(res, 400, { error: "Role must be listener, guest or creator.", requestId }, corsOrigin);
    }
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(user.id),
      name: displayName,
      ttl: TOKEN_TTL_SECONDS,
      metadata: JSON.stringify({ role, provider: "crowrules-podcasting" })
    });
    token.addGrant({
      roomJoin: true,
      room,
      canSubscribe: true,
      canPublish: role !== "listener",
      canPublishData: true
    });
    const jwt = await token.toJwt();
    return send(res, 200, {
      serverUrl: LIVEKIT_URL,
      participantToken: jwt,
      token: jwt,
      roomName: room,
      identity: String(user.id),
      expiresIn: TOKEN_TTL_SECONDS
    }, corsOrigin);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error(JSON.stringify({ requestId, message: error?.message || "Token request failed" }));
    return send(res, status, {
      error: status >= 500 ? "The token service could not complete your request." : error.message,
      requestId
    }, corsOrigin);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("CrowRules LiveKit token service listening on " + PORT);
});
