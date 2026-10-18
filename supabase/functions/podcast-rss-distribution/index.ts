import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const https = (value: unknown): value is string => {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  } catch { return false; }
};
const typeOf = (r: Response) => (r.headers.get("content-type") || "").toLowerCase();
const sha1 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "POST required." });
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") || "";
  if (!url || !anon || !service || !authorization.startsWith("Bearer ")) return reply(401, { error: "Sign in to manage distribution." });
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return reply(401, { error: "Your session could not be verified. Sign in again." });
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await req.json();
    const action = String(body.action || "preflight");
    const podcastId = String(body.podcast_id || "");
    if (!podcastId) return reply(400, { error: "podcast_id is required." });
    const { data: manager, error: managerError } = await db.from("podcast_creators").select("id")
      .eq("podcast_id", podcastId).eq("user_id", user.id).eq("can_manage", true).maybeSingle();
    if (managerError) throw managerError;
    if (!manager) return reply(403, { error: "You do not have distribution-management access to this podcast." });
    const { data: p, error: pe } = await db.from("podcasts")
      .select("id,title,slug,description,artwork_url,website_url,rss_url,status,category,author_name,author_email,language")
      .eq("id", podcastId).maybeSingle();
    if (pe) throw pe;
    if (!p) return reply(404, { error: "Podcast not found." });
    const feedUrl = https(p.rss_url) ? p.rss_url : new URL("/functions/v1/podcast-rss?slug=" + encodeURIComponent(p.slug), url).toString();

    const event = async (platform: string, event_type: string, outcome: string, message: string, details: Record<string, unknown> = {}) => {
      const { error } = await db.from("podcast_distribution_events").insert({ podcast_id: p.id, user_id: user.id, platform, event_type, outcome, message, details });
      if (error) console.error("Distribution event insert failed:", error.message);
    };
    const preflight = async () => {
      const checks: Array<{ key: string; label: string; status: string; detail: string }> = [];
      const check = (key: string, label: string, ok: boolean, detail: string, warning = false) =>
        checks.push({ key, label, status: ok ? "ready" : warning ? "warning" : "needs_attention", detail });
      check("published", "Podcast published", p.status === "published", "Publish the show in CrowRules before external submission.");
      check("title", "Podcast title", Boolean(p.title?.trim()), "Add a public title.");
      check("description", "Description", Boolean(p.description?.trim() && p.description.trim().length >= 20), "Add a description of at least 20 characters.");
      check("author", "Host / author", Boolean(p.author_name?.trim()), "Set the public author name.");
      check("email", "Contact email", Boolean(p.author_email?.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.author_email)), "Add a valid public contact email.");
      check("language", "Language", Boolean(p.language?.trim()), "Set a language tag such as en-us.");
      check("category", "Category", Boolean(p.category?.trim()), "Choose a podcast category.");
      check("website", "HTTPS website", https(p.website_url), "Add a public HTTPS website.");
      check("artwork", "HTTPS artwork", https(p.artwork_url), "Add public HTTPS cover artwork.");
      let xml = "";
      try {
        if (!https(feedUrl)) throw new Error("Feed URL must use HTTPS.");
        const r = await fetch(feedUrl, { headers: { Accept: "application/rss+xml, application/xml, text/xml" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
        xml = await r.text();
        check("feed_http", "Public RSS endpoint", r.ok && /xml|rss/i.test(typeOf(r)), r.ok ? "Content type: " + (typeOf(r) || "unknown") : "HTTP " + r.status);
        check("feed_size", "Feed response size", xml.length > 100 && xml.length < 5000000, "Feed must be non-empty and under 5 MB.");
      } catch (e) {
        check("feed_http", "Public RSS endpoint", false, "Could not fetch feed: " + (e instanceof Error ? e.message : "network error"));
      }
      const channel = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i)?.[1] || "";
      const items = [...channel.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
      const enclosures = items.map((item) => {
        const tag = item.match(/<enclosure\b[^>]*>/i)?.[0] || "";
        return { url: tag.match(/\burl=["']([^"']+)["']/i)?.[1] || "", length: tag.match(/\blength=["']([^"']+)["']/i)?.[1] || "", type: tag.match(/\btype=["']([^"']+)["']/i)?.[1] || "" };
      });
      check("xml", "RSS 2.0 structure", /<rss\b/i.test(xml) && Boolean(channel), "Feed must be parseable RSS 2.0 XML.");
      check("feed_title", "Feed title", /<title\b[^>]*>[\s\S]*?\S/i.test(channel), "Add a non-empty channel title.");
      check("feed_description", "Feed description", /<description\b[^>]*>[\s\S]*?\S/i.test(channel), "Add a non-empty channel description.");
      check("episodes", "Published episodes", items.length > 0, "Publish at least one episode.");
      check("enclosures", "Audio enclosure metadata", enclosures.length === items.length && enclosures.length > 0 && enclosures.every((e) => https(e.url) && Number(e.length) > 0 && /^audio\//i.test(e.type)), "Every public episode needs enclosure URL, byte length, and MIME type.");
      check("guid", "Stable episode GUIDs", items.length > 0 && items.every((i) => /<guid\b[^>]*>[\s\S]*?\S/i.test(i)), "Every episode needs a stable GUID.");
      check("pubdate", "Episode publication dates", items.length > 0 && items.every((i) => /<pubDate\b[^>]*>[\s\S]*?\S/i.test(i)), "Add a valid pubDate to every episode.", true);
      if (https(p.artwork_url)) {
        try {
          const r = await fetch(p.artwork_url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
          check("artwork_reachable", "Artwork reachable", r.ok && typeOf(r).startsWith("image/"), "Artwork should respond to HEAD with an image content type.");
        } catch { check("artwork_reachable", "Artwork reachable", false, "Artwork URL could not be reached."); }
      } else check("artwork_reachable", "Artwork reachable", false, "Add artwork first.");
      const audio = await Promise.all(enclosures.slice(0, 8).map(async (e) => {
        if (!https(e.url)) return false;
        try {
          const r = await fetch(e.url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
          const ct = typeOf(r); const audioExtension = /\.(mp3|m4a|aac|ogg|opus|wav)(\?|$)/i.test(e.url); return r.ok && (ct.startsWith("audio/") || (ct.startsWith("application/octet-stream") && audioExtension));
        } catch { return false; }
      }));
      check("audio_reachable", "Audio URL accessibility", enclosures.length > 0 && audio.length === Math.min(enclosures.length, 8) && audio.every(Boolean),
        enclosures.length > 8 ? "Checked first 8 of " + enclosures.length + " enclosure URLs." : "Each audio enclosure should respond to HEAD as audio.");
      const blocking = checks.filter((c) => c.status === "needs_attention").length;
      return { feed_url: feedUrl, checks, ready: blocking === 0, ready_count: checks.filter((c) => c.status === "ready").length, attention_count: blocking, checked_at: new Date().toISOString() };
    };

    if (action === "preflight") {
      const report = await preflight();
      await event("rss", "preflight", report.ready ? "success" : "warning", report.ready ? "RSS preflight passed." : "RSS preflight found issues.", { feed_url: report.feed_url, checks: report.checks });
      return reply(200, { ok: true, report, integrations: {
        podcast_index: { configured: Boolean(Deno.env.get("PODCAST_INDEX_API_KEY") && Deno.env.get("PODCAST_INDEX_API_SECRET")), supported: true },
        apple_podcasts: { mode: "manual", url: "https://podcastsconnect.apple.com/my-podcasts/new-feed?submitfeed=" + encodeURIComponent(report.feed_url) },
        spotify: { mode: "manual", url: "https://creators.spotify.com/" },
        youtube_music: { mode: "manual", url: "https://studio.youtube.com/" },
        amazon_music: { mode: "manual", url: "https://podcasters.amazon.com/" },
      } });
    }

    if (action === "submit_podcast_index") {
      const report = await preflight();
      if (!report.ready) {
        await event("podcast_index", "submission_failed", "warning", "Submission blocked by RSS preflight.", { feed_url: report.feed_url, checks: report.checks });
        return reply(409, { error: "RSS feed needs attention before submission.", report });
      }
      const key = Deno.env.get("PODCAST_INDEX_API_KEY");
      const secret = Deno.env.get("PODCAST_INDEX_API_SECRET");
      if (!key || !secret) {
        await event("podcast_index", "submission_failed", "warning", "Podcast Index write API credentials are not configured.");
        return reply(409, { error: "Podcast Index API is not configured. Add PODCAST_INDEX_API_KEY and PODCAST_INDEX_API_SECRET as Supabase Edge Function secrets. No submission was sent.", integration_configured: false, report });
      }
      await event("podcast_index", "submission_started", "pending", "Submitting feed to Podcast Index.", { feed_url: report.feed_url });
      const date = Math.floor(Date.now() / 1000).toString();
      const authHash = await sha1(key + secret + date);
      const endpoint = new URL("https://api.podcastindex.org/api/1.0/add/byfeedurl");
      endpoint.searchParams.set("url", report.feed_url);
      const response = await fetch(endpoint, { headers: {
        "User-Agent": "CrowRulesPodcasting/1.0",
        "X-Auth-Key": key, "X-Auth-Date": date, "Authorization": authHash,
      }, signal: AbortSignal.timeout(15000) });
      const provider = await response.json().catch(() => ({}));
      if (!response.ok || provider?.status !== "true") {
        const message = String(provider?.description || provider?.message || "Podcast Index did not confirm submission.");
        await event("podcast_index", "submission_failed", "error", message, { http_status: response.status, provider_status: provider?.status || null });
        return reply(502, { error: message, provider_confirmed: false });
      }
      const feedId = provider?.feedId == null ? "" : String(provider.feedId);
      const listingUrl = feedId ? "https://podcastindex.org/podcast/" + encodeURIComponent(feedId) : null;
      const message = "Podcast Index API confirmed submission." + (feedId ? " Feed ID: " + feedId + "." : "");
      const { error: se } = await db.from("podcast_distribution_status").upsert({
        podcast_id: p.id, platform: "podcast_index", status: "submitted", submission_url: "https://podcastindex.org/add",
        external_url: listingUrl, notes: message, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "podcast_id,platform" });
      if (se) throw se;
      await event("podcast_index", "submission_confirmed", "success", message, { feed_url: report.feed_url, provider_feed_id: feedId || null });
      return reply(200, { ok: true, provider_confirmed: true, platform: "podcast_index", feed_id: feedId || null, listing_url: listingUrl, message });
    }

    if (action === "record_manual") {
      const platform = String(body.platform || "");
      const status = String(body.status || "");
      const platforms = new Set(["spotify","apple_podcasts","amazon_music","youtube_music","iheart","tunein","podcast_index","pocket_casts","castbox","overcast","goodpods","podcast_addict","podchaser","listen_notes","player_fm","deezer","radio_public"]);
      const statuses = new Set(["not_submitted","preparing","submitted","listed","needs_attention","rejected"]);
      if (!platforms.has(platform) || !statuses.has(status)) return reply(400, { error: "Unsupported platform or status." });
      const submission_url = body.submission_url == null ? null : String(body.submission_url);
      const external_url = body.external_url == null ? null : String(body.external_url);
      if ([submission_url, external_url].some((v) => v && !https(v))) return reply(400, { error: "Submission and listing URLs must be valid HTTPS URLs." });
      const notes = String(body.notes || "").slice(0, 4000);
      const { error: se } = await db.from("podcast_distribution_status").upsert({
        podcast_id: p.id, platform, status, submission_url, external_url, notes,
        updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "podcast_id,platform" });
      if (se) throw se;
      await event(platform, "manual_status_updated", "success", "Manual directory tracking status updated.", { status, submission_url, external_url });
      return reply(200, { ok: true, message: "Directory tracking status saved." });
    }

    if (action === "history") {
      const { data, error } = await db.from("podcast_distribution_events").select("id,platform,event_type,outcome,message,details,created_at")
        .eq("podcast_id", p.id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return reply(200, { ok: true, events: data || [] });
    }
    return reply(400, { error: "Unsupported action." });
  } catch (e) {
    console.error("podcast-rss-distribution failed:", e instanceof Error ? e.message : "unknown error");
    return reply(500, { error: "Distribution request failed. Check Edge Function logs." });
  }
});
