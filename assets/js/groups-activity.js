import { sb } from "./client.js";
import { SITE_BASE } from "./config.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const dateText = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" :
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};
const groupUrl = id => SITE_BASE + "groups.html?group=" + encodeURIComponent(id);
const feedTarget = row => {
  const circle = row.metadata?.circle_id || row.circle_id;
  const hash = ["discussion_created", "reply_created"].includes(row.activity_type) ? "#crg-posts" :
    ["event_created", "event_updated", "event_cancelled"].includes(row.activity_type) ? "#crg-events" : "";
  return circle ? groupUrl(circle) + hash : "#";
};
const notificationTarget = row => {
  const circle = row.metadata?.circle_id;
  if (circle) return groupUrl(circle) +
    (row.metadata?.event_id ? "#crg-events" : row.metadata?.post_id ? "#crg-posts" : "");
  return "#";
};
const setStatus = (node, message, error = false) => {
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("is-error", Boolean(error));
};

export async function mountGroupActivityFeed({ root, groupId, member }) {
  if (!root || !member) return;
  const main = root.querySelector(".crg-detail-layout > div");
  if (!main) return;
  const panel = document.createElement("section");
  panel.className = "crg-panel crg-activity-panel";
  panel.innerHTML = '<div class="crg-tool-heading"><div><span class="crg-kicker">THE COMMUNITY AT WORK</span><h2>Group activity</h2></div><span class="crg-tool-count" data-activity-count>—</span></div><div class="crg-activity-list" aria-live="polite"><p class="crg-tool-status">Loading group activity…</p></div>';
  main.prepend(panel);
  const list = panel.querySelector(".crg-activity-list");
  const count = panel.querySelector("[data-activity-count]");
  try {
    const { data, error } = await sb.from("podcast_community_circle_activity")
      .select("id,circle_id,actor_id,activity_type,target_id,summary,created_at,metadata")
      .eq("circle_id", groupId).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    const rows = data || [];
    count.textContent = String(rows.length);
    if (!rows.length) {
      list.innerHTML = '<p class="crg-tool-status">Your group activity will appear here as members post, reply, schedule events and join.</p>';
      return;
    }
    const ids = [...new Set(rows.map(row => row.actor_id).filter(Boolean))];
    const profiles = ids.length ? await sb.from("crowrules_public_profiles")
      .select("user_id,display_name,username").in("user_id", ids) : { data: [], error: null };
    if (profiles.error) throw profiles.error;
    const names = new Map((profiles.data || []).map(row =>
      [row.user_id, row.display_name || row.username || "Community member"]));
    list.innerHTML = rows.map(row => {
      const actor = names.get(row.actor_id) || (row.actor_id === member.user_id ? "You" : "A community member");
      const label = String(row.activity_type || "activity").replaceAll("_", " ");
      return '<article class="crg-activity-row"><span class="crg-activity-mark" aria-hidden="true">✦</span><div class="crg-activity-copy"><p><strong>' +
        esc(actor) + '</strong> ' + esc(row.summary || label) + '</p><small>' +
        esc(row.metadata?.circle_name || "This group") + ' · ' + esc(dateText(row.created_at)) +
        '</small><a href="' + esc(feedTarget(row)) + '">View activity</a></div></article>';
    }).join("");
  } catch (error) {
    list.innerHTML = '<p class="crg-tool-status is-error">' +
      esc(error.message || "Group activity is temporarily unavailable.") + '</p>';
  }
}

const notificationTypes = [
  "circle_invitation", "community_invite",
  "circle_new_discussion", "community_post",
  "circle_discussion_reply",
  "circle_event_created", "circle_event_updated",
  "community_event"
];
const notificationIdentity = row => {
  const meta = row.metadata || {};
  const entity = ["circle_invitation", "community_invite"].includes(row.type) ? "invite:" + (meta.invitation_id || meta.circle_id || row.id) :
    meta.post_id ? "post:" + meta.post_id :
    meta.event_id ? "event:" + meta.event_id :
    meta.circle_id ? "circle:" + meta.circle_id + ":" + row.type : row.id;
  return entity + ":" + row.user_id;
};
const notificationLabel = row => ({
  circle_invitation: "Group invitation", community_invite: "Group invitation",
  circle_new_discussion: "New discussion", community_post: "New discussion",
  circle_discussion_reply: "Discussion reply",
  circle_event_created: "New group event", community_event: "New group event",
  circle_event_updated: "Group event updated"
}[row.type] || "Group update");

