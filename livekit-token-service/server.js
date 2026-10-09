import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 10000);
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://crowrulesentertainment-oss.github.io")
  .split(",").map(v => v.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"]
}));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "crowrules-livekit-token-service",
    configured: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET && SUPABASE_URL && SUPABASE_ANON_KEY)
  });
});

app.post("/api/livekit/token", async (req, res) => {
  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ error: "LiveKit token service is not fully configured." });
    }

    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) return res.status(401).json({ error: "Sign in to CrowRules Podcasting first." });

    const { sessionId, role = "host", displayName = "" } = req.body || {};
    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) {
      return res.status(400).json({ error: "A valid live session ID is required." });
    }
    if (role !== "host") {
      return res.status(403).json({ error: "Only the session host token flow is enabled. Co-host invite redemption will be enabled in the next integration step." });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData?.user) return res.status(401).json({ error: "Your CrowRules session is invalid or expired. Sign in again." });

    const { data: liveSession, error: sessionError } = await userClient
      .from("podcast_live_sessions")
      .select("id,creator_id,status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("session authorization query failed:", sessionError.message);
      return res.status(403).json({ error: "Could not verify your permission to host this live session." });
    }
    if (!liveSession || liveSession.creator_id !== userData.user.id) {
      return res.status(403).json({ error: "Only the creator who owns this live session can receive host access." });
    }
    if (!["live", "starting", "scheduled"].includes(String(liveSession.status || "").toLowerCase())) {
      return res.status(409).json({ error: "This live session is not available for hosting." });
    }

    const roomName = `crowrules-live-${liveSession.id}`;
    const identity = `user-${userData.user.id}`;
    const safeName = String(displayName || userData.user.user_metadata?.display_name || userData.user.email || "CrowRules Host").slice(0, 80);
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: safeName,
      ttl: "10m",
      metadata: JSON.stringify({ userId: userData.user.id, sessionId: liveSession.id, role: "host" })
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    res.set("Cache-Control", "no-store");
    return res.json({ token: await token.toJwt(), serverUrl: LIVEKIT_URL, roomName, identity, role: "host", expiresIn: 600 });
  } catch (error) {
    console.error("token issuance failed:", error?.message || error);
    return res.status(500).json({ error: "Unable to create a LiveKit access token." });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.message === "Origin not allowed") return res.status(403).json({ error: "This website origin is not allowed." });
  console.error("request failed:", err?.message || err);
  return res.status(400).json({ error: "Request could not be processed." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CrowRules LiveKit token service listening on port ${PORT}`);
});
