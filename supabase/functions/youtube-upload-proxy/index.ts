import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-upload-session, content-range, x-upload-total, x-upload-mime",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST required." });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!supabaseUrl || !anonKey) return json(503, { error: "Upload proxy is not configured." });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json(401, { error: "Sign in required." });
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return json(401, { error: "Your session expired. Sign in again." });
  const uploadUrl = req.headers.get("x-upload-session") || "";
  let url: URL;
  try { url = new URL(uploadUrl); } catch { return json(400, { error: "Upload session URL is invalid." }); }
  if (url.protocol !== "https:" || url.hostname !== "www.googleapis.com" || url.pathname !== "/upload/youtube/v3/videos" || url.searchParams.get("uploadType") !== "resumable") return json(400, { error: "Upload URL did not pass Google YouTube endpoint validation." });
  const range = req.headers.get("Content-Range") || "";
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
  if (!match) return json(400, { error: "A valid Content-Range header is required." });
  const start = Number(match[1]), end = Number(match[2]), total = Number(match[3]);
  const expectedTotal = Number(req.headers.get("x-upload-total") || 0);
  const contentLength = end - start + 1;
  if (total !== expectedTotal || start < 0 || end < start || end >= total || contentLength > 8 * 1024 * 1024 || (start % (256 * 1024) !== 0) || (end + 1 < total && contentLength % (256 * 1024) !== 0)) {
    return json(400, { error: "Chunk range is invalid. Use aligned chunks up to 8 MiB." });
  }
  const mimeType = req.headers.get("x-upload-mime") || "";
  if (!/^video\\/[a-zA-Z0-9.+-]+$/.test(mimeType)) return json(400, { error: "Invalid video MIME type." });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength !== contentLength) return json(400, { error: "Chunk body length does not match Content-Range." });
  const response = await fetch(String(session.url), {
    method: "PUT",
    headers: { "Content-Type": mimeType, "Content-Length": String(contentLength), "Content-Range": range },
    body: bytes,
  });
  const responseText = await response.text();
  let provider: Record<string, unknown> = {};
  try { provider = JSON.parse(responseText); } catch {}
  if (response.status === 308) {
    return json(200, { ok: true, complete: false, received_range: response.headers.get("Range") || null, message: "Chunk accepted by YouTube." });
  }
  if (response.status === 200 || response.status === 201) {
    return json(200, { ok: true, complete: true, video_id: String(provider.id || ""), title: String((provider.snippet as Record<string, unknown> | undefined)?.title || ""), privacy_status: String((provider.status as Record<string, unknown> | undefined)?.privacyStatus || "private"), message: "YouTube accepted the video upload." });
  }
  return json(response.status === 401 ? 409 : 502, { error: "YouTube rejected an upload chunk.", provider_status: response.status, provider_message: responseText.slice(0, 600) });
});