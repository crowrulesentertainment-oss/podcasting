import express from "express";
import crypto from "node:crypto";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const PORT = Number(process.env.PORT || 10000);
const LIVEKIT_URL = process.env.LIVEKIT_URL || "";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const MAX_LIVE_PARTICIPANTS = 100;
const roomService = LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET
  ? new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;
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

function getBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
function getUserClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {})
  });
}
function hashInvite(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}
function roomFor(sessionId) {
  return `crowrules-live-${sessionId}`;
}
async function ensureRoomCapacity(roomName) {
  if (!roomService) throw new Error("LiveKit room service is not configured.");
  const rooms = await roomService.listRooms([roomName]);
  const existing = rooms.find(room => room.name === roomName);
  if (existing) {
    // An empty room can be safely recreated to apply the latest participant cap.
    if (Number(existing.numParticipants || 0) === 0 && Number(existing.maxParticipants || 0) !== MAX_LIVE_PARTICIPANTS) {
      await roomService.deleteRoom(roomName);
      await roomService.createRoom({ name: roomName, maxParticipants: MAX_LIVE_PARTICIPANTS });
    } else if (Number(existing.maxParticipants || 0) !== MAX_LIVE_PARTICIPANTS) {
      console.warn(`Room ${roomName} is already active with maxParticipants=${existing.maxParticipants}; capacity applies to newly created rooms.`);
    }
    return;
  }
  await roomService.createRoom({ name: roomName, maxParticipants: MAX_LIVE_PARTICIPANTS });
}
function safeDisplayName(value, fallback) {
  const clean = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  return clean || fallback;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "crowrules-livekit-token-service",
    configured: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET && SUPABASE_URL && SUPABASE_ANON_KEY)
  });
});

// Owner-only, short-lived invitations. The database stores only a SHA-256 hash.
app.post("/api/livekit/invite", async (req, res) => {
  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ error: "LiveKit token service is not fully configured." });
    }
    const accessToken = getBearer(req);
    if (!accessToken) return res.status(401).json({ error: "Sign in to create a co-host invitation." });
    const { sessionId } = req.body || {};
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return res.status(400).json({ error: "A valid live session ID is required." });
    }
    const client = getUserClient(accessToken);
    const { data: auth, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !auth?.user) return res.status(401).json({ error: "Your sign-in session expired. Sign in again." });
    const { data: session, error: sessionError } = await client
      .from("podcast_live_sessions").select("id,creator_id,status").eq("id", sessionId).maybeSingle();
    if (sessionError) {
      console.error("invite session lookup failed:", sessionError.message);
      return res.status(403).json({ error: "Could not verify session ownership." });
    }
    if (!session || session.creator_id !== auth.user.id) return res.status(403).json({ error: "Only the session owner can invite co-hosts." });
    if (String(session.status || "").toLowerCase() !== "live") return res.status(409).json({ error: "Start the live broadcast before inviting a co-host." });

    const inviteToken = crypto.randomBytes(32).toString("base64url");
    const { data, error } = await client.rpc("create_podcast_live_cohost_invite", {
      p_session_id: sessionId,
      p_token_hash: hashInvite(inviteToken)
    });
    if (error) {
      console.error("invite creation RPC failed:", error.message);
      return res.status(409).json({ error: error.message || "Could not create the invitation." });
    }
    res.set("Cache-Control", "no-store");
    return res.json({ inviteToken, expiresAt: data?.expires_at, inviteId: data?.id });
  } catch (error) {
    console.error("invite creation failed:", error?.message || error);
    return res.status(500).json({ error: "Unable to create a co-host invitation." });
  }
});

app.post("/api/livekit/token", async (req, res) => {
  try {
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(503).json({ error: "LiveKit token service is not fully configured." });
    }
    const accessToken = getBearer(req);
    const { sessionId, role = "host", displayName = "", inviteToken = "" } = req.body || {};
    if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return res.status(400).json({ error: "A valid live session ID is required." });
    }
    if (!["host", "listener", "cohost"].includes(role)) {
      return res.status(403).json({ error: "This role is not allowed." });
    }
    if (role === "listener" && inviteToken) return res.status(400).json({ error: "Listener tokens do not use co-host invitations." });
    if (role !== "listener" && !accessToken) return res.status(401).json({ error: "Sign in to CrowRules Podcasting first." });

    const client = getUserClient(accessToken);
    let authenticatedUser = null;
    if (accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (!error && data?.user) authenticatedUser = data.user;
    }
    if (role !== "listener" && !authenticatedUser) return res.status(401).json({ error: "Your sign-in session expired. Sign in again." });

    const { data: liveSession, error: sessionError } = await client
      .from("podcast_live_sessions").select("id,creator_id,status").eq("id", sessionId).maybeSingle();
    if (sessionError) {
      console.error("session authorization query failed:", sessionError.message);
      return res.status(403).json({ error: "Could not verify this live session. Check the public session-read policy." });
    }
    if (!liveSession) return res.status(404).json({ error: "Live session not found." });
    const sessionStatus = String(liveSession.status || "").toLowerCase();

    if (role === "host") {
      if (liveSession.creator_id !== authenticatedUser.id) return res.status(403).json({ error: "Only the session owner can receive host access." });
      if (sessionStatus !== "live") return res.status(409).json({ error: "This session must be live before the host token can be issued." });
    } else if (role === "listener") {
      if (sessionStatus !== "live") return res.status(409).json({ error: "This live session is not currently live." });
    } else {
      if (typeof inviteToken !== "string" || inviteToken.length < 40 || inviteToken.length > 100) {
        return res.status(403).json({ error: "A valid co-host invitation is required." });
      }
      const { data: redeemed, error: redeemError } = await client.rpc("redeem_podcast_live_cohost_invite", {
        p_session_id: sessionId,
        p_token_hash: hashInvite(inviteToken)
      });
      if (redeemError || !redeemed?.id || redeemed.creator_id !== liveSession.creator_id) {
        if (redeemError) console.warn("co-host invite redemption rejected:", redeemError.message);
        return res.status(403).json({ error: "This co-host invitation is invalid, expired, already used, or the room is unavailable." });
      }
    }

    const roomName = roomFor(liveSession.id);
    const identity = role === "host" ? `user-${authenticatedUser.id}`
      : role === "cohost" ? `cohost-${authenticatedUser.id}-${crypto.randomUUID()}`
      : `listener-${crypto.randomUUID()}`;
    const fallback = role === "host" ? (authenticatedUser.user_metadata?.display_name || authenticatedUser.email || "CrowRules Host")
      : role === "cohost" ? (authenticatedUser.user_metadata?.display_name || authenticatedUser.email || "CrowRules Co-host")
      : "CrowRules Listener";
    const safeName = safeDisplayName(displayName, fallback);
    const ttl = role === "listener" ? "5m" : "10m";
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity, name: safeName, ttl,
      metadata: JSON.stringify({ userId: authenticatedUser?.id || null, sessionId: liveSession.id, role })
    });
    token.addGrant({
      roomJoin: true, room: roomName,
      canPublish: role !== "listener",
      canSubscribe: true,
      canPublishData: role === "host"
    });
    res.set("Cache-Control", "no-store");
    return res.json({ token: await token.toJwt(), serverUrl: LIVEKIT_URL, roomName, identity, role, maxParticipants: MAX_LIVE_PARTICIPANTS, expiresIn: role === "listener" ? 300 : 600 });
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