export async function mountGroupNotifications(root, user) {
  if (!root || !user) return;
  const section = document.createElement("section");
  section.className = "crg-wrap crg-notifications-wrap";
  section.innerHTML = '<div class="crg-panel crg-notifications-panel"><div class="crg-tool-heading"><div><span class="crg-kicker">STAY IN THE LOOP</span><h2>Group notifications</h2></div><span class="crg-tool-count" data-notification-count>—</span></div><div class="crg-notification-list"><p class="crg-tool-status">Loading notifications…</p></div><div class="crg-notification-footer"><button type="button" class="crg-text-button" data-mark-all>Mark all as read</button><button type="button" class="crg-text-button" data-preferences-toggle>Notification preferences</button></div><div class="crg-notification-preferences" hidden></div></div>';
  const inbox = root.querySelector(".crg-inbox-wrap");
  if (inbox) inbox.insertAdjacentElement("afterend", section);
  else root.insertAdjacentElement("afterbegin", section);
  const list = section.querySelector(".crg-notification-list");
  const count = section.querySelector("[data-notification-count]");
  const prefs = section.querySelector(".crg-notification-preferences");
  let rows = [], allRows = [];

  async function refresh() {
    const { data, error } = await sb.from("crowrules_notifications")
      .select("id,user_id,actor_user_id,type,title,body,division,action_url,metadata,is_read,created_at,read_at,priority")
      .eq("user_id", user.id).in("type", notificationTypes)
      .order("created_at", { ascending: false }).limit(60);
    if (error) throw error;
    allRows = data || [];
    const seen = new Set();
    rows = allRows.filter(row => {
      const key = notificationIdentity(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 30);
    count.textContent = String(rows.filter(row => !row.is_read).length);
    if (!rows.length) {
      list.innerHTML = '<p class="crg-tool-status">You are all caught up. New group invitations, discussions, replies and events will show up here.</p>';
      return;
    }
    list.innerHTML = rows.map(row => {
      const target = notificationTarget(row);
      return '<article class="crg-notification-row' + (row.is_read ? "" : " is-unread") + '" data-notification="' + esc(row.id) + '"><span class="crg-notification-dot" aria-hidden="true"></span><div class="crg-notification-copy"><div><strong>' +
        esc(row.title || notificationLabel(row)) + '</strong><small>' + esc(notificationLabel(row)) + ' · ' + esc(dateText(row.created_at)) +
        '</small></div><p>' + esc(row.body || "There is new activity in one of your groups.") + '</p><div class="crg-notification-actions"><a href="' +
        esc(target) + '">Open group</a>' + (!row.is_read ? '<button type="button" class="crg-text-button" data-mark-read="' + esc(row.id) + '">Mark read</button>' : "") +
        '</div></div></article>';
    }).join("");
    list.querySelectorAll("[data-mark-read]").forEach(button => button.addEventListener("click", async () => {
      button.disabled = true;
      const { error: updateError } = await sb.from("crowrules_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", button.dataset.markRead).eq("user_id", user.id);
      if (updateError) { button.disabled = false; setStatus(list, updateError.message || "Could not update notification.", true); }
      else await refresh();
    }));
  }

  async function loadPreferences() {
    const { data, error } = await sb.from("podcast_community_circle_notification_preferences")
      .select("invitation_alerts,discussion_alerts,reply_alerts,moderation_alerts")
      .eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    const values = data || { invitation_alerts: true, discussion_alerts: true, reply_alerts: true, moderation_alerts: true };
    const fields = [
      ["invitation_alerts", "Group invitations"],
      ["discussion_alerts", "New discussions"],
      ["reply_alerts", "Replies to your discussions"],
      ["moderation_alerts", "Group moderation updates"]
    ];
    prefs.innerHTML = '<h3>What would you like to hear about?</h3>' + fields.map(([key, label]) =>
      '<label class="crg-pref-row"><span>' + label + '</span><input type="checkbox" data-pref="' + key + '"' +
      (values[key] !== false ? " checked" : "") + '></label>').join("") +
      '<p class="crg-tool-status" data-pref-status>Preferences are saved to your Podcasting account.</p>';
    prefs.querySelectorAll("[data-pref]").forEach(input => input.addEventListener("change", async () => {
      input.disabled = true;
      const payload = { user_id: user.id, updated_at: new Date().toISOString() };
      prefs.querySelectorAll("[data-pref]").forEach(field => { payload[field.dataset.pref] = field.checked; });
      const { error: saveError } = await sb.from("podcast_community_circle_notification_preferences")
        .upsert(payload, { onConflict: "user_id" });
      setStatus(prefs.querySelector("[data-pref-status]"),
        saveError ? (saveError.message || "Preferences could not be saved.") : "Preferences saved.",
        Boolean(saveError));
      input.disabled = false;
    }));
  }

  section.querySelector("[data-mark-all]").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    const unread = allRows.filter(row => !row.is_read).map(row => row.id);
    if (unread.length) {
      const { error } = await sb.from("crowrules_notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id).in("id", unread);
      if (error) setStatus(list, error.message || "Could not mark notifications as read.", true);
      else await refresh();
    }
    button.disabled = false;
  });
  section.querySelector("[data-preferences-toggle]").addEventListener("click", async () => {
    prefs.hidden = !prefs.hidden;
    if (!prefs.hidden && !prefs.dataset.loaded) {
      try { await loadPreferences(); prefs.dataset.loaded = "true"; }
      catch (error) { prefs.innerHTML = '<p class="crg-tool-status is-error">' + esc(error.message || "Preferences are unavailable.") + '</p>'; }
    }
  });
  try { await refresh(); }
  catch (error) { list.innerHTML = '<p class="crg-tool-status is-error">' + esc(error.message || "Group notifications are temporarily unavailable.") + '</p>'; }
}
