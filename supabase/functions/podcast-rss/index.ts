import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};
const xml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
}[c] as string));
const cdata = (value: unknown) => String(value ?? "").replace(/]]>/g, "]]]]><![CDATA[>");
const cleanUrl = (value: unknown) => {
  const raw = String(value ?? "").trim();
  try { const u = new URL(raw); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : ""; } catch { return ""; }
};
const mimeFallback = (filename: string) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ({ mp3:"audio/mpeg", m4a:"audio/mp4", wav:"audio/wav", aac:"audio/aac", ogg:"audio/ogg", opus:"audio/ogg", flac:"audio/flac" } as Record<string,string>)[ext || ""] || "audio/mpeg";
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: cors });
  try {
    const url = new URL(req.url);
    const identifier = url.searchParams.get("show")?.trim();
    if (!identifier) return new Response("Missing show identifier", { status: 400, headers: { ...cors, "Content-Type":"text/plain; charset=utf-8" } });
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const secret = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !secret) throw new Error("Server configuration is incomplete.");
    const db = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const showQuery = db.from("podcasts").select("id,title,slug,description,category,artwork_url,website_url,author_name,author_email,language,copyright,explicit_content,status,rss_url,created_at").eq("status","published");
    const { data: show, error: showError } = await (byId ? showQuery.eq("id", identifier) : showQuery.eq("slug", identifier)).maybeSingle();
    if (showError) throw showError;
    if (!show) return new Response("Podcast not found or not published", { status: 404, headers: { ...cors, "Content-Type":"text/plain; charset=utf-8" } });
    const { data: episodes, error: episodesError } = await db.from("podcast_episodes")
      .select("id,title,description,episode_number,season_number,published_at,release_date,duration_seconds,audio_url,thumbnail_url,artwork_url,show_notes,transcript,tags,is_explicit,status,is_published,access_level,created_at")
      .eq("podcast_id", show.id).eq("status","published").eq("is_published",true)
      .eq("access_level","free").order("published_at",{ascending:false});
    if (episodesError) throw episodesError;
    const episodeIds = (episodes || []).map((e: any) => e.id);
    const mediaByEpisode = new Map<string, any[]>();
    if (episodeIds.length) {
      const { data: media, error: mediaError } = await db.from("podcast_episode_media")
        .select("episode_id,media_type,original_filename,mime_type,size_bytes,public_url,sort_order")
        .in("episode_id", episodeIds).order("sort_order",{ascending:true});
      if (mediaError) throw mediaError;
      for (const item of media || []) {
        if (!mediaByEpisode.has(item.episode_id)) mediaByEpisode.set(item.episode_id, []);
        mediaByEpisode.get(item.episode_id)!.push(item);
      }
    }
    const base = supabaseUrl.replace(/\/$/,"");
    const feedUrl = cleanUrl(show.rss_url) || base + "/functions/v1/podcast-rss?show=" + encodeURIComponent(show.id);
    const site = cleanUrl(show.website_url) || feedUrl;
    const artwork = cleanUrl(show.artwork_url);
    const title = xml(show.title);
    const items = (episodes || []).map((episode: any) => {
      const media = (mediaByEpisode.get(episode.id) || []).find((m: any) => String(m.media_type || "").toLowerCase() === "audio" && cleanUrl(m.public_url))
        || (mediaByEpisode.get(episode.id) || []).find((m: any) => String(m.mime_type || "").startsWith("audio/") && cleanUrl(m.public_url));
      const audioUrl = cleanUrl(media?.public_url) || cleanUrl(episode.audio_url);
      if (!audioUrl) return "";
      const mime = String(media?.mime_type || "").startsWith("audio/") ? media.mime_type : mimeFallback(media?.original_filename || audioUrl);
      const length = Number(media?.size_bytes) > 0 ? Number(media.size_bytes) : await fetch(audioUrl, { method: "HEAD" }).then((response) => Number(response.headers.get("content-length")) || 0).catch(() => 0);
      const pubDate = new Date(episode.published_at || episode.release_date || episode.created_at || Date.now()).toUTCString();
      const desc = episode.description || episode.show_notes || "";
      const image = cleanUrl(episode.thumbnail_url || episode.artwork_url) || artwork;
      const duration = Number(episode.duration_seconds) > 0 ? "<itunes:duration>" + Math.floor(Number(episode.duration_seconds)) + "</itunes:duration>" : "";
      const imageTag = image ? '<itunes:image href="' + xml(image) + '"/>' : "";
      const tags = Array.isArray(episode.tags) ? episode.tags.map((tag: string) => "<category>" + xml(tag) + "</category>").join("") : "";
      const transcript = episode.transcript ? '<content:encoded><![CDATA[' + cdata(desc + "\n\n" + episode.transcript) + "]]></content:encoded>" : "";
      return "<item><title>" + xml(episode.title) + "</title><guid isPermaLink=\"false\">" + xml(episode.id) + "</guid><link>" + xml(site) + "</link><description><![CDATA[" + cdata(desc) + "]]></description><pubDate>" + pubDate + "</pubDate><enclosure url=\"" + xml(audioUrl) + "\" length=\"" + length + "\" type=\"" + xml(mime) + "\"/>" + duration + imageTag + "<itunes:explicit>" + (episode.is_explicit ? "true" : "false") + "</itunes:explicit>" + (episode.episode_number ? "<itunes:episode>" + Number(episode.episode_number) + "</itunes:episode>" : "") + (episode.season_number ? "<itunes:season>" + Number(episode.season_number) + "</itunes:season>" : "") + tags + transcript + "</item>";
    }).filter(Boolean).join("");
    const validCategories = ["Arts","Business","Comedy","Education","Fiction","Government","Health & Fitness","History","Kids & Family","Leisure","Music","News","Religion & Spirituality","Science","Society & Culture","Sports","Technology","True Crime","TV & Film"];
    const rawCategory = String(show.category || "").trim();
    const categoryAliases: Record<string,string> = { "talk & commentary":"Society & Culture", "news & politics":"News", "health":"Health & Fitness", "technology & science":"Technology", "tv and film":"TV & Film" };
    const rssCategory = validCategories.find((item) => item.toLowerCase() === rawCategory.toLowerCase()) || categoryAliases[rawCategory.toLowerCase()] || "";
    const generated = new Date().toUTCString();
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>' + title + "</title><link>" + xml(site) + "</link><description><![CDATA[" + cdata(show.description || "") + "]]></description><language>" + xml(show.language || "en-us") + "</language><copyright>" + xml(show.copyright || "") + "</copyright><lastBuildDate>" + generated + "</lastBuildDate><generator>CrowRules Podcasting Hosting</generator><itunes:author>" + xml(show.author_name || show.title) + "</itunes:author><itunes:summary><![CDATA[" + cdata(show.description || "") + "]]></itunes:summary><itunes:explicit>" + (show.explicit_content ? "true" : "false") + "</itunes:explicit>" + (artwork ? '<itunes:image href="' + xml(artwork) + '"/>' : "") + (rssCategory ? '<itunes:category text="' + xml(rssCategory) + '"/>' : "") + items + "</channel></rss>";
    const headers = { ...cors, "ETag": '"' + await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)).then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2,"0")).join("")) + '"' };
    if (req.method === "HEAD") return new Response(null, { status: 200, headers });
    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error("podcast-rss error:", error);
    return new Response("RSS feed temporarily unavailable", { status: 500, headers: { ...cors, "Content-Type":"text/plain; charset=utf-8", "Cache-Control":"no-store" } });
  }
});