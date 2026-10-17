import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url } });
const appUrl = Deno.env.get("DISTRIBUTION_APP_URL") ||
  "https://crowrulesentertainment-oss.github.io/podcasting/creator/distribution.html";
const scopes = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];

function b64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromHex(hex: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) throw new Error("DISTRIBUTION_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  return Uint8Array.from(hex.match(/.{2}/g)!, byte => parseInt(byte, 16));
}
async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
async function encryptToken(token: string) {
  const keyBytes = fromHex(Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY") || "");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return b64(iv) + "." + b64(new Uint8Array(encrypted));
}

function fromB64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function decryptToken(ciphertext: string) {
  const parts = String(ciphertext || "").split(".");
  if (parts.length !== 2) throw new Error("Encrypted token format is invalid.");
  const keyBytes = fromHex(Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY") || "");
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(parts[0]) }, key, fromB64(parts[1]));
  return new TextDecoder().decode(plaintext);
}

function randomString(size = 32) {
  return b64(crypto.getRandomValues(new Uint8Array(size))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function htmlPage(title: string, message: string, ok = false) {
  const safeTitle = title.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const safeMessage = message.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safeTitle} · CrowRules</title><body style="margin:0;background:#070911;color:#f6f5ff;font:16px Arial,sans-serif;display:grid;min-height:100vh;place-items:center"><main style="max-width:620px;padding:32px;border:1px solid #2a2b40;border-radius:18px;background:#10121d"><h1 style="color:${ok ? "#70f0b4" : "#61e8ff"}">${safeTitle}</h1><p>${safeMessage}</p><p><a style="color:#61e8ff" href="${appUrl}">Return to CrowRules Podcasting</a></p></main></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  const clientId = Deno.env.get("GOOGLE_YOUTUBE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_YOUTUBE_CLIENT_SECRET") || "";
  const redirectUri = supabaseUrl.replace(/\/$/, "") + "/functions/v1/youtube-oauth";

  if (req.method === "POST") {
    const auth = req.headers.get("Authorization");
    if (!supabaseUrl || !anonKey || !serviceKey || !auth) return json(401, { error: "Sign in required." });
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON." }); }

    if (body.action === "refresh") {
      if (!Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY")) return json(503, { error: "Token encryption is not configured." });
      let podcastId = String(body.podcast_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(podcastId)) return json(400, { error: "Select a podcast first." });
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return json(401, { error: "Your session is invalid. Sign in again." });
      const { data: member } = await userClient.from("members").select("id").eq("user_id", user.id).maybeSingle();
      if (!member) return json(403, { error: "Your CrowRules member profile could not be verified." });
      const { data: creators } = await userClient.from("creators").select("id").eq("member_id", member.id);
      const creatorIds = (creators || []).map((row: { id: string }) => row.id);
      const { data: podcast } = await userClient.from("podcasts").select("id").eq("id", podcastId).in("creator_id", creatorIds).maybeSingle();
      if (!podcast) return json(403, { error: "This podcast does not belong to your creator account." });
      if (!clientId || !clientSecret) return json(503, { error: "Google OAuth credentials are not configured." });
      const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: account, error: accountError } = await service.from("podcast_distribution_accounts")
        .select("id,connection_status").eq("user_id", user.id).eq("podcast_id", podcastId).eq("platform", "youtube").maybeSingle();
      if (accountError || !account) return json(404, { error: "No YouTube connection record exists for this podcast." });
      const { data: rows, error: tokenError } = await service.rpc("distribution_oauth_get_youtube_token", { p_account_id: account.id, p_user_id: user.id });
      const tokenRow = Array.isArray(rows) ? rows[0] : rows;
      if (tokenError || !tokenRow?.refresh_token_ciphertext) return json(409, { error: "No stored refresh token is available. Reconnect YouTube and approve offline access." });
      let refreshToken = "";
      try { refreshToken = await decryptToken(tokenRow.refresh_token_ciphertext); }
      catch { return json(500, { error: "Could not decrypt the stored refresh token. Check the encryption key; no token was changed." }); }
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      });
      const refreshed = await response.json();
      if (!response.ok || !refreshed.access_token) {
        const invalidGrant = refreshed.error === "invalid_grant";
        if (invalidGrant) await service.rpc("distribution_oauth_set_youtube_status", { p_account_id: account.id, p_user_id: user.id, p_status: "expired" });
        return json(invalidGrant ? 409 : 502, { error: invalidGrant ? "Google rejected the refresh token. Reconnect YouTube to restore access." : "Google token refresh failed. Retry later; no upload was attempted.", provider_error: String(refreshed.error || "refresh_failed") });
      }
      let accessCipher = "";
      let refreshCipher: string | null = null;
      try {
        accessCipher = await encryptToken(String(refreshed.access_token));
        if (refreshed.refresh_token) refreshCipher = await encryptToken(String(refreshed.refresh_token));
      } catch { return json(500, { error: "Could not encrypt the refreshed token. No token update was saved." }); }
      const expiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString();
      const { error: saveError } = await service.rpc("distribution_oauth_update_youtube_token", {
        p_account_id: account.id, p_user_id: user.id, p_access_token_ciphertext: accessCipher,
        p_refresh_token_ciphertext: refreshCipher, p_expires_at: expiresAt,
        p_token_type: String(refreshed.token_type || "Bearer"),
        p_scopes: refreshed.scope ? String(refreshed.scope).split(" ") : null,
      });
      if (saveError) return json(500, { error: "Google refreshed access, but secure storage update failed. Check server logs before retrying." });
      await service.rpc("distribution_oauth_set_youtube_status", { p_account_id: account.id, p_user_id: user.id, p_status: "connected" });
      const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true", { headers: { Authorization: "Bearer " + refreshed.access_token } });
      const channelData = await channelResponse.json();
      if (!channelResponse.ok || !channelData.items?.length) return json(502, { error: "Token refreshed and saved, but channel verification failed. No upload was attempted." });
      return json(200, { ok: true, status: "connected", channel: String(channelData.items[0].snippet?.title || "YouTube channel"), expires_at: expiresAt, message: "Token refreshed, encrypted, saved, and channel access verified. No video was uploaded." });
    }
    if (body.action !== "start") return json(400, { error: "Unsupported action." });
    if (!clientId || !clientSecret || !Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY")) {
      return json(503, {
        error: "YouTube OAuth is not configured yet. Add GOOGLE_YOUTUBE_CLIENT_ID, GOOGLE_YOUTUBE_CLIENT_SECRET, and DISTRIBUTION_TOKEN_ENCRYPTION_KEY as Supabase Edge Function secrets.",
        redirect_uri: redirectUri,
      });
    }
    let keyBytes: Uint8Array;
    try { keyBytes = fromHex(Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY")!); }
    catch (e) { return json(503, { error: (e as Error).message }); }
    void keyBytes;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json(401, { error: "Your session is invalid. Sign in again." });
    const podcastId = String(body.podcast_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(podcastId)) return json(400, { error: "Select a podcast first." });
    const { data: member } = await userClient.from("members").select("id").eq("user_id", user.id).maybeSingle();
    if (!member) return json(403, { error: "Your CrowRules member profile could not be verified." });
    const { data: creator } = await userClient.from("creators").select("id").eq("member_id", member.id);
    const creatorIds = (creator || []).map((row: { id: string }) => row.id);
    const { data: podcast } = await userClient.from("podcasts").select("id,title,creator_id").eq("id", podcastId).in("creator_id", creatorIds).maybeSingle();
    if (!podcast) return json(403, { error: "This podcast does not belong to your creator account." });

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: account, error: accountError } = await service.from("podcast_distribution_accounts")
      .upsert({ user_id: user.id, podcast_id: podcastId, platform: "youtube", connection_status: "not_connected", connection_method: "oauth", updated_at: new Date().toISOString() }, { onConflict: "user_id,podcast_id,platform" })
      .select("id").single();
    if (accountError || !account) return json(500, { error: "Could not prepare the YouTube connection record." });

    const state = randomString(32);
    const verifier = randomString(48);
    const challenge = b64(await sha256(verifier)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const stateHash = Array.from(await sha256(state)).map(x => x.toString(16).padStart(2, "0")).join("");
    const { error: stateError } = await service.rpc("distribution_oauth_store_state", {
      p_state_hash: stateHash, p_user_id: user.id, p_podcast_id: podcastId, p_platform: "youtube",
      p_code_verifier: verifier, p_redirect_uri: redirectUri, p_provider_state: state,
    });
    if (stateError) return json(500, { error: "Could not securely start OAuth. Please retry." });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    return json(200, { authorization_url: authUrl.toString(), redirect_uri: redirectUri });
  }

  if (req.method !== "GET") return json(405, { error: "GET or POST required." });
  const incoming = new URL(req.url);
  const providerError = incoming.searchParams.get("error");
  if (providerError) return htmlPage("YouTube connection cancelled", "Google did not complete authorization. You can return to CrowRules and try again.");
  const code = incoming.searchParams.get("code");
  const state = incoming.searchParams.get("state");
  if (!code || !state) return htmlPage("YouTube connection could not start", "The callback was missing the required authorization code or state.");
  if (!supabaseUrl || !serviceKey || !clientId || !clientSecret || !Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY")) {
    return htmlPage("YouTube setup is incomplete", "The server is missing Google OAuth credentials or the token encryption key. No account was connected.");
  }

  const stateHash = Array.from(await sha256(state)).map(x => x.toString(16).padStart(2, "0")).join("");
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: states, error: consumeError } = await service.rpc("distribution_oauth_consume_state", { p_state_hash: stateHash });
  const stateRow = Array.isArray(states) ? states[0] : states;
  if (consumeError || !stateRow || stateRow.platform !== "youtube" || stateRow.provider_state !== state) {
    return htmlPage("YouTube connection expired", "This authorization attempt was invalid, already used, or expired. Start the connection again.");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret, redirect_uri: stateRow.redirect_uri,
      grant_type: "authorization_code", code_verifier: stateRow.code_verifier,
    }),
  });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) return htmlPage("YouTube authorization failed", "Google did not return usable tokens. Check the OAuth client and exact redirect URI, then retry.");

  const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet%2Cid&mine=true", {
    headers: { Authorization: "Bearer " + token.access_token },
  });
  const channelData = await channelResponse.json();
  if (!channelResponse.ok || !channelData.items?.length) return htmlPage("No YouTube channel found", "Google authorization succeeded, but this Google account did not return a YouTube channel. Choose a Google account with a channel and retry.");
  const channel = channelData.items[0];
  let accessCipher: string;
  let refreshCipher: string | null = null;
  try {
    accessCipher = await encryptToken(String(token.access_token));
    if (token.refresh_token) refreshCipher = await encryptToken(String(token.refresh_token));
  } catch {
    return htmlPage("Secure token storage unavailable", "The server could not encrypt tokens. No connected status was recorded.");
  }

  const { data: account, error: accountError } = await service.from("podcast_distribution_accounts")
    .select("id").eq("user_id", stateRow.user_id).eq("podcast_id", stateRow.podcast_id).eq("platform", "youtube").maybeSingle();
  if (accountError || !account) return htmlPage("Connection record missing", "The YouTube account record could not be found. Return to CrowRules and try again.");
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  const customUrl = channel.snippet?.customUrl ? String(channel.snippet.customUrl).replace(/^\/+/, "") : "";
  const profileUrl = customUrl ? "https://www.youtube.com/" + customUrl : "https://www.youtube.com/channel/" + channel.id;
  const { error: storeError } = await service.rpc("distribution_oauth_store_youtube_token", {
    p_account_id: account.id, p_access_token_ciphertext: accessCipher, p_refresh_token_ciphertext: refreshCipher,
    p_token_type: String(token.token_type || "Bearer"), p_scopes: String(token.scope || scopes.join(" ")).split(" "),
    p_expires_at: expiresAt, p_provider_account_id: String(channel.id),
    p_account_label: String(channel.snippet?.title || "YouTube channel"), p_profile_url: profileUrl,
  });
  if (storeError) return htmlPage("Secure account save failed", "Google authorized the channel, but CrowRules could not safely save its connection. Contact support before retrying.");
  return htmlPage("YouTube connected", "Your YouTube channel " + String(channel.snippet?.title || "") + " was authorized and its tokens were encrypted before storage. This does not yet mean automatic publishing is enabled.", true);
});