import { sb } from "./client.js";
import { SITE_BASE } from "./config.js";

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const LAUNCH_DATE = "2026-12-01";
const preview = new URLSearchParams(location.search).get("preview") === "1";
const CIRCLES = "podcast_community_circles";
const POSTS = "podcast_community_circle_posts";
const CIRCLE_FIELDS = "id,owner_id,name,description,category,is_public,is_featured,created_at,community_rules,pinned_post_id,branch_key,avatar_image_path,banner_image_path";
const POST_FIELDS = "id,circle_id,author_id,body,created_at,updated_at,post_type,edited_at,deleted_at,is_pinned,is_locked";
const CATEGORIES = [
  "General", "Entertainment", "Sports", "Storytelling", "Local & PNW",
  "Music", "Film & TV", "Creators", "Technology", "Other"
];
const CATEGORY_ART = {
  "General": "photo-1529156069898-49953e39b3ac",
  "Entertainment": "photo-1470229722913-7c0e2dbbafd3",
  "Sports": "photo-1461896836934-ffe607ba8211",
  "Storytelling": "photo-1455390582262-044cdead277a",
  "Local & PNW": "photo-1500530855697-b586d89ba3ee",
  "Music": "photo-1516280440614-37939bbacd81",
  "Film & TV": "photo-1489599849927-2ee91b7f6a8d",
  "Creators": "photo-1598488035139-bdbb2231ce04",
  "Technology": "photo-1518770660439-4636190af475",
  "Other": "photo-1529156069898-49953e39b3ac"
};

function pacificDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
function isLive() { return pacificDate() >= LAUNCH_DATE; }
function addStylesheet() {
  if ($("#crg-style")) return;
  const link = document.createElement("link");
  link.id = "crg-style";
  link.rel = "stylesheet";
  link.href = SITE_BASE + "assets/css/groups.css?v=phase1d-conversations-1";
  document.head.appendChild(link);
}
function groupUrl(id) {
  return SITE_BASE + "groups.html?group=" + encodeURIComponent(id) + (preview ? "&preview=1" : "");
}
function categoryArt(category) {
  const photo = CATEGORY_ART[category] || CATEGORY_ART.General;
  return "https://images.unsplash.com/" + photo + "?auto=format&fit=crop&w=1200&q=85";
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}
function status(root, message, kind = "info") {
  root.innerHTML = '<div class="crg-empty" role="' + (kind === "error" ? "alert" : "status") + '">' + esc(message) + '</div>';
}
function launchNotice(root) {
  root.innerHTML = '<section class="crg-launch"><div class="crg-kicker">CROWRULES PODCASTING · COMMUNITY</div><h1>Something good is <em>coming together.</em></h1><p>CrowRules Groups opens December 1, 2026. Come back soon to discover communities, meet creators and find your people.</p><div class="crg-launch-date">PUBLIC LAUNCH · DECEMBER 1, 2026</div></section>';
}
function categoryFilters() {
  return '<button class="crg-chip" type="button" data-category="all" aria-pressed="true">All groups</button>' +
    CATEGORIES.map(category => '<button class="crg-chip" type="button" data-category="' + esc(category) + '" aria-pressed="false">' + esc(category) + '</button>').join("");
}
function groupCard(group) {
  const href = groupUrl(group.id);
  return '<article class="crg-card">' +
    '<a class="crg-card-link" href="' + esc(href) + '" aria-label="View ' + esc(group.name) + '">' +
      '<div class="crg-cover" style="background-image:url(&quot;' + esc(categoryArt(group.category)) + '&quot;)"><span class="crg-cover-label">PUBLIC COMMUNITY</span></div>' +
    '</a><div class="crg-card-body"><div class="crg-meta"><span>' + esc(group.category || "Community") + '</span>' +
    (group.is_featured ? '<span>Featured</span>' : '') + '</div><h3><a href="' + esc(href) + '">' + esc(group.name) + '</a></h3>' +
    '<p>' + esc(group.description || "A place to connect, share ideas and build community.") + '</p>' +
    '<div class="crg-card-actions"><a class="crg-btn" href="' + esc(href) + '">View community <span aria-hidden="true">→</span></a>' +
    '<span class="crg-card-date">' + esc(dateLabel(group.created_at)) + '</span></div></div></article>';
}

