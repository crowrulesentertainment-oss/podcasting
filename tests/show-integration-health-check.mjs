import { chromium, request as playwrightRequest } from "playwright";

const BASE = "https://crowrulesentertainment-oss.github.io/podcasting/";
const SHOW_ID = process.env.CROWRULES_SHOW_ID || "e25de27a-18f0-481f-9bad-f957cd68ea58";
const TIMEOUT = 45_000;
const failures = [];
const notes = [];
const pass = message => console.log("PASS: " + message);
const fail = message => failures.push(message);
const note = message => notes.push(message);

const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", e => fail("Browser page error: " + e.message));
page.on("console", msg => {
  if (msg.type() === "error" && /\[CrowRules show\]/i.test(msg.text())) note("Show-page console diagnostic: " + msg.text());
});

try {
  await page.goto(BASE + "listener/show.html?id=" + encodeURIComponent(SHOW_ID) + "&integrationHealth=" + Date.now(), {
    waitUntil: "domcontentloaded", timeout: TIMEOUT
  });
  await page.waitForFunction(() => window.supabase?.createClient && window.CROW_CONFIG?.supabaseUrl && window.CROW_CONFIG?.supabaseKey, null, { timeout: TIMEOUT });
  await page.waitForSelector("#episodeList", { timeout: TIMEOUT });
  await page.waitForSelector("#subscribe", { timeout: TIMEOUT });

  const data = await page.evaluate(async ({ showId }) => {
    const db = window.supabase.createClient(window.CROW_CONFIG.supabaseUrl, window.CROW_CONFIG.supabaseKey);
    const showQuery = await db.from("podcasts").select("id,title,total_plays,artwork_url").eq("id", showId).maybeSingle();
    if (showQuery.error) throw new Error("Show query failed: " + showQuery.error.message);
    if (!showQuery.data) throw new Error("Show not visible to public client: " + showId);

    const episodes = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const batch = await db.from("podcast_episodes")
        .select("id,podcast_id,title,status,is_published,is_active,audio_url,video_url,play_count,published_at,created_at")
        .eq("podcast_id", showId).eq("status", "published").range(offset, offset + 99);
      if (batch.error) throw new Error("Published episode query failed: " + batch.error.message);
      episodes.push(...(batch.data || []));
      if ((batch.data || []).length < 100) break;
    }
    const activeEpisodes = episodes.filter(e => e.status === "published" && e.is_published !== false && e.is_active !== false);
    const planQuery = await db.from("creator_subscription_plans")
      .select("id,name,active,podcast_id").eq("podcast_id", showId).eq("active", true);
    const planError = planQuery.error ? { code: planQuery.error.code, message: planQuery.error.message } : null;
    const plans = planQuery.data || [];

    const eventQuery = await db.from("podcast_play_events").select("id,episode_id,podcast_id,event_type")
      .eq("podcast_id", showId).in("event_type", ["play", "episode_play", "play_started"]);
    const eventError = eventQuery.error ? { code: eventQuery.error.code, message: eventQuery.error.message } : null;
    const events = eventQuery.data || [];

    const channel = db.channel("cr-show-integration-health-" + Date.now())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "podcast_episodes", filter: "podcast_id=eq." + showId }, () => {});
    const realtimeStatus = await new Promise(resolve => {
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; resolve("TIMEOUT"); } }, 12000);
      channel.subscribe(status => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!done) { done = true; clearTimeout(timer); resolve(status); }
        }
      });
    });
    await db.removeChannel(channel);

    return {
      show: showQuery.data,
      episodes: activeEpisodes,
      rawEpisodeRows: episodes.length,
      plans,
      planError,
      eventError,
      events,
      realtimeStatus,
      visibleRows: document.querySelectorAll("#episodeList .episode-row[data-episode]").length,
      visibleEpisodeIds: Array.from(document.querySelectorAll("#episodeList .episode-row[data-episode]")).map(el => el.dataset.episode),
      membershipCards: document.querySelectorAll("#subscribe .subscribe-plan").length,
      membershipNotice: document.querySelector("#subscribe .notice")?.textContent?.trim() || null
    };
  }, { showId: SHOW_ID });

  if (!data.episodes.length) fail("No published active episodes are visible to the public client.");
  else pass("Show record is visible: " + data.show.title + " (" + data.episodes.length + " published episode(s)).");

  const expectedIds = new Set(data.episodes.map(e => String(e.id)));
  const visibleIds = new Set(data.visibleEpisodeIds.map(String));
  if (data.visibleRows !== data.episodes.length || expectedIds.size !== visibleIds.size || [...expectedIds].some(id => !visibleIds.has(id))) {
    fail("Episode visibility mismatch: database=" + data.episodes.length + ", page=" + data.visibleRows + ", visible IDs match=" + ([...expectedIds].every(id => visibleIds.has(id))));
  } else pass("All published active episodes are rendered in the show library.");

  const invalidAudio = data.episodes.filter(e => {
    if (!e.audio_url) return true;
    try {
      const u = new URL(e.audio_url);
      return !["http:", "https:"].includes(u.protocol) || /(^|\.)youtu\.be$|(^|\.)youtube\.com$/i.test(u.hostname);
    } catch { return true; }
  });
  if (invalidAudio.length) fail("Published episodes with invalid/direct-audio URLs: " + invalidAudio.map(e => e.title + " (" + e.id + ")").join("; "));
  else pass("Published episodes have valid direct audio URLs, not YouTube watch-page URLs.");

  const requestContext = await playwrightRequest.newContext();
  try {
    for (const episode of data.episodes) {
      const response = await requestContext.get(episode.audio_url, { headers: { Range: "bytes=0-1023" }, timeout: 20000 });
      const contentType = response.headers()["content-type"] || "";
      if (!response.ok()) {
        fail("Audio URL returned HTTP " + response.status() + " for " + episode.title);
        continue;
      }
      if (contentType && !/audio|octet-stream|mpeg|mp4/i.test(contentType)) {
        fail("Audio URL returned unexpected content type " + contentType + " for " + episode.title);
        continue;
      }
      await response.body().catch(() => Buffer.alloc(0));
    }
    if (!failures.some(x => /Audio URL/.test(x))) pass("Every published episode audio URL responded to an HTTP range request.");
  } finally {
    await requestContext.dispose();
  }

  const episodePlayTotal = data.episodes.reduce((sum, e) => sum + Number(e.play_count || 0), 0);
  if (Number(data.show.total_plays || 0) !== episodePlayTotal) {
    fail("Play-count mismatch: show.total_plays=" + Number(data.show.total_plays || 0) + ", sum of published episode play_count=" + episodePlayTotal);
  } else pass("Show play count reconciles with published episode play counts (" + episodePlayTotal + ").");

  if (data.eventError) {
    note("Raw play-event rows are not readable from the public client (" + data.eventError.code + "); event reconciliation must be checked with privileged SQL, not by weakening RLS.");
  } else {
    const eventCount = data.events.length;
    if (eventCount === 0 && Number(data.show.total_plays || 0) > 0) {
      note("Public client returned no play-event rows while the show has plays; this may be RLS filtering. Privileged SQL reconciliation is required before calling this a mismatch.");
    } else if (eventCount !== Number(data.show.total_plays || 0)) fail("Play-event mismatch: show.total_plays=" + Number(data.show.total_plays || 0) + ", readable play events=" + eventCount);
    else pass("Readable play-event total matches the show play count (" + eventCount + ").");
    const orphanEvents = data.events.filter(e => !e.episode_id || !expectedIds.has(String(e.episode_id)));
    if (orphanEvents.length) fail("Found " + orphanEvents.length + " play events with missing/unpublished episode IDs.");
    else if (eventCount > 0) pass("No readable play events reference missing or unpublished episodes.");
  }

  if (data.planError) {
    fail("Membership plan query failed: " + data.planError.message);
  } else if (data.membershipCards !== data.plans.length) {
    fail("Membership plan visibility mismatch: active database plans=" + data.plans.length + ", rendered plan cards=" + data.membershipCards + (data.membershipNotice ? "; notice=" + data.membershipNotice : ""));
  } else {
    pass("Active membership plans are rendered consistently (" + data.plans.length + ").");
  }

  if (data.realtimeStatus === "SUBSCRIBED") pass("Supabase Realtime accepted the episode-count channel subscription.");
  else fail("Supabase Realtime channel status was " + data.realtimeStatus + ".");

  for (const n of notes) console.log("NOTE: " + n);
  if (failures.length) {
    console.error("\nSHOW INTEGRATION HEALTH CHECK FAILED (" + failures.length + "):");
    failures.forEach(x => console.error(" - " + x));
    process.exitCode = 1;
  } else {
    console.log("\nPASS: show integration health checks completed.");
  }
} catch (error) {
  console.error("SHOW INTEGRATION HEALTH CHECK ERROR: " + (error?.stack || error));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
