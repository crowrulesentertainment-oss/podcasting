import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const headers = {
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

function fromHex(hex: string) {
  if (!/^[a-fA-F0-9]{64}$/.test(hex)) throw new Error("Token encryption key must be 64 hex characters.");
  return Uint8Array.from(hex.match(/.{2}/g)!, byte => parseInt(byte, 16));
}
function fromB64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function decryptToken(ciphertext: string) {
  const parts = String(ciphertext || "").split(".");
  if (parts.length !== 2) throw new Error("Encrypted token format is invalid.");
  const key = await crypto.subtle.importKey("raw", fromHex(Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY") || ""), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(parts[0]) }, key, fromB64(parts[1]));
  return new TextDecoder().decode(plain);
}


function toB64Url(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).split("+").join("-").split("/").join("_").replace(/=+$/g, ""); }
async function signUploadSession(payload: Record<string, unknown>) { const secret = fromHex(Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY") || ""); const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const encoded = toB64Url(new TextEncoder().encode(JSON.stringify(payload))); const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded))); return encoded + "." + toB64Url(signature); }
\nDeno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json(405, { error: "POST required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey || !Deno.env.get("DISTRIBUTION_TOKEN_ENCRYPTION_KEY")) {
    return json(503, { error: "YouTube upload setup is incomplete. Check Supabase function secrets." });
  }
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json(401, { error: "Sign in to CrowRules Podcasting first." });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON." }); }
  const podcastId = String(body.podcast_id || "");
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const mimeType = String(body.mime_type || "");
  const fileSize = Number(body.file_size || 0);
  const filename = String(body.filename || "episode-video").slice(0, 180);
  const tags = Array.isArray(body.tags) ? body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 30) : [];

  if (!/^[0-9a-f-]{36}$/i.test(podcastId)) return json(400, { error: "Select a podcast first." });
  if (!title || title.length > 100) return json(400, { error: "YouTube title is required and must be 100 characters or fewer." });
  if (description.length > 5000) return json(400, { error: "Description must be 5,000 characters or fewer." });
  if (!/^video\/[a-zA-Z0-9.+-]+$/.test(mimeType)) return json(400, { error: "Choose a video file with a supported video MIME type." });
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > 256 * 1024 * 1024 * 1024) return json(400, { error: "File size must be between 1 byte and 256 GB." });
  if (!filename || /[\r\n]/.test(filename)) return json(400, { error: "Invalid filename." });

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: "Your session expired. Sign in again." });
  const { data: member, error: memberError } = await userClient.from("members").select("id").eq("user_id", user.id).maybeSingle();
  if (memberError || !member) return json(403, { error: "Your CrowRules member profile could not be verified." });
  const { data: creators, error: creatorsError } = await userClient.from("creators").select("id").eq("member_id", member.id);
  if (creatorsError) return json(500, { error: "Could not verify creator ownership." });
  const creatorIds = (creators || []).map((row: { id: string }) => row.id);
  if (!creatorIds.length) return json(403, { error: "No creator profile is linked to this account." });
  const { data: podcast, error: podcastError } = await userClient.from("podcasts").select("id,title").eq("id", podcastId).in("creator_id", creatorIds).maybeSingle();
  if (podcastError || !podcast) return json(403, { error: "This podcast does not belong to your creator account." });

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: account, error: accountError } = await service.from("podcast_distribution_accounts")
    .select("id,connection_status").eq("user_id", user.id).eq("podcast_id", podcastId).eq("platform", "youtube").maybeSingle();
  if (accountError || !account || account.connection_status !== "connected") {
    return json(409, { error: "Connect YouTube for this podcast before starting an upload." });
  }
  const { data: rows, error: tokenError } = await service.rpc("distribution_oauth_get_youtube_token", { p_account_id: account.id, p_user_id: user.id });
  const token = Array.isArray(rows) ? rows[0] : rows;
  if (tokenError || !token?.access_token_ciphertext) return json(409, { error: "No encrypted YouTube access token is available. Reconnect YouTube." });
  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now() + 90_000) {
    return json(409, { error: "The YouTube access token is near expiry. Use Test token refresh, then try again." });
  }

  let accessToken: string;
  try { accessToken = await decryptToken(token.access_token_ciphertext); }
  catch { return json(500, { error: "Could not decrypt the YouTube access token. Check the configured encryption key." }); }

  const metadata = {
    snippet: {
      title,
      description: description || "A CrowRules Podcasting episode.",
      tags,
      categoryId: "22",
    },
    status: {
      privacyStatus: "private",
      selfDeclaredMadeForKids: false,
    },
  };
  const session = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(fileSize),
    },
    body: JSON.stringify(metadata),
  });
  if (!session.ok) {
    const providerText = await session.text();
    return json(session.status === 401 ? 409 : 502, {
      error: session.status === 401
        ? "YouTube rejected the access token. Refresh the token and retry."
        : "YouTube could not start the resumable upload session.",
      provider_status: session.status,
      provider_message: providerText.slice(0, 700),
    });
  }
  const uploadUrl = session.headers.get("Location");
  if (!uploadUrl || !uploadUrl.startsWith("https://")) return json(502, { error: "YouTube did not return a secure resumable upload URL." });

  const uploadSession = { url: uploadUrl, user_id: user.id, podcast_id: podcastId, file_size: fileSize, mime_type: mimeType, expires_at: Date.now() + 60 * 60 * 1000, filename };
  const uploadToken = await signUploadSession(uploadSession);
  return json(200, { ok: true, upload_session: uploadToken, privacy_status: "private", podcast_title: podcast.title, filename, chunk_size: 8 * 1024 * 1024, message: "Upload session created. No video bytes have been uploaded yet. The video will remain private." });
});
