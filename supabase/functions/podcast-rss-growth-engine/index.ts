import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";
const FROM = Deno.env.get("PODCAST_EMAIL_FROM") || "CrowRules Podcasting <onboarding@resend.dev>";
const SITE = "https://crowrulesentertainment-oss.github.io/podcasting/";
const FN_BASE = URL + "/functions/v1/";
const CORS = {
  "Access-Control-Allow-Origin": "https://crowrulesentertainment-oss.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-podcast-email-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store"
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
const esc = (v: unknown) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

function localClock(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || "";
  const weekdays: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return {
    weekday: weekdays[get("weekday")] ?? -1,
    dateKey: get("year") + "-" + get("month") + "-" + get("day"),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}
function containsWeekly(frequency: string) { return frequency === "weekly" || frequency === "weekly_and_new_episode"; }
function containsNewEpisode(frequency: string) { return frequency === "new_episode" || frequency === "weekly_and_new_episode"; }

async function creatorShows(db: any, userId: string) {
  const { data: member, error: me } = await db.from("members").select("id").eq("user_id", userId).maybeSingle();
  if (me) throw me;
  if (!member) throw new Error("A CrowRules member profile is required.");
  const { data: creator, error: ce } = await db.from("creators").select("id").eq("member_id", member.id).maybeSingle();
  if (ce) throw ce;
  if (!creator) throw new Error("A creator profile is required.");
  const { data: shows, error: se } = await db.from("podcasts").select("id,title,description,website_url,artwork_url,creator_id").eq("creator_id", creator.id);
  if (se) throw se;
  return shows || [];
}
async function getLatestEpisode(db: any, podcastId: string) {
  const { data, error } = await db.from("podcast_episodes")
    .select("id,title,description,published_at,audio_url,access_level,is_published,status")
    .eq("podcast_id", podcastId).eq("status", "published").eq("is_published", true)
    .eq("access_level", "free").not("audio_url", "is", null)
    .order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
async function makeCampaign(db: any, show: any, setting: any, trigger: "weekly"|"new_episode"|"manual", runKey: string, episode: any, actorId?: string) {
  const subject = episode ? "New episode: " + episode.title + " — " + show.title : "This week on " + show.title;
  const episodeUrl = show.website_url || SITE;
  const bodyText = episode
    ? (episode.description || show.description || "A new episode is available now.") + "\n\nListen: " + episodeUrl
    : (show.description || "Catch up with the latest from " + show.title + ".") + "\n\nListen: " + episodeUrl + "\nRSS feed: " + URL + "/functions/v1/podcast-rss?show=" + show.id;
  const { data: campaign, error: ce } = await db.from("podcast_rss_growth_campaigns").insert({
    podcast_id: show.id, trigger_type: trigger, run_key: runKey, episode_id: episode?.id || null,
    subject, body_text: bodyText, status: "processing"
  }).select("*").single();
  if (ce) {
    if (ce.code === "23505") return { skipped: true, reason: "already_processed" };
    throw ce;
  }

  let sent = 0, failed = 0, recipientCount = 0;
  if (setting.email_enabled && !RESEND) {
    await db.from("podcast_rss_growth_campaigns").update({ status: "failed", failed_count: 1, completed_at: new Date().toISOString() }).eq("id", campaign.id);
    throw new Error("Email delivery is not configured. Add the Resend API key to Supabase Edge Function secrets.");
  }
  if (setting.email_enabled && RESEND) {
    const { data: follows, error: fe } = await db.from("podcast_follows").select("user_id").eq("podcast_id", show.id);
    if (fe) throw fe;
    const followerIds = [...new Set((follows || []).map((x: any) => x.user_id).filter(Boolean))];
    if (followerIds.length) {
      const { data: consents, error: me } = await db.from("podcast_marketing_consents")
        .select("user_id").in("user_id", followerIds).eq("consented", true).is("unsubscribed_at", null);
      if (me) throw me;
      const allowed = new Set((consents || []).map((x: any) => x.user_id));
      for (const userId of followerIds) {
        if (!allowed.has(userId)) continue;
        const { data: delivery, error: de } = await db.from("podcast_rss_growth_deliveries").insert({
          campaign_id: campaign.id, recipient_user_id: userId, recipient_email: "pending@invalid.local", status: "queued"
        }).select("id").single();
        if (de) {
          if (de.code === "23505") continue;
          throw de;
        }
        let email = "";
        try {
          const { data: userData, error: ue } = await db.auth.admin.getUserById(userId);
          if (ue) throw ue;
          email = userData?.user?.email || "";
          if (!email) throw new Error("No verified account email is available.");
          await db.from("podcast_rss_growth_deliveries").update({ recipient_email: email }).eq("id", delivery.id);
          const rawToken = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2,"0")).join("");
          const tokenBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
          const tokenHash = [...new Uint8Array(tokenBytes)].map(x => x.toString(16).padStart(2,"0")).join("");
          const { error: tokenError } = await db.from("podcast_marketing_unsubscribe_tokens").insert({ token_hash: tokenHash, user_id: userId });
          if (tokenError) throw tokenError;
          const unsubscribe = FN_BASE + "podcasting-marketing-preferences?token=" + rawToken;
          const feed = FN_BASE + "podcast-rss?show=" + show.id;
          const html = '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#090a0d;color:#f4f4f5;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#17191f"><tr><td style="padding:28px"><p style="font-size:12px;line-height:18px;color:#d8b45a;font-weight:bold;letter-spacing:2px">CROWRULES PODCASTING</p><h1 style="font-size:26px;line-height:34px;color:#ffffff">'+esc(subject)+'</h1><p style="font-size:16px;line-height:25px;color:#d1d5db">'+esc(bodyText).replaceAll("\n","<br>")+'</p><p><a href="'+esc(episodeUrl)+'" style="display:inline-block;padding:12px 18px;background:#d8b45a;color:#111111;text-decoration:none;font-weight:bold">LISTEN NOW</a></p><p style="font-size:13px;line-height:20px;color:#a1a1aa">Follow the show with its <a href="'+esc(feed)+'" style="color:#e7c46d">RSS feed</a>.</p><hr style="border:0;border-top:1px solid #343741"><p style="font-size:12px;line-height:18px;color:#a1a1aa">You receive this because you follow this podcast and opted in to CrowRules promotional emails. <a href="'+esc(unsubscribe)+'" style="color:#e7c46d">Unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>';
          const textBody = subject + "\n\n" + bodyText + "\n\nListen: " + episodeUrl + "\nRSS: " + feed + "\n\nUnsubscribe: " + unsubscribe;
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": "Bearer " + RESEND, "Content-Type": "application/json", "Idempotency-Key": "cr-rss-growth-" + campaign.id + "-" + userId },
            body: JSON.stringify({
              from: FROM, to: [email], subject, html, text: textBody,
              headers: { "List-Unsubscribe": "<" + unsubscribe + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
              tags: [{ name: "product", value: "crowrules-podcasting" }, { name: "campaign_id", value: campaign.id }]
            })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error("Resend HTTP " + response.status + ": " + String(result.message || result.name || "send failed").slice(0,300));
          await db.from("podcast_rss_growth_deliveries").update({ status: "sent", provider_message_id: result.id || null, sent_at: new Date().toISOString() }).eq("id", delivery.id);
          sent++;
        } catch (err) {
          await db.from("podcast_rss_growth_deliveries").update({ status: "failed", recipient_email: email || "pending@invalid.local", error_message: String(err?.message || err).slice(0,1000) }).eq("id", delivery.id);
          failed++;
        }
      }
    }
  }
  if (setting.social_enabled) {
    const rss = FN_BASE + "podcast-rss?show=" + show.id;
    const post = episode
      ? "New episode from " + show.title + ": " + episode.title + "\n\n" + (episode.description || show.description || "") + "\n\nListen: " + episodeUrl + "\nFollow the RSS feed: " + rss + "\n\n#CrowRulesPodcasting #Podcast"
      : "This week on " + show.title + "\n\n" + (show.description || "Catch up with the latest episodes.") + "\n\nListen: " + episodeUrl + "\nSubscribe via RSS: " + rss + "\n\n#CrowRulesPodcasting #Podcast";
    await db.from("podcast_rss_growth_social_drafts").upsert({ campaign_id: campaign.id, podcast_id: show.id, platform: "general", post_text: post, status: "draft" }, { onConflict: "campaign_id,platform" });
  }
  const { count } = await db.from("podcast_rss_growth_deliveries").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id);
  recipientCount = count || 0;
  const status = failed && sent ? "partial" : failed ? "failed" : recipientCount ? "completed" : "no_recipients";
  await db.from("podcast_rss_growth_campaigns").update({
    recipient_count: recipientCount, sent_count: sent, failed_count: failed,
    status, completed_at: new Date().toISOString()
  }).eq("id", campaign.id);
  await db.from("podcast_rss_growth_settings").update({
    last_run_at: new Date().toISOString(),
    ...(episode?.id ? { last_promoted_episode_id: episode.id } : {})
  }).eq("podcast_id", show.id);
  return { campaign_id: campaign.id, status, recipients: recipientCount, sent, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://crowrulesentertainment-oss.github.io") return json({ error: "Origin not allowed." }, 403);
  if (!URL || !SERVICE || !ANON) return json({ error: "Automation service is not configured." }, 503);
  const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  let input: any;
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }

  if (input.action === "tick") {
    const supplied = req.headers.get("x-podcast-email-worker-secret") || "";
    if (!supplied) return json({ error: "Worker authentication required." }, 401);
    const { data: verified, error: verifyError } = await db.rpc("verify_podcast_email_worker_secret", { candidate: supplied });
    if (verifyError || verified !== true) return json({ error: "Worker authentication failed." }, 401);
    const { data: settings, error } = await db.from("podcast_rss_growth_settings").select("*").eq("enabled", true).neq("frequency", "manual").limit(100);
    if (error) return json({ error: "Could not load due schedules." }, 500);
    const results: any[] = [];
    const now = new Date();
    for (const setting of settings || []) {
      try {
        const clock = localClock(now, setting.timezone || "America/Los_Angeles");
        const weeklyDue = containsWeekly(setting.frequency) && clock.weekday === setting.weekday && clock.hour === Number(String(setting.send_time).slice(0,2)) && clock.minute === Number(String(setting.send_time).slice(3,5));
        const show = (await db.from("podcasts").select("id,title,description,website_url,artwork_url,status").eq("id", setting.podcast_id).maybeSingle()).data;
        if (!show || show.status !== "published") continue;
        const episode = await getLatestEpisode(db, show.id);
        const episodeIsNew = !!episode?.id && (setting.last_promoted_episode_id
          ? episode.id !== setting.last_promoted_episode_id
          : !!episode.published_at && new Date(episode.published_at).getTime() > new Date(setting.updated_at).getTime());
        const episodeDue = containsNewEpisode(setting.frequency) && episodeIsNew;
        if (weeklyDue) results.push({ podcast_id: show.id, ...(await makeCampaign(db, show, setting, "weekly", show.id + ":weekly:" + clock.dateKey, episode, undefined)) });
        else if (episodeDue) results.push({ podcast_id: show.id, ...(await makeCampaign(db, show, setting, "new_episode", show.id + ":episode:" + episode.id, episode, undefined)) });
      } catch (err) { results.push({ podcast_id: setting.podcast_id, error: String(err?.message || err).slice(0,500) }); }
    }
    return json({ ok: true, checked: (settings || []).length, results });
  }

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer) return json({ error: "Sign in required." }, 401);
  const auth = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(bearer);
  if (authError || !authData?.user) return json({ error: "Your session is invalid or expired." }, 401);
  const userId = authData.user.id;
  let shows: any[];
  try { shows = await creatorShows(db, userId); } catch (err) { return json({ error: String(err?.message || err) }, 403); }
  const showIds = shows.map(x => x.id);

  if (input.action === "history") {
    const podcastId = String(input.podcast_id || "");
    if (!showIds.includes(podcastId)) return json({ error: "That show does not belong to your creator account." }, 403);
    const { data: campaigns, error } = await db.from("podcast_rss_growth_campaigns").select("id,trigger_type,subject,recipient_count,sent_count,failed_count,status,started_at,completed_at").eq("podcast_id", podcastId).order("started_at", { ascending: false }).limit(10);
    if (error) return json({ error: "Could not load promotion history." }, 500);
    const ids = (campaigns || []).map((x: any) => x.id);
    const { data: drafts } = ids.length ? await db.from("podcast_rss_growth_social_drafts").select("id,campaign_id,platform,post_text,status,created_at").in("campaign_id", ids).order("created_at", { ascending: false }) : { data: [] };
    return json({ campaigns: campaigns || [], drafts: drafts || [] });
  }

  if (input.action === "run_now") {
    const podcastId = String(input.podcast_id || "");
    if (!showIds.includes(podcastId)) return json({ error: "That show does not belong to your creator account." }, 403);
    const { data: setting, error: settingError } = await db.from("podcast_rss_growth_settings").select("*").eq("podcast_id", podcastId).maybeSingle();
    if (settingError) return json({ error: "Could not load show promotion settings." }, 500);
    const show = shows.find(x => x.id === podcastId);
    if (shows.find(x => x.id === podcastId)?.status !== "published") return json({ error: "Publish this show before promoting it." }, 400);
    if (!setting || (!setting.email_enabled && !setting.social_enabled)) return json({ error: "Turn on email or social promotion before sending." }, 400);
    const episode = await getLatestEpisode(db, podcastId);
    try {
      const result = await makeCampaign(db, show, setting, "manual", podcastId + ":manual:" + crypto.randomUUID(), episode);
      return json({ ok: true, ...result });
    } catch (err) { return json({ error: String(err?.message || err).slice(0,500) }, 500); }
  }
  return json({ error: "Unsupported action." }, 400);
});
