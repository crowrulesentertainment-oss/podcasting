import { createServer } from "node:http";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
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
const SESSION_TTL_MINUTES = 4 * 60;
const MAX_ROOM_PARTICIPANTS = 10;
const roomService = LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET
  ? new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

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

async function dbRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("The LiveKit authorization database credential is not configured."), { status: 503 });
  }
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY,
      "content-type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(8000)
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    console.error(JSON.stringify({ event: "supabase_service_request_failed", status: response.status }));
    throw Object.assign(new Error("The authorization service could not verify this request."), { status: 503 });
  }
  return data;
}

async function authenticate(req) {
  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifySupabaseUser(match[1]);
}

async function getCreatorForUser(userId) {
  const members = await dbRequest("members?user_id=eq." + encodeURIComponent(userId) + "&select=id&limit=1");
  if (!Array.isArray(members) || !members[0]) return null;
  const creators = await dbRequest(
    "creators?member_id=eq." + encodeURIComponent(members[0].id) +
    "&is_active=eq.true&select=id&limit=1"
  );
  return Array.isArray(creators) ? creators[0] || null : null;
}

async function getOwnedSession(sessionId, userId) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(sessionId || ""))) return null;
  const rows = await dbRequest(
    "podcasting_livekit_sessions?id=eq." + encodeURIComponent(sessionId) +
    "&owner_user_id=eq." + encodeURIComponent(userId) +
    "&status=eq.active&expires_at=gt." + encodeURIComponent(new Date().toISOString()) +
    "&select=id,room_name,mode,expires_at&limit=1"
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getGroupRoom(roomId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(roomId || ""))) return null;
  const rows = await dbRequest(
    "crowspace_live_rooms?id=eq." + encodeURIComponent(roomId) +
    "&select=id,created_by,title,visibility,circle_id,group_id,status,room_type&limit=1"
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function canHostGroupRoom(room, userId) {
  if (!room || !userId) return false;
  if (room.visibility === "public" && room.created_by === userId) return true;
  if (room.circle_id) {
    const circles = await dbRequest("podcast_community_circles?id=eq." + encodeURIComponent(room.circle_id) + "&select=owner_id&limit=1");
    if (Array.isArray(circles) && circles[0]?.owner_id === userId) return true;
    const members = await dbRequest(
      "podcast_community_circle_members?circle_id=eq." + encodeURIComponent(room.circle_id) +
      "&member_id=eq." + encodeURIComponent(userId) + "&select=role&limit=1"
    );
    return Array.isArray(members) && members.some((item) => item.role === "moderator");
  }
  if (room.group_id) {
    const members = await dbRequest(
      "crowspace_group_members?group_id=eq." + encodeURIComponent(room.group_id) +
      "&user_id=eq." + encodeURIComponent(userId) + "&select=role&limit=1"
    );
    return Array.isArray(members) && members.some((item) => ["owner", "admin"].includes(item.role));
  }
  return false;
}

async function canViewGroupRoom(room, userId) {
  if (!room || !userId) return false;
  if (room.visibility === "public") return true;
  if (room.circle_id) {
    const circles = await dbRequest("podcast_community_circles?id=eq." + encodeURIComponent(room.circle_id) + "&select=owner_id&limit=1");
    if (Array.isArray(circles) && circles[0]?.owner_id === userId) return true;
    const rows = await dbRequest(
      "podcast_community_circle_members?circle_id=eq." + encodeURIComponent(room.circle_id) +
      "&member_id=eq." + encodeURIComponent(userId) + "&select=member_id&limit=1"
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  if (room.group_id) {
    const rows = await dbRequest(
      "crowspace_group_members?group_id=eq." + encodeURIComponent(room.group_id) +
      "&user_id=eq." + encodeURIComponent(userId) + "&select=user_id&limit=1"
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  return false;
}

async function getOwnedGroupSession(sessionId, userId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(sessionId || ""))) return null;
  const rows = await dbRequest(
    "crowspace_live_room_sessions?id=eq." + encodeURIComponent(sessionId) +
    "&owner_user_id=eq." + encodeURIComponent(userId) +
    "&status=eq.active&expires_at=gt." + encodeURIComponent(new Date().toISOString()) +
    "&select=id,room_id,room_name,mode,expires_at&limit=1"
  );
  return Array.isArray(rows) ? rows[0] || null : null;
}

function hashInvite(token) {
  return createHash("sha256").update(token).digest("hex");
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
      maxRoomParticipants: MAX_ROOM_PARTICIPANTS,
      configured: {
        supabaseAuth: Boolean(SUPABASE_URL && SUPABASE_KEY),
        authorizationDatabase: Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY),
        livekit: Boolean(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET)
      }
    }, corsOrigin);
  }

  if (!["/api/token", "/api/sessions", "/api/invitations", "/api/invitations/revoke", "/api/groups/sessions", "/api/groups/sessions/end", "/api/groups/invitations", "/api/groups/invitations/revoke"].includes(url.pathname) || req.method !== "POST") {
    return send(res, 404, { error: "Route not found.", requestId }, corsOrigin);
  }
  if (!rateLimit(req)) return send(res, 429, { error: "Too many requests. Try again shortly.", requestId }, corsOrigin);

  try {
    const user = await authenticate(req);
    if (!user) return send(res, 401, { error: "Your sign-in session is invalid or expired. Please sign in again.", requestId }, corsOrigin);
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !roomService) {
      return send(res, 503, { error: "LiveKit server credentials are not configured on this service.", requestId }, corsOrigin);
    }
    const body = await readJson(req);

    if (url.pathname === "/api/groups/sessions") {
      const room = await getGroupRoom(body.roomId);
      if (!room || room.status === "ended") return send(res, 404, { error: "An active group live-room record was not found.", requestId }, corsOrigin);
      if (!await canHostGroupRoom(room, user.id)) return send(res, 403, { error: "Only this room's creator or an authorized group owner/moderator can start it.", requestId }, corsOrigin);
      const mode = body.mode === "video" ? "video" : body.mode === "audio" ? "audio" : null;
      if (!mode) return send(res, 400, { error: "Choose audio or video for this group room.", requestId }, corsOrigin);
      const nowIso = new Date().toISOString();
      await dbRequest("crowspace_live_room_sessions?room_id=eq." + encodeURIComponent(room.id) + "&status=eq.active&expires_at=lte." + encodeURIComponent(nowIso), {
        method: "PATCH", body: { status: "ended", ended_at: nowIso }
      });
      const existing = await dbRequest("crowspace_live_room_sessions?room_id=eq." + encodeURIComponent(room.id) + "&status=eq.active&expires_at=gt." + encodeURIComponent(nowIso) + "&select=id&limit=1");
      if (Array.isArray(existing) && existing.length) return send(res, 409, { error: "This group room already has an active LiveKit session.", requestId }, corsOrigin);
      const roomName = "cr-group-" + randomBytes(18).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();
      const rows = await dbRequest("crowspace_live_room_sessions", {
        method: "POST", prefer: "return=representation",
        body: [{ room_id: room.id, room_name: roomName, owner_user_id: user.id, mode, status: "active", expires_at: expiresAt }]
      });
      if (!Array.isArray(rows) || !rows[0]) throw new Error("The group LiveKit session could not be created.");
      const roomUpdate = await dbRequest("crowspace_live_rooms?id=eq." + encodeURIComponent(room.id) + "&status=neq.ended", {
        method: "PATCH", prefer: "return=representation",
        body: { status: "live", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      });
      if (!Array.isArray(roomUpdate) || !roomUpdate.length) {
        await dbRequest("crowspace_live_room_sessions?id=eq." + encodeURIComponent(rows[0].id), {
          method: "PATCH", body: { status: "ended", ended_at: new Date().toISOString() }
        });
        return send(res, 409, { error: "The group room was ended before its LiveKit session could start.", requestId }, corsOrigin);
      }
      return send(res, 201, { sessionId: rows[0].id, roomId: room.id, roomName, title: room.title, mode, expiresAt, maxParticipants: MAX_ROOM_PARTICIPANTS }, corsOrigin);
    }

    if (url.pathname === "/api/groups/sessions/end") {
      const session = await getOwnedGroupSession(body.sessionId, user.id);
      const linkedRoom = session ? await getGroupRoom(session.room_id) : null;
      if (!session || !linkedRoom || !await canHostGroupRoom(linkedRoom, user.id)) return send(res, 404, { error: "Active group session not found or you are not currently authorized to host it.", requestId }, corsOrigin);
      await dbRequest("crowspace_live_room_sessions?id=eq." + encodeURIComponent(session.id), {
        method: "PATCH", body: { status: "ended", ended_at: new Date().toISOString() }
      });
      await dbRequest("crowspace_live_rooms?id=eq." + encodeURIComponent(session.room_id), {
        method: "PATCH", body: { status: "ended", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      });
      return send(res, 200, { ok: true, roomId: session.room_id }, corsOrigin);
    }

    if (url.pathname === "/api/groups/invitations") {
      const session = await getOwnedGroupSession(body.sessionId, user.id);
      const linkedRoom = session ? await getGroupRoom(session.room_id) : null;
      if (!session || !linkedRoom || linkedRoom.status !== "live" || !await canHostGroupRoom(linkedRoom, user.id)) return send(res, 404, { error: "Active group session not found, the room is no longer live, or you are not currently authorized to host it.", requestId }, corsOrigin);
      const role = body.role === "listener" ? "listener" : body.role === "guest" ? "guest" : null;
      if (!role) return send(res, 400, { error: "Invitation role must be guest or listener.", requestId }, corsOrigin);
      const expiresInMinutes = Math.max(5, Math.min(1440, Number(body.expiresInMinutes) || 60));
      const maxUses = Math.max(1, Math.min(10, Number(body.maxUses) || 1));
      const invitedUserId = body.invitedUserId ? String(body.invitedUserId) : null;
      const invitedEmail = body.invitedEmail ? String(body.invitedEmail).trim().toLowerCase().slice(0, 254) : null;
      if (invitedUserId && !/^[0-9a-f-]{36}$/i.test(invitedUserId)) return send(res, 400, { error: "Invalid invited user.", requestId }, corsOrigin);
      if (invitedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return send(res, 400, { error: "Invalid invited email.", requestId }, corsOrigin);
      const invitationToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
      const rows = await dbRequest("crowspace_live_room_invitations", {
        method: "POST", prefer: "return=representation",
        body: [{ session_id: session.id, token_hash: hashInvite(invitationToken), role, invited_user_id: invitedUserId, invited_email: invitedEmail, max_uses: maxUses, expires_at: expiresAt, created_by: user.id }]
      });
      if (!Array.isArray(rows) || !rows[0]) throw new Error("The group room invitation could not be created.");
      return send(res, 201, { invitationToken, invitationId: rows[0].id, expiresAt, role }, corsOrigin);
    }

    if (url.pathname === "/api/groups/invitations/revoke") {
      const session = await getOwnedGroupSession(body.sessionId, user.id);
      const linkedRoom = session ? await getGroupRoom(session.room_id) : null;
      if (!session || !linkedRoom || !await canHostGroupRoom(linkedRoom, user.id)) return send(res, 404, { error: "Active group session not found or you are not currently authorized to host it.", requestId }, corsOrigin);
      if (!/^[0-9a-f-]{36}$/i.test(String(body.invitationId || ""))) return send(res, 400, { error: "Invalid invitation.", requestId }, corsOrigin);
      await dbRequest("crowspace_live_room_invitations?id=eq." + encodeURIComponent(body.invitationId) + "&session_id=eq." + encodeURIComponent(session.id) + "&revoked_at=is.null", {
        method: "PATCH", body: { revoked_at: new Date().toISOString() }
      });
      return send(res, 200, { ok: true }, corsOrigin);
    }

    if (url.pathname === "/api/sessions") {
      const creator = await getCreatorForUser(user.id);
      if (!creator) return send(res, 403, { error: "An active CrowRules creator profile is required to start a live session.", requestId }, corsOrigin);
      const mode = body.mode === "video" ? "video" : body.mode === "audio" ? "audio" : null;
      if (!mode) return send(res, 400, { error: "Choose audio or video for this session.", requestId }, corsOrigin);
      let podcastId = body.podcastId ? String(body.podcastId) : null;
      if (podcastId) {
        const podcasts = await dbRequest(
          "podcasts?id=eq." + encodeURIComponent(podcastId) +
          "&creator_id=eq." + encodeURIComponent(creator.id) + "&select=id&limit=1"
        );
        if (!Array.isArray(podcasts) || !podcasts[0]) {
          return send(res, 403, { error: "You can only start a session for a podcast you own.", requestId }, corsOrigin);
        }
      }
      const roomName = "cr-" + randomBytes(18).toString("hex");
      const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000).toISOString();
      const rows = await dbRequest("podcasting_livekit_sessions", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          room_name: roomName,
          owner_user_id: user.id,
          creator_id: creator.id,
          podcast_id: podcastId,
          mode,
          status: "active",
          expires_at: expiresAt
        }]
      });
      if (!Array.isArray(rows) || !rows[0]) throw new Error("The live session could not be created.");
      return send(res, 201, {
        sessionId: rows[0].id,
        roomName,
        mode,
        expiresAt,
        maxParticipants: MAX_ROOM_PARTICIPANTS
      }, corsOrigin);
    }

    if (url.pathname === "/api/invitations") {
      const session = await getOwnedSession(body.sessionId, user.id);
      if (!session) return send(res, 404, { error: "Active session not found or you are not its host.", requestId }, corsOrigin);
      const role = body.role === "listener" ? "listener" : body.role === "guest" ? "guest" : null;
      if (!role) return send(res, 400, { error: "Invitation role must be guest or listener.", requestId }, corsOrigin);
      const expiresInMinutes = Math.max(5, Math.min(1440, Number(body.expiresInMinutes) || 60));
      const maxUses = Math.max(1, Math.min(10, Number(body.maxUses) || 1));
      const invitedUserId = body.invitedUserId ? String(body.invitedUserId) : null;
      const invitedEmail = body.invitedEmail ? String(body.invitedEmail).trim().toLowerCase().slice(0, 254) : null;
      if (invitedUserId && !/^[0-9a-f-]{36}$/i.test(invitedUserId)) return send(res, 400, { error: "Invalid invited user.", requestId }, corsOrigin);
      if (invitedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) return send(res, 400, { error: "Invalid invited email.", requestId }, corsOrigin);
      const invitationToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
      const rows = await dbRequest("podcasting_livekit_invitations", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          session_id: session.id,
          token_hash: hashInvite(invitationToken),
          role,
          invited_user_id: invitedUserId,
          invited_email: invitedEmail,
          max_uses: maxUses,
          expires_at: expiresAt,
          created_by: user.id
        }]
      });
      if (!Array.isArray(rows) || !rows[0]) throw new Error("The invitation could not be created.");
      return send(res, 201, { invitationToken, invitationId: rows[0].id, expiresAt, role }, corsOrigin);
    }

    if (url.pathname === "/api/invitations/revoke") {
      const session = await getOwnedSession(body.sessionId, user.id);
      if (!session) return send(res, 404, { error: "Active session not found or you are not its host.", requestId }, corsOrigin);
      if (!/^[0-9a-f-]{36}$/i.test(String(body.invitationId || ""))) return send(res, 400, { error: "Invalid invitation.", requestId }, corsOrigin);
      await dbRequest(
        "podcasting_livekit_invitations?id=eq." + encodeURIComponent(body.invitationId) +
        "&session_id=eq." + encodeURIComponent(session.id) + "&revoked_at=is.null",
        { method: "PATCH", body: { revoked_at: new Date().toISOString() } }
      );
      return send(res, 200, { ok: true }, corsOrigin);
    }

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return send(res, 503, { error: "LiveKit server credentials are not configured.", requestId }, corsOrigin);
    }

    let session = null;
    let role = null;
    if (body.groupSessionId) {
      session = await getOwnedGroupSession(body.groupSessionId, user.id);
      const linkedRoom = session ? await getGroupRoom(session.room_id) : null;
      if (!session || !linkedRoom || linkedRoom.status !== "live" || !await canHostGroupRoom(linkedRoom, user.id)) return send(res, 403, { error: "You are not currently authorized to host this active group room.", requestId }, corsOrigin);
      role = "group_host";
    } else if (body.groupRoomId) {
      const room = await getGroupRoom(body.groupRoomId);
      if (!room || room.status !== "live" || !await canViewGroupRoom(room, user.id)) {
        return send(res, 403, { error: "This live room is not available to your account or group membership.", requestId }, corsOrigin);
      }
      const active = await dbRequest("crowspace_live_room_sessions?room_id=eq." + encodeURIComponent(room.id) + "&status=eq.active&expires_at=gt." + encodeURIComponent(new Date().toISOString()) + "&select=id,room_id,room_name,mode&limit=1");
      if (!Array.isArray(active) || !active[0]) return send(res, 404, { error: "This group room does not have an active LiveKit session.", requestId }, corsOrigin);
      session = active[0];
      role = "listener";
    } else if (body.groupInvitationToken && typeof body.groupInvitationToken === "string" && body.groupInvitationToken.length >= 40 && body.groupInvitationToken.length <= 100) {
      const redeemed = await dbRequest("rpc/crowspace_livekit_redeem_room_invitation", {
        method: "POST",
        body: { p_token_hash: hashInvite(body.groupInvitationToken), p_user_id: user.id }
      });
      if (!redeemed?.session_id || !redeemed?.room_name || !["guest", "listener"].includes(redeemed.role)) {
        return send(res, 403, { error: "This group-room invitation is invalid, expired, revoked, exhausted, or not assigned to your account.", requestId }, corsOrigin);
      }
      session = { id: redeemed.session_id, room_name: redeemed.room_name, mode: redeemed.mode };
      role = redeemed.role;
    } else if (body.sessionId) {
      session = await getOwnedSession(body.sessionId, user.id);
      if (!session) return send(res, 403, { error: "You are not the host of this active session.", requestId }, corsOrigin);
      role = "creator";
    } else if (body.invitationToken && typeof body.invitationToken === "string" && body.invitationToken.length >= 40 && body.invitationToken.length <= 100) {
      const redeemed = await dbRequest("rpc/podcasting_livekit_redeem_invitation", {
        method: "POST",
        body: { p_token_hash: hashInvite(body.invitationToken), p_user_id: user.id }
      });
      if (!redeemed?.session_id || !redeemed?.room_name || !["guest", "listener"].includes(redeemed.role)) {
        return send(res, 403, { error: "This invitation is invalid, expired, revoked, exhausted, or not assigned to your account.", requestId }, corsOrigin);
      }
      session = { id: redeemed.session_id, room_name: redeemed.room_name, mode: redeemed.mode };
      role = redeemed.role;
    } else {
      return send(res, 400, { error: "A valid host session or invitation is required.", requestId }, corsOrigin);
    }

    await roomService.createRoom({
      name: session.room_name,
      maxParticipants: MAX_ROOM_PARTICIPANTS
    });
    const currentParticipants = await roomService.listParticipants(session.room_name);
    if (currentParticipants.length >= MAX_ROOM_PARTICIPANTS) {
      return send(res, 409, {
        error: "This recording room is full. CrowRules Studio allows up to 10 people, including the host.",
        maxParticipants: MAX_ROOM_PARTICIPANTS,
        participantCount: currentParticipants.length,
        requestId
      }, corsOrigin);
    }

    const displayName = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "CrowRules member").trim().slice(0, 80);
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(user.id),
      name: displayName,
      ttl: TOKEN_TTL_SECONDS,
      metadata: JSON.stringify({ role, sessionId: session.id, provider: role === "group_host" || (session.room_name || "").startsWith("cr-group-") ? "crowspace-groups" : "crowrules-podcasting" })
    });
    token.addGrant({
      roomJoin: true,
      room: session.room_name,
      canSubscribe: true,
      canPublish: role === "creator" || role === "group_host" || role === "guest",
      canPublishData: true
    });
    const jwt = await token.toJwt();
    return send(res, 200, {
      serverUrl: LIVEKIT_URL,
      participantToken: jwt,
      token: jwt,
      roomName: session.room_name,
      sessionId: session.id,
      mode: session.mode,
      role,
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
