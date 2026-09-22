/* CrowRules Podcasting — Discovery Intelligence 3.0 */
(function () {
  "use strict";

  const supabase = window.supabase.createClient(
    window.CROWRULES_SUPABASE_URL,
    window.CROWRULES_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
  );

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const norm = (v) => String(v ?? "").toLowerCase().trim();
  const daysAgo = (date) => {
    if (!date) return 9999;
    return Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000);
  };
  const artwork = (url, label) => url
    ? '<img src="' + esc(url) + '" alt="" loading="lazy">'
    : '<span>' + esc((label || "CR").slice(0, 2).toUpperCase()) + '</span>';

  const state = {
    podcasts: [],
    episodes: [],
    creators: [],
    recentCategories: JSON.parse(localStorage.getItem("crDiscoveryCategories") || "[]")
  };

  function remember(category) {
    if (!category) return;
    state.recentCategories = [category, ...state.recentCategories.filter(x => norm(x) !== norm(category))].slice(0, 5);
    localStorage.setItem("crDiscoveryCategories", JSON.stringify(state.recentCategories));
  }

  function podcastScore(p) {
    const recency = Math.max(0, 30 - daysAgo(p.updated_at || p.created_at));
    const activity = Math.min(25, (p.episode_count || 0) * 2);
    const live = norm(p.status) === "live" ? 12 : 0;
    return recency + activity + live;
  }

  function creatorScore(c) {
    return (c.podcast_count || 0) * 4 + Math.max(0, 20 - daysAgo(c.updated_at || c.created_at));
  }

  function podcastCard(p, badge) {
    const meta = [p.category, p.status].filter(Boolean).join(" · ");
    return '<article class="di-card">' +
      '<div class="di-art">' + artwork(p.artwork_url, p.title) + '<span class="di-badge">' + esc(badge || "PODCAST") + '</span></div>' +
      '<div class="di-body"><div class="di-type">PODCAST</div><h3>' + esc(p.title || "Untitled Podcast") + '</h3>' +
      '<p>' + esc(p.description || "Discover this CrowRules podcast.") + '</p>' +
      '<small>' + esc(meta) + '</small>' +
      '<a class="di-link" href="podcast.html?slug=' + encodeURIComponent(p.slug || p.id) + '">Open Podcast →</a></div></article>';
  }

  function episodeCard(e) {
    return '<article class="di-card">' +
      '<div class="di-art">' + artwork(e.thumbnail_url, e.title) + '<span class="di-badge">NEW</span></div>' +
      '<div class="di-body"><div class="di-type">EPISODE</div><h3>' + esc(e.title || "Untitled Episode") + '</h3>' +
      '<p>Episode ' + esc(e.episode_number || "") + '</p><small>' + esc(e.published_at ? new Date(e.published_at).toLocaleDateString() : "Recently published") + '</small>' +
      '<a class="di-link" href="episode.html?id=' + encodeURIComponent(e.id) + '">Listen →</a></div></article>';
  }

  function creatorCard(c) {
    return '<article class="di-creator"><div class="di-avatar">' + artwork(c.avatar_url, c.name) + '</div>' +
      '<div><div class="di-type">CREATOR</div><h3>' + esc(c.name || "CrowRules Creator") + '</h3>' +
      '<p>' + esc([c.role, c.discipline].filter(Boolean).join(" · ") || "Podcast creator") + '</p>' +
      '<a class="di-link" href="creators.html#creator-' + encodeURIComponent(c.slug || c.id) + '">View Creator →</a></div></article>';
  }

  function render(id, html, count) {
    const el = $("#" + id);
    el.innerHTML = html || '<div class="di-empty">No items are available in this section yet.</div>';
    const countEl = el.parentElement.querySelector(".di-count");
    if (countEl) countEl.textContent = count + " available";
  }

  async function load() {
    const [p, e, c] = await Promise.all([
      supabase.from("podcasts").select("id,title,slug,category,description,artwork_url,status,created_at,updated_at,creator_id").in("status", ["active","published","live"]).limit(200),
      supabase.from("podcast_episodes").select("id,title,episode_number,published_at,thumbnail_url,status,podcast_id").in("status", ["published","public","live"]).order("published_at", { ascending: false }).limit(40),
      supabase.from("creators").select("id,name,slug,role,discipline,bio,avatar_url,is_active,created_at,updated_at").eq("is_active", true).limit(100)
    ]);

    if (p.error) throw p.error;
    if (e.error) throw e.error;
    if (c.error) throw c.error;

    state.podcasts = p.data || [];
    state.episodes = e.data || [];
    state.creators = c.data || [];

    const categories = [...new Set(state.podcasts.map(x => x.category).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b)));
    $("#discovery-category").innerHTML = '<option value="">Browse a category…</option>' + categories.map(x => '<option value="' + esc(x) + '">' + esc(x) + '</option>').join("");

    const podcastIds = new Set(state.podcasts.map(x => x.id));
    const episodeCounts = {};
    state.episodes.forEach(x => {
      if (x.podcast_id && podcastIds.has(x.podcast_id)) episodeCounts[x.podcast_id] = (episodeCounts[x.podcast_id] || 0) + 1;
    });
    state.podcasts.forEach(x => x.episode_count = episodeCounts[x.id] || 0);

    const creatorNames = new Map(state.creators.map(x => [x.id, x]));
    const creatorCounts = {};
    state.podcasts.forEach(x => {
      if (x.creator_id && creatorNames.has(x.creator_id)) creatorCounts[x.creator_id] = (creatorCounts[x.creator_id] || 0) + 1;
    });
    state.creators.forEach(x => x.podcast_count = creatorCounts[x.id] || 0);

    const featured = state.podcasts.filter(x => norm(x.status) === "live").sort((a,b) => podcastScore(b)-podcastScore(a)).slice(0,6);
    const trending = [...state.podcasts].sort((a,b) => podcastScore(b)-podcastScore(a)).slice(0,6);
    const newest = state.episodes.slice().sort((a,b) => new Date(b.published_at || 0) - new Date(a.published_at || 0)).slice(0,6);
    const creators = [...state.creators].sort((a,b) => creatorScore(b)-creatorScore(a)).slice(0,6);

    const preferred = state.recentCategories.map(norm);
    const recommended = [...state.podcasts]
      .map(p => ({ p, score: (preferred.includes(norm(p.category)) ? 100 : 0) + podcastScore(p) }))
      .sort((a,b) => b.score-a.score)
      .map(x => x.p)
      .filter((p,i,a) => a.findIndex(x => x.id === p.id) === i)
      .slice(0,6);

    render("trending", trending.map(p => podcastCard(p, "TRENDING")).join(""), trending.length);
    render("featured", featured.map(p => podcastCard(p, "LIVE")).join(""), featured.length);
    render("new-releases", newest.map(episodeCard).join(""), newest.length);
    render("popular-creators", creators.map(creatorCard).join(""), creators.length);
    render("recommended", recommended.map(p => podcastCard(p, preferred.includes(norm(p.category)) ? "FOR YOU" : "DISCOVER")).join(""), recommended.length);

    $("#di-status").textContent = state.podcasts.length + " podcasts · " + state.episodes.length + " episodes · " + state.creators.length + " creators";
    if (!preferred.length) $("#recommendation-note").textContent = "Recommendations start with catalog activity. Search a category to teach this browser what you like.";
  }

  $("#discovery-search").addEventListener("submit", function (event) {
    event.preventDefault();
    const q = $("#discovery-query").value.trim();
    if (q) location.href = "search.html?q=" + encodeURIComponent(q);
  });

  $("#discovery-category").addEventListener("change", function () {
    if (this.value) {
      remember(this.value);
      location.href = "search.html?type=podcast&category=" + encodeURIComponent(this.value);
    }
  });

  load().catch(error => {
    console.error(error);
    $("#di-status").textContent = "Discovery intelligence is temporarily unavailable.";
    ["trending","featured","new-releases","popular-creators","recommended"].forEach(id => render(id, "", 0));
  });
})();