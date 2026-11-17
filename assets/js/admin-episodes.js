import { sb } from "./client.js";

const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));

function imageForShow(show, episodes) {
  const direct = [show.cover_image, show.artwork_url, show.thumbnail_url, show.image_url, show.cover_url]
    .find(value => typeof value === "string" && /^https?:\/\//i.test(value));
  if (direct) return direct;
  const episode = episodes.find(item => item.podcast_id === show.id);
  const thumb = episode?.thumbnail_url;
  if (typeof thumb === "string" && /^https?:\/\//i.test(thumb)) return thumb;
  const video = String(episode?.video_url || "");
  const match = video.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
  return match ? "https://img.youtube.com/vi/" + match[1] + "/hqdefault.jpg" : "";
}

async function loadPopularShows() {
  const [showsResult, episodesResult] = await Promise.all([
    sb.from("podcasts").select("*").limit(1000),
    sb.from("podcast_episodes").select("id,podcast_id,title,thumbnail_url,video_url").limit(5000)
  ]);
  if (showsResult.error) throw showsResult.error;
  if (episodesResult.error) throw episodesResult.error;
  const shows = showsResult.data || [];
  const episodes = episodesResult.data || [];
  if (!shows.length) return [];
  const episodeIds = episodes.map(item => item.id).filter(Boolean);
  let events = [];
  for (let i = 0; i < episodeIds.length; i += 500) {
    const { data, error } = await sb.from("podcast_play_events")
      .select("episode_id").eq("event_type", "play")
      .in("episode_id", episodeIds.slice(i, i + 500)).limit(50000);
    if (error) throw error;
    events = events.concat(data || []);
  }
  const episodeShow = new Map(episodes.map(item => [item.id, item.podcast_id]));
  const counts = new Map();
  events.forEach(event => {
    const showId = episodeShow.get(event.episode_id);
    if (showId) counts.set(showId, (counts.get(showId) || 0) + 1);
  });
  return shows.map(show => {
    const showEpisodes = episodes.filter(item => item.podcast_id === show.id);
    return {
      show,
      episodes: showEpisodes,
      listens: counts.get(show.id) || 0,
      image: imageForShow(show, showEpisodes)
    };
  }).sort((a, b) => b.listens - a.listens || String(a.show.title || a.show.name || "").localeCompare(String(b.show.title || b.show.name || ""))).slice(0, 5);
}

function renderPopularShows(items) {
  const existing = document.querySelector("[data-admin-popular-shows]");
  const anchor = document.querySelector(".admin-episode-state-grid");
  if (!anchor || existing) return;
  const section = document.createElement("section");
  section.className = "admin-module admin-top-episodes admin-popular-shows";
  section.dataset.adminPopularShows = "true";
  section.innerHTML = '<div class="admin-module-head"><div><span class="admin-kicker">SHOW PERFORMANCE</span><h3>Top 5 most popular shows</h3><p>Ranked by recorded qualified episode play events across each show.</p></div></div>' +
    (items.length ? '<div class="admin-top-episodes-grid">' + items.map((item, index) => {
      const title = item.show.title || item.show.name || "Untitled show";
      const cover = item.image;
      return '<article class="admin-top-episode-card"><div class="admin-top-episode-cover">' +
        (cover ? '<img src="' + escapeHTML(cover) + '" alt="' + escapeHTML(title) + ' cover" loading="lazy">' : '<div class="admin-top-episode-placeholder">' + (index + 1) + '</div>') +
        '<span class="admin-top-episode-rank">#' + (index + 1) + '</span></div><div class="admin-top-episode-info"><b>' + escapeHTML(title) +
        '</b><small>' + item.listens.toLocaleString() + ' qualified listens</small><small>' + item.episodes.length.toLocaleString() + ' episodes</small></div></article>';
    }).join("") + '</div>' : '<p class="muted">No shows are available yet.</p>');
  anchor.insertAdjacentElement("afterend", section);
}

function watchEpisodesTab() {
  const observer = new MutationObserver(() => {
    const anchor = document.querySelector(".admin-episode-state-grid");
    if (!anchor || document.querySelector("[data-admin-popular-shows]")) return;
    observer.disconnect();
    loadPopularShows().then(renderPopularShows).catch(error => {
      console.warn("Popular show analytics are temporarily unavailable:", error?.message || error);
    }).finally(() => observer.observe(document.querySelector("#app") || document.body, { childList: true, subtree: true }));
  });
  observer.observe(document.querySelector("#app") || document.body, { childList: true, subtree: true });
}

watchEpisodesTab();
