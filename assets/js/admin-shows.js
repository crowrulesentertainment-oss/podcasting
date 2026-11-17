import { sb } from "./client.js";

const number = value => Number(value || 0).toLocaleString();
const sleepFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

async function fetchAll(query, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function styles() {
  if (document.getElementById("admin-show-analytics-styles")) return;
  const style = document.createElement("style");
  style.id = "admin-show-analytics-styles";
  style.textContent = `
    .admin-show-analytics{margin:0 0 18px}
    .admin-show-analytics-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .admin-show-analytics-card{min-width:0;padding:17px;border:1px solid #ffffff18;border-radius:12px;background:linear-gradient(145deg,#1b1b1b,#101010)}
    .admin-show-analytics-card span{display:block;color:#aaa;font-size:10px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}
    .admin-show-analytics-card strong{display:block;margin:8px 0 4px;color:#fff;font-size:clamp(23px,3vw,32px);line-height:1.1;overflow-wrap:anywhere}
    .admin-show-analytics-card small{color:#999;font-size:11px;line-height:1.45}
    .admin-show-analytics-card.views{border-color:#d7b46a55;background:linear-gradient(145deg,#282116,#101010)}
    .admin-show-analytics-note{margin:12px 0 0;color:#aaa;font-size:11px;line-height:1.6}
    .admin-show-metric{white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:800}
    .admin-show-metric-unavailable{color:#b9a77e;font-size:11px;font-weight:650}
    .admin-show-analytics-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 12px}
    .admin-show-analytics-toolbar button{white-space:nowrap}
    @media(max-width:650px){.admin-show-analytics-grid{grid-template-columns:1fr}.admin-show-analytics-card{padding:13px}}
  `;
  document.head.appendChild(style);
}

async function loadMetrics(showIds) {
  const [follows, episodes, viewEvents] = await Promise.all([
    fetchAll(sb.from("podcast_follows").select("podcast_id").in("podcast_id", showIds)),
    fetchAll(sb.from("podcast_episodes").select("id,podcast_id").in("podcast_id", showIds)),
    fetchAll(sb.from("analytics_events").select("content_id").eq("event_name", "show_view").eq("content_type", "podcast_show").in("content_id", showIds))
  ]);
  const followers = new Map(), listens = new Map(), views = new Map();
  follows.forEach(row => followers.set(row.podcast_id, (followers.get(row.podcast_id) || 0) + 1));
  viewEvents.forEach(row => views.set(row.content_id, (views.get(row.content_id) || 0) + 1));
  const episodeToShow = new Map(episodes.map(row => [row.id, row.podcast_id]));
  if (episodes.length) {
    const ids = episodes.map(row => row.id);
    for (let i = 0; i < ids.length; i += 400) {
      const events = await fetchAll(
        sb.from("podcast_play_events").select("episode_id").eq("event_type", "play").in("episode_id", ids.slice(i, i + 400))
      );
      events.forEach(event => {
        const showId = episodeToShow.get(event.episode_id);
        if (showId) listens.set(showId, (listens.get(showId) || 0) + 1);
      });
    }
  }
  return { followers, listens, views, episodes };
}

function showRows() {
  return [...document.querySelectorAll("[data-featured-show]")].map(input => ({
    id: input.dataset.featuredShow,
    row: input.closest("tr")
  })).filter(item => item.id && item.row);
}

async function enhanceShows() {
  const work = document.querySelector("#work");
  if (!work || new URLSearchParams(location.search).get("tab") !== "shows") return false;
  const items = showRows();
  const table = work.querySelector("table");
  if (!table || !items.length) return false;
  if (table.dataset.showAnalyticsReady === "true") return true;

  styles();
  table.dataset.showAnalyticsReady = "true";
  const headRow = table.querySelector("thead tr");
  if (headRow) {
    ["Followers", "Qualified listens", "Show views"].forEach(label => {
      const th = document.createElement("th");
      th.textContent = label;
      th.scope = "col";
      headRow.appendChild(th);
    });
  }
  items.forEach(({ id, row }) => {
    row.dataset.showAnalyticsId = id;
    const followers = document.createElement("td");
    followers.className = "admin-show-metric";
    followers.dataset.showFollowers = id;
    followers.textContent = "…";
    const listens = document.createElement("td");
    listens.className = "admin-show-metric";
    listens.dataset.showListens = id;
    listens.textContent = "…";
    const views = document.createElement("td");
    views.className = "admin-show-metric";
    views.dataset.showViews = id;
    views.textContent = "…";
    row.append(followers, listens, views);
  });

  const summary = document.createElement("section");
  summary.className = "admin-show-analytics";
  summary.innerHTML = '<div class="admin-show-analytics-grid"><article class="admin-show-analytics-card"><span>Total followers</span><strong data-total-followers>—</strong><small>Accounts following the shows in this catalog</small></article><article class="admin-show-analytics-card"><span>Qualified listens</span><strong data-total-listens>—</strong><small>Episode plays recorded after 30 seconds of active listening</small></article><article class="admin-show-analytics-card views"><span>Show page views</span><strong data-total-views>—</strong><small>One recorded view per show per browser tab session</small></article></div><p class="admin-show-analytics-note">Followers, episode play events and show-page views are separate metrics. Show views are recorded when a published show page opens; refreshes in the same tab session do not add another view.</p>';
  const module = work.querySelector(".admin-module");
  if (module) module.insertAdjacentElement("beforebegin", summary);
  else work.prepend(summary);

  const toolbar = document.createElement("div");
  toolbar.className = "admin-show-analytics-toolbar";
  toolbar.innerHTML = '<span class="muted small">Audience metrics · live database totals</span><button type="button" class="btn secondary" data-refresh-show-analytics>↻ Refresh metrics</button>';
  summary.appendChild(toolbar);

  const refresh = async button => {
    if (button) { button.disabled = true; button.textContent = "Refreshing…"; }
    try {
      const ids = items.map(item => item.id);
      const metrics = await loadMetrics(ids);
      const followerTotal = [...metrics.followers.values()].reduce((sum, value) => sum + value, 0);
      const listenTotal = [...metrics.listens.values()].reduce((sum, value) => sum + value, 0);
      const viewTotal = [...metrics.views.values()].reduce((sum, value) => sum + value, 0);
      summary.querySelector("[data-total-followers]").textContent = number(followerTotal);
      summary.querySelector("[data-total-listens]").textContent = number(listenTotal);
      summary.querySelector("[data-total-views]").textContent = number(viewTotal);
      items.forEach(({ id }) => {
        const f = summary.parentElement.querySelector("[data-show-followers='" + CSS.escape(id) + "']");
        const l = summary.parentElement.querySelector("[data-show-listens='" + CSS.escape(id) + "']");
        const v = summary.parentElement.querySelector("[data-show-views='" + CSS.escape(id) + "']");
        if (f) f.textContent = number(metrics.followers.get(id) || 0);
        if (l) l.textContent = number(metrics.listens.get(id) || 0);
        if (v) v.textContent = number(metrics.views.get(id) || 0);
      });
      summary.dataset.metricsLoaded = "true";
      summary.querySelector(".admin-show-analytics-note").textContent =
        "Updated " + new Date().toLocaleTimeString() + ". Followers count follow records; qualified listens count episode plays after 30 seconds of active listening; show views count published show-page visits, deduplicated per show and browser tab session."
    } catch (error) {
      console.warn("Show audience metrics unavailable:", error);
      summary.querySelector(".admin-show-analytics-note").textContent =
        "Audience metrics could not be loaded: " + (error.message || "Please refresh and try again.");
      items.forEach(({ id }) => {
        const f = summary.parentElement.querySelector("[data-show-followers='" + CSS.escape(id) + "']");
        const l = summary.parentElement.querySelector("[data-show-listens='" + CSS.escape(id) + "']");
        if (f) f.textContent = "Unavailable";
        if (l) l.textContent = "Unavailable";
      });
    } finally {
      if (button) { button.disabled = false; button.textContent = "↻ Refresh metrics"; }
    }
  };
  summary.querySelector("[data-refresh-show-analytics]").addEventListener("click", event => refresh(event.currentTarget));
  await refresh();
  return true;
}

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  sleepFrame().then(async () => {
    scheduled = false;
    await enhanceShows().catch(error => console.warn("Show analytics enhancement failed:", error));
  });
});
observer.observe(document.querySelector("#app") || document.body, { childList: true, subtree: true });
enhanceShows().catch(error => console.warn("Show analytics enhancement failed:", error));