async function loadPublicCircles() {
  const result = await sb.from(CIRCLES).select(CIRCLE_FIELDS)
    .eq("is_public", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw result.error;
  return result.data || [];
}
function renderDirectory(root, circles) {
  root.innerHTML = '<section class="crg-hero"><div class="crg-wrap crg-hero-copy">' +
    '<div class="crg-kicker"><i></i> CROWRULES PODCASTING · COMMUNITY</div>' +
    '<h1>Find your people.<br><em>Build together.</em></h1>' +
    '<p>Discover communities built around creativity, conversation, shared interests and the places we call home.</p>' +
    '<div class="crg-actions"><a class="crg-btn" href="#crg-discover">Explore communities ↓</a></div></div></section>' +
    '<section class="crg-section crg-wrap" id="crg-discover"><div class="crg-section-head"><div>' +
    '<div class="crg-kicker">COMMUNITY DIRECTORY</div><h2>Discover your community</h2>' +
    '<p>Browse public groups and find a place to connect.</p></div>' +
    '<label class="crg-search"><span aria-hidden="true">⌕</span><input id="crg-search" type="search" placeholder="Search groups…" aria-label="Search public groups"></label></div>' +
    '<div class="crg-categories" id="crg-categories">' + categoryFilters() + '</div>' +
    '<div class="crg-grid" id="crg-grid"></div>' +
    '<p class="crg-footer-note">Only public communities are listed here. Group visibility and access are enforced by Supabase Row Level Security.</p></section>';
  const grid = $("#crg-grid", root);
  const search = $("#crg-search", root);
  const filters = $("#crg-categories", root);
  let activeCategory = "all";
  function draw() {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = circles.filter(group =>
      (activeCategory === "all" || group.category === activeCategory) &&
      [group.name, group.description, group.category].join(" ").toLocaleLowerCase().includes(query)
    );
    grid.innerHTML = visible.length
      ? visible.map(groupCard).join("")
      : '<div class="crg-empty">No public groups match your search. Try another category.</div>';
  }
  search.addEventListener("input", draw);
  filters.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    filters.querySelectorAll("[data-category]").forEach(item =>
      item.setAttribute("aria-pressed", String(item === button))
    );
    draw();
  });
  draw();
}

async function loadCircle(id) {
  const result = await sb.from(CIRCLES).select(CIRCLE_FIELDS)
    .eq("id", id).eq("is_public", true).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
async function loadCurrentUser() {
  const result = await sb.auth.getUser();
  if (result.error) throw result.error;
  return result.data?.user || null;
}
async function loadMyMembership(circleId, userId) {
  const result = await sb.from("podcast_community_circle_members")
    .select("circle_id,member_id,role,joined_at")
    .eq("circle_id", circleId)
    .eq("member_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}
async function renderMembership(group, container) {
  if (group.owner_id) {
    // Owner identity is known from the circle row; do not offer owner self-removal.
  }
  let user;
  try {
    user = await loadCurrentUser();
  } catch (error) {
    status(container, "We couldn't verify your sign-in. Refresh the page or sign in again.", "error");
    return false;
  }
  if (!user) {
    container.innerHTML = '<p class="crg-membership-copy">Sign in to join this public community and participate.</p>' +
      '<a class="crg-btn" href="' + esc(SITE_BASE + "login.html") + '">Sign in to join</a>';
    return false;
  }
  if (user.id === group.owner_id) {
    try {
      const ownerMembership = await loadMyMembership(group.id, user.id);
      container.innerHTML = '<span class="crg-membership-state">You own this community.</span>';
      return Boolean(ownerMembership);
    } catch (error) {
      status(container, "Membership status is temporarily unavailable. Please try again.", "error");
      return false;
    }
  }
  let membership;
  try {
    membership = await loadMyMembership(group.id, user.id);
  } catch (error) {
    status(container, "Membership status is temporarily unavailable. Please try again.", "error");
    return false;
  }
  const paint = () => {
    if (membership) {
      container.innerHTML = '<p class="crg-membership-state">You are a member of this community.</p>' +
        '<button class="crg-btn secondary" type="button" id="crg-leave">Leave community</button>';
    } else {
      container.innerHTML = '<p class="crg-membership-copy">Join this public community to take part in the conversation.</p>' +
        '<button class="crg-btn" type="button" id="crg-join">Join community</button>';
    }
  };
  paint();
  container.addEventListener("click", async event => {
    const join = event.target.closest("#crg-join");
    const leave = event.target.closest("#crg-leave");
    if (!join && !leave) return;
    const button = join || leave;
    button.disabled = true;
    button.textContent = join ? "Joining…" : "Leaving…";
    try {
      if (join) {
        const result = await sb.from("podcast_community_circle_members").insert({
          circle_id: group.id, member_id: user.id, role: "member"
        });
        if (result.error) throw result.error;
        membership = { circle_id: group.id, member_id: user.id, role: "member" };
      } else {
        const result = await sb.from("podcast_community_circle_members").delete()
          .eq("circle_id", group.id)
          .eq("member_id", user.id)
          .neq("role", "owner");
        if (result.error) throw result.error;
        membership = null;
      }
      paint();
      container.dispatchEvent(new CustomEvent("crg-membership-change", {
        bubbles: true, detail: { isMember: Boolean(membership) }
      }));
    } catch (error) {
      console.error("CrowRules circle membership action failed:", error);
      paint();
      const message = join
        ? "We couldn't join this community. You may already be a member, or your access may have changed. Refresh and try again."
        : "We couldn't leave this community. Refresh and try again.";
      const notice = document.createElement("p");
      notice.className = "crg-status";
      notice.setAttribute("role", "alert");
      notice.textContent = message;
      container.appendChild(notice);
    }
  });
  return Boolean(membership);
}

async function loadPosts(circleId) {
  const result = await sb.from(POSTS).select(POST_FIELDS)
    .eq("circle_id", circleId)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (result.error) throw result.error;
  return result.data || [];
}
async function loadAuthorLabels(authorIds) {
  const ids = [...new Set(authorIds.filter(Boolean))];
  const labels = new Map();
  if (!ids.length) return labels;
  // Deliberately request only public display labels; never fetch full member profiles.
  const result = await sb.from("crowrules_public_profiles")
    .select("user_id,display_name,username").in("user_id", ids);
  if (result.error) return labels;
  for (const profile of result.data || []) {
    labels.set(profile.user_id, profile.display_name || profile.username || "Community member");
  }
  return labels;
}
const REPLIES = "podcast_community_circle_replies";
const REPLY_FIELDS = "id,post_id,circle_id,author_id,body,created_at";

async function loadReplies(circleId, posts, signedIn) {
  if (!signedIn) return { replies: [], unavailable: true };
  if (!posts.length) return { replies: [], unavailable: false };
  const postIds = posts.map(post => post.id);
  const result = await sb.from(REPLIES).select(REPLY_FIELDS)
    .eq("circle_id", circleId)
    .in("post_id", postIds)
    .order("created_at", { ascending: true })
    .limit(150);
  if (result.error) throw result.error;
  return { replies: result.data || [], unavailable: false };
}
function renderPosts(posts, labels, replies, canReply, signedIn) {
  const composer = canReply
    ? '<form class="crg-post-composer" data-action="create-post"><label for="crg-new-post">Start a conversation</label><textarea id="crg-new-post" name="body" maxlength="3000" minlength="1" required placeholder="Share something with this community…"></textarea><div class="crg-form-footer"><span>Up to 3,000 characters</span><button class="crg-btn" type="submit">Publish post</button></div></form>'
    : (signedIn ? '<p class="crg-feed-hint">Join this community to publish posts and reply.</p>' : '<p class="crg-feed-hint">Sign in and join this community to publish posts and reply.</p>');
  const cards = posts.length ? posts.map(post => {
    const author = labels.get(post.author_id) || "Community member";
    const locked = post.is_locked ? '<span class="crg-post-flag">Replies closed</span>' : "";
    const pinned = post.is_pinned ? '<span class="crg-post-flag">Pinned</span>' : "";
    const postReplies = replies.filter(reply => reply.post_id === post.id);
    const replyMarkup = postReplies.length
      ? postReplies.map(reply => '<div class="crg-reply"><div class="crg-reply-head"><strong>' +
          esc(labels.get(reply.author_id) || "Community member") + '</strong><time datetime="' +
          esc(reply.created_at) + '">' + esc(dateLabel(reply.created_at)) + '</time></div><p>' +
          esc(reply.body) + '</p></div>').join("")
      : '<p class="crg-feed-hint">No replies yet.</p>';
    const replyForm = post.is_locked
      ? '<p class="crg-feed-hint">Replies are closed for this post.</p>'
      : (canReply
        ? '<form class="crg-reply-form" data-action="create-reply" data-post-id="' + esc(post.id) + '"><label class="crg-sr-only" for="crg-reply-' + esc(post.id) + '">Write a reply</label><textarea id="crg-reply-' + esc(post.id) + '" name="body" maxlength="1500" minlength="1" required placeholder="Write a reply…"></textarea><button class="crg-btn secondary" type="submit">Reply</button></form>'
        : '<p class="crg-feed-hint">' + (signedIn ? "Join this community to reply." : "Sign in to view and join the conversation.") + '</p>');
    return '<article class="crg-post" id="post-' + esc(post.id) + '"><div class="crg-post-head"><strong>' +
      esc(author) + '</strong><time datetime="' + esc(post.created_at) + '">' +
      esc(dateLabel(post.created_at)) + '</time></div><div class="crg-post-flags">' + pinned + locked +
      '</div><p class="crg-post-body">' + esc(post.body || "") + '</p><section class="crg-replies" aria-label="Replies">' +
      '<h4>Replies <span>' + postReplies.length + '</span></h4>' + replyMarkup + replyForm + '</section></article>';
  }).join("") : '<div class="crg-empty">No conversations yet. Be the first to start one.</div>';
  return composer + '<div class="crg-post-list">' + cards + '</div>';
}
async function renderConversation(group, postsRoot, canReply, user) {
  try {
    const posts = await loadPosts(group.id);
    let repliesResult = { replies: [], unavailable: false };
    if (user) {
      try { repliesResult = await loadReplies(group.id, posts, true); }
      catch (replyError) {
        console.warn("CrowRules replies unavailable:", replyError);
        repliesResult = { replies: [], unavailable: true };
      }
    }
    const labels = await loadAuthorLabels([
      ...posts.map(post => post.author_id),
      ...repliesResult.replies.map(reply => reply.author_id)
    ]);
    postsRoot.innerHTML = renderPosts(posts, labels, repliesResult.replies, canReply, Boolean(user));
    if (!user && posts.length) {
      postsRoot.querySelectorAll(".crg-replies").forEach(section => {
        const hint = document.createElement("p");
        hint.className = "crg-feed-hint";
        hint.textContent = "Sign in to view replies.";
        section.querySelectorAll(".crg-reply, .crg-reply-form").forEach(node => node.remove());
        section.appendChild(hint);
      });
    } else if (repliesResult.unavailable) {
      postsRoot.querySelectorAll(".crg-replies").forEach(section => {
        const hint = document.createElement("p");
        hint.className = "crg-feed-hint";
        hint.textContent = "Replies are temporarily unavailable.";
        section.appendChild(hint);
      });
    }
  } catch (error) {
    console.error("CrowRules conversation load failed:", error);
    status(postsRoot, "Conversations or replies are temporarily unavailable. Please try again later.", "error");
  }
  postsRoot.onsubmit = async event => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault();
    if (!user || !canReply) return;
    const body = String(new FormData(form).get("body") || "").trim();
    const action = form.dataset.action;
    const postId = form.dataset.postId;
    const max = action === "create-post" ? 3000 : 1500;
    if (!body || body.length > max) return;
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = action === "create-post" ? "Publishing…" : "Sending…"; }
    try {
      const payload = action === "create-post"
        ? { circle_id: group.id, author_id: user.id, body, post_type: "discussion" }
        : { circle_id: group.id, post_id: postId, author_id: user.id, body };
      const table = action === "create-post" ? POSTS : REPLIES;
      const result = await sb.from(table).insert(payload);
      if (result.error) throw result.error;
      await renderConversation(group, postsRoot, canReply, user);
    } catch (error) {
      console.error("CrowRules conversation submit failed:", error);
      if (button) { button.disabled = false; button.textContent = action === "create-post" ? "Publish post" : "Reply"; }
      const notice = document.createElement("p");
      notice.className = "crg-status";
      notice.setAttribute("role", "alert");
      notice.textContent = "Your message could not be submitted. Please check your connection and try again.";
      form.appendChild(notice);
    }
  };
}
async function renderDetail(root, id) {
  status(root, "Loading community…");
  const group = await loadCircle(id);
  if (!group) {
    status(root, "This public community could not be found.", "error");
    return;
  }
  root.innerHTML = '<section class="crg-group-head" style="--crg-cover:url(&quot;' + esc(categoryArt(group.category)) + '&quot;)"><div class="crg-wrap">' +
    '<div class="crg-kicker">CROWRULES GROUP · ' + esc(group.category || "COMMUNITY") + '</div>' +
    '<h1>' + esc(group.name) + '</h1><p>' + esc(group.description || "A place to connect and build together.") + '</p>' +
    '<div class="crg-meta"><span>PUBLIC COMMUNITY</span>' + (group.is_featured ? '<span>FEATURED</span>' : "") + '</div>' +
    '<div class="crg-actions"><a class="crg-btn secondary" href="' + esc(SITE_BASE + "groups.html" + (preview ? "?preview=1" : "")) + '">← All communities</a></div></div></section>' +
    '<section class="crg-section crg-wrap"><div class="crg-detail-layout"><div><section class="crg-panel"><h2>Membership</h2><div id="crg-membership" aria-live="polite"><div class="crg-empty">Checking membership…</div></div></section><section class="crg-panel">' +
    '<h2>Community conversations</h2><p class="crg-panel-intro">Recent public posts from this group.</p>' +
    '<div id="crg-posts" aria-live="polite"><div class="crg-empty">Loading conversations…</div></div></section></div>' +
    '<aside><section class="crg-panel"><h3>About this community</h3><p class="crg-rules">' +
    esc(group.community_rules || "Be respectful, stay on topic and help make this a welcoming community.") + '</p>' +
    '<div class="crg-meta"><span>' + esc(group.category || "Community") + '</span><span>Public</span></div>' +
    (group.branch_key ? '<p class="crg-branch-label">Community area: ' + esc(group.branch_key) + '</p>' : "") +
    '<p class="crg-branch-label">Created ' + esc(dateLabel(group.created_at)) + '</p></section></aside></div></section>';
  const postsRoot = $("#crg-posts", root);
  const membershipRoot = $("#crg-membership", root);
  let currentUser = null;
  try { currentUser = await loadCurrentUser(); } catch (error) { currentUser = null; }
  let canParticipate = await renderMembership(group, membershipRoot);
  membershipRoot.addEventListener("crg-membership-change", event => {
    canParticipate = Boolean(event.detail?.isMember);
    renderConversation(group, postsRoot, canParticipate, currentUser);
  });
  await renderConversation(group, postsRoot, canParticipate, currentUser);
}

export async function renderGroups() {
  const app = $("#app");
  if (!app) return;
  addStylesheet();
  app.innerHTML = '<div class="crg-page">' +
    (preview && !isLive() ? '<div class="crg-preview-bar">PRE-LAUNCH PREVIEW · Public launch remains scheduled for December 1, 2026</div>' : "") +
    '<div class="crg-wrap" id="crg-root"><div class="crg-empty">Loading CrowRules Groups…</div></div></div>';
  const root = $("#crg-root", app);
  const groupId = new URLSearchParams(location.search).get("group");
  if (!isLive() && !preview) {
    launchNotice(root);
    return;
  }
  try {
    if (groupId) {
      await renderDetail(root, groupId);
      return;
    }
    const circles = await loadPublicCircles();
    renderDirectory(root, circles);
  } catch (error) {
    status(root, "Groups could not be loaded right now. Please refresh and try again.", "error");
    console.error("CrowRules Groups load failed:", error);
  }
}
