import { sb } from "./client.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const safeUrl = value => {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" ? url.href : ""; }
  catch { return ""; }
};
const statusText = (node, message, error = false) => {
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("is-error", Boolean(error));
};
const fmtDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date to be announced" :
    new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

export async function mountInvitationInbox(root, user) {
  if (!root || !user) return;
  const { data, error } = await sb.from("podcast_community_circle_invites")
    .select("id,circle_id,inviter_id,created_at")
    .eq("invitee_id", user.id).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(30);
  if (error || !data?.length) return;

  const ids = [...new Set(data.map(row => row.circle_id))];
  const circles = await sb.from("podcast_community_circles")
    .select("id,name,category,visibility,is_public")
    .in("id", ids);
  const circleMap = new Map((circles.data || []).map(row => [row.id, row]));
  const section = document.createElement("section");
  section.className = "crg-wrap crg-inbox-wrap";
  section.innerHTML = '<div class="crg-panel crg-inbox-panel"><div class="crg-tool-heading"><div><span class="crg-kicker">YOUR COMMUNITY</span><h2>Group invitations</h2></div><span class="crg-tool-count">' + data.length + '</span></div><div class="crg-invite-inbox-list">' + data.map(row => {
    const circle = circleMap.get(row.circle_id);
    return '<article class="crg-invite-row" data-invite="' + esc(row.id) + '" data-circle="' + esc(row.circle_id) + '"><div><strong>' + esc(circle?.name || "A CrowRules group") + '</strong><small>' + esc(circle?.category || "Community invitation") + ' · ' + esc(fmtDate(row.created_at)) + '</small></div><div class="crg-invite-actions"><button type="button" class="crg-btn" data-accept>Accept</button><button type="button" class="crg-btn secondary" data-decline>Decline</button></div></article>';
  }).join("") + "</div><p class=\"crg-tool-status\">Accepting an invitation adds you to the group. Your group access is still controlled by database permissions.</p></div>";

  const hero = root.querySelector(".crg-hero");
  if (hero) hero.insertAdjacentElement("afterend", section);
  else root.insertAdjacentElement("afterbegin", section);

  section.querySelectorAll("[data-accept]").forEach(button => button.addEventListener("click", async () => {
    const row = button.closest("[data-invite]");
    const inviteId = row?.dataset.invite;
    if (!inviteId) return;
    row.querySelectorAll("button").forEach(item => { item.disabled = true; });
    try {
      const { error: acceptError } = await sb.rpc("accept_podcast_circle_invite", { p_invite_id: inviteId });
      if (acceptError) throw acceptError;
      location.href = new URL("groups.html?group=" + encodeURIComponent(row.dataset.circle), location.href).href;
    } catch (error) {
      row.querySelectorAll("button").forEach(item => { item.disabled = false; });
      statusText(section.querySelector(".crg-tool-status"), error.message || "Invitation acceptance is not available yet.", true);
    }
  }));
  section.querySelectorAll("[data-decline]").forEach(button => button.addEventListener("click", async () => {
    const row = button.closest("[data-invite]");
    if (!row) return;
    button.disabled = true;
    const { error: declineError } = await sb.from("podcast_community_circle_invites")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", row.dataset.invite).eq("invitee_id", user.id);
    if (declineError) {
      button.disabled = false;
      statusText(section.querySelector(".crg-tool-status"), declineError.message || "Could not decline invitation.", true);
      return;
    }
    row.remove();
    const count = section.querySelector(".crg-tool-count");
    count.textContent = String(Math.max(0, Number(count.textContent) - 1));
    if (!section.querySelector("[data-invite]")) section.remove();
  }));
}

export async function mountGroupInvitations({ aside, groupId, group, user }) {
  if (!aside || !user || group.owner_id !== user.id) return;
  const panel = document.createElement("section");
  panel.className = "crg-panel crg-invitation-manager";
  panel.innerHTML = '<div class="crg-tool-heading"><div><span class="crg-kicker">GROW YOUR COMMUNITY</span><h3>Invite members</h3></div></div><label class="crg-invite-search-label" for="crg-invite-search">Find a public Podcasting profile</label><div class="crg-invite-search"><input id="crg-invite-search" type="search" maxlength="60" placeholder="Search display name or username"><button class="crg-btn" type="button" id="crg-invite-find">Find</button></div><div id="crg-invite-results" class="crg-invite-results"></div><div class="crg-tool-divider"></div><h4>Sent invitations</h4><div id="crg-outgoing-invites">' + '<p class="crg-tool-status">Loading invitations…</p></div>';
  aside.appendChild(panel);
  const search = panel.querySelector("#crg-invite-search");
  const results = panel.querySelector("#crg-invite-results");
  const outgoing = panel.querySelector("#crg-outgoing-invites");
  const find = panel.querySelector("#crg-invite-find");

  async function refreshOutgoing() {
    const { data, error } = await sb.from("podcast_community_circle_invites")
      .select("id,invitee_id,status,created_at")
      .eq("circle_id", groupId).eq("inviter_id", user.id)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) { outgoing.innerHTML = '<p class="crg-tool-status">No invitations sent yet.</p>'; return; }
    const ids = [...new Set(rows.map(row => row.invitee_id))];
    const profiles = await sb.from("podcast_member_profiles")
      .select("user_id,display_name,username").in("user_id", ids);
    const names = new Map((profiles.data || []).map(p => [p.user_id, p.display_name || p.username || "Podcasting member"]));
    outgoing.innerHTML = rows.map(row => '<div class="crg-outgoing-row"><span><strong>' + esc(names.get(row.invitee_id) || "Podcasting member") + '</strong><small>' + esc(row.status) + ' · ' + esc(fmtDate(row.created_at)) + '</small></span>' + (row.status === "pending" ? '<button type="button" class="crg-text-button" data-cancel-invite="' + esc(row.id) + '">Cancel</button>' : "") + "</div>").join("");
    outgoing.querySelectorAll("[data-cancel-invite]").forEach(button => button.addEventListener("click", async () => {
      button.disabled = true;
      const { error: cancelError } = await sb.from("podcast_community_circle_invites")
        .delete().eq("id", button.dataset.cancelInvite).eq("inviter_id", user.id);
      if (cancelError) { button.disabled = false; statusText(results, cancelError.message || "Could not cancel invitation.", true); }
      else await refreshOutgoing();
    }));
  }

  async function findMembers() {
    const term = search.value.trim();
    if (term.length < 2) { results.innerHTML = '<p class="crg-tool-status">Enter at least two characters.</p>'; return; }
    find.disabled = true;
    results.innerHTML = '<p class="crg-tool-status">Searching public profiles…</p>';
    try {
      const pattern = "%" + term.replace(/[,%()]/g, " ") + "%";
      const [byName, byUsername, memberships, invitations] = await Promise.all([
        sb.from("podcast_member_profiles").select("user_id,display_name,username,avatar_url").eq("is_public", true).ilike("display_name", pattern).limit(12),
        sb.from("podcast_member_profiles").select("user_id,display_name,username,avatar_url").eq("is_public", true).ilike("username", pattern).limit(12),
        sb.from("podcast_community_circle_members").select("member_id").eq("circle_id", groupId),
        sb.from("podcast_community_circle_invites").select("invitee_id").eq("circle_id", groupId).eq("status", "pending")
      ]);
      if (byName.error) throw byName.error;
      if (byUsername.error) throw byUsername.error;
      const existing = new Set([user.id, ...(memberships.data || []).map(row => row.member_id), ...(invitations.data || []).map(row => row.invitee_id)]);
      const merged = new Map();
      [...(byName.data || []), ...(byUsername.data || [])].forEach(profile => {
        if (!existing.has(profile.user_id)) merged.set(profile.user_id, profile);
      });
      const rows = [...merged.values()].slice(0, 12);
      results.innerHTML = rows.length ? rows.map(profile => '<div class="crg-search-result"><span class="crg-search-avatar">' + esc((profile.display_name || profile.username || "P").slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(profile.display_name || "Podcasting member") + '</strong><small>@' + esc(profile.username || "member") + '</small></span><button type="button" class="crg-btn" data-send-invite="' + esc(profile.user_id) + '">Invite</button></div>').join("") : '<p class="crg-tool-status">No new public profiles found.</p>';
      results.querySelectorAll("[data-send-invite]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        const { error: sendError } = await sb.from("podcast_community_circle_invites").insert({
          circle_id: groupId, inviter_id: user.id, invitee_id: button.dataset.sendInvite, status: "pending"
        });
        if (sendError) {
          button.disabled = false;
          statusText(results, sendError.message || "Could not send invitation.", true);
        } else {
          button.textContent = "Invited";
          await refreshOutgoing();
        }
      }));
    } catch (error) {
      results.innerHTML = '<p class="crg-tool-status is-error">' + esc(error.message || "Profile search is unavailable.") + "</p>";
    } finally { find.disabled = false; }
  }

  find.addEventListener("click", findMembers);
  search.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); findMembers(); } });
  try { await refreshOutgoing(); } catch (error) { outgoing.innerHTML = '<p class="crg-tool-status is-error">' + esc(error.message || "Invitations are unavailable.") + "</p>"; }
}

export async function mountGroupEvents({ root, groupId, group, user, member }) {
  const main = root.querySelector(".crg-detail-layout > div");
  if (!main) return;
  const canCreate = Boolean(user && member && ["owner", "moderator"].includes(String(member.role || "").toLowerCase()));
  const section = document.createElement("section");
  section.className = "crg-panel crg-events-panel";
  section.innerHTML = '<div class="crg-tool-heading"><div><span class="crg-kicker">MAKE PLANS TOGETHER</span><h2>Group events</h2></div><span class="crg-tool-count" id="crg-event-count">—</span></div>' +
    (canCreate ? '<details class="crg-event-create"><summary class="crg-btn">Create an event +</summary><form id="crg-event-form" class="crg-form"><label>Event title<input name="title" required minlength="3" maxlength="120" placeholder="Give your event a name"></label><label>What is it?<select name="event_type"><option value="meetup">Meetup</option><option value="listening_party">Listening party</option><option value="ama">Ask me anything</option><option value="livestream">Livestream</option><option value="other">Other</option></select></label><label>Description<textarea name="description" maxlength="3000" placeholder="What should members know?"></textarea></label><div class="crg-event-form-grid"><label>Starts<input name="starts_at" type="datetime-local" required></label><label>Ends (optional)<input name="ends_at" type="datetime-local"></label></div><label>Format<select name="location_type"><option value="online">Online</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></label><label>Location or venue<input name="location_text" maxlength="300" placeholder="Meeting room, venue or city"></label><label>Meeting link (https only)<input name="meeting_url" type="url" maxlength="1000" placeholder="https://…"></label><label>Related episode link (optional)<input name="episode_url" type="url" maxlength="1000" placeholder="https://…"></label><button class="crg-btn" type="submit">Publish event</button><p class="crg-tool-status" id="crg-event-status" role="status"></p></form></details>' : "") +
    '<div id="crg-event-list" class="crg-event-list"><p class="crg-tool-status">Loading group events…</p></div>';
  main.appendChild(section);
  const list = section.querySelector("#crg-event-list");
  const count = section.querySelector("#crg-event-count");

  async function refreshEvents() {
    const { data, error } = await sb.from("podcast_community_circle_events")
      .select("id,circle_id,creator_id,title,description,event_type,starts_at,ends_at,location_type,location_text,meeting_url,episode_url,status,branch_key")
      .eq("circle_id", groupId).order("starts_at", { ascending: true }).limit(40);
    if (error) throw error;
    const rows = data || [];
    count.textContent = String(rows.length);
    if (!rows.length) { list.innerHTML = '<p class="crg-tool-status">No events scheduled yet. Group hosts can create the first one.</p>'; return; }
    let rsvps = [];
    if (user && member) {
      const result = await sb.from("podcast_community_circle_event_rsvps")
        .select("event_id,user_id,response").in("event_id", rows.map(row => row.id));
      if (!result.error) rsvps = result.data || [];
    }
    const mine = new Map(rsvps.filter(row => row.user_id === user?.id).map(row => [row.event_id, row.response]));
    const totals = new Map();
    rsvps.forEach(row => {
      const current = totals.get(row.event_id) || { going: 0, interested: 0 };
      if (row.response === "going") current.going++;
      if (row.response === "interested") current.interested++;
      totals.set(row.event_id, current);
    });
    list.innerHTML = rows.map(event => {
      const total = totals.get(event.id) || { going: 0, interested: 0 };
      const meeting = safeUrl(event.meeting_url), episode = safeUrl(event.episode_url);
      const isCancelled = event.status === "cancelled";
      return '<article class="crg-event-card' + (isCancelled ? ' is-cancelled' : '') + '" data-event="' + esc(event.id) + '"><div class="crg-event-date"><strong>' + esc(new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(event.starts_at))) + '</strong><small>' + esc(new Intl.DateTimeFormat(undefined, { year: "numeric" }).format(new Date(event.starts_at))) + '</small></div><div class="crg-event-content"><div class="crg-meta"><span>' + esc(String(event.event_type || "event").replaceAll("_", " ")) + '</span><span>' + esc(event.location_type || "online") + '</span>' + (isCancelled ? '<span>Cancelled</span>' : "") + '</div><h3>' + esc(event.title) + '</h3><p>' + esc(event.description || "Group event") + '</p><div class="crg-event-details"><span>' + esc(fmtDate(event.starts_at)) + (event.ends_at ? " – " + esc(fmtDate(event.ends_at)) : "") + '</span>' + (event.location_text ? '<span>' + esc(event.location_text) + '</span>' : "") + '</div><div class="crg-event-links">' + (meeting ? '<a href="' + esc(meeting) + '" target="_blank" rel="noopener noreferrer">Meeting link ↗</a>' : "") + (episode ? '<a href="' + esc(episode) + '" target="_blank" rel="noopener noreferrer">Related episode ↗</a>' : "") + '</div><div class="crg-event-actions">' + (user && member && !isCancelled ? '<span class="crg-event-rsvp-count">' + total.going + ' going · ' + total.interested + ' interested</span><select aria-label="Your RSVP" data-rsvp="' + esc(event.id) + '"><option value="">Your response…</option><option value="going"' + (mine.get(event.id) === "going" ? " selected" : "") + '>Going</option><option value="interested"' + (mine.get(event.id) === "interested" ? " selected" : "") + '>Interested</option><option value="declined"' + (mine.get(event.id) === "declined" ? " selected" : "") + '>Can’t attend</option></select>' : "") + (canCreate ? '<button type="button" class="crg-text-button" data-cancel-event="' + esc(event.id) + '"' + (isCancelled ? " disabled" : "") + '>Cancel event</button>' : "") + '</div></div></article>';
    }).join("");
    list.querySelectorAll("[data-rsvp]").forEach(select => select.addEventListener("change", async () => {
      if (!select.value) return;
      select.disabled = true;
      const { error: rsvpError } = await sb.from("podcast_community_circle_event_rsvps").upsert({
        event_id: select.dataset.rsvp, user_id: user.id, response: select.value, updated_at: new Date().toISOString()
      }, { onConflict: "event_id,user_id" });
      if (rsvpError) { statusText(list, rsvpError.message || "Your RSVP could not be saved.", true); select.disabled = false; }
      else await refreshEvents();
    }));
    list.querySelectorAll("[data-cancel-event]").forEach(button => button.addEventListener("click", async () => {
      button.disabled = true;
      const { error: cancelError } = await sb.from("podcast_community_circle_events")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", button.dataset.cancelEvent).eq("circle_id", groupId);
      if (cancelError) { button.disabled = false; statusText(list, cancelError.message || "Could not cancel event.", true); }
      else await refreshEvents();
    }));
  }

  try { await refreshEvents(); } catch (error) { list.innerHTML = '<p class="crg-tool-status is-error">' + esc(error.message || "Events are unavailable.") + "</p>"; }

  const form = section.querySelector("#crg-event-form");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector("#crg-event-status");
    const values = new FormData(form);
    const startsAt = new Date(String(values.get("starts_at") || ""));
    const endsRaw = String(values.get("ends_at") || "");
    const endsAt = endsRaw ? new Date(endsRaw) : null;
    if (Number.isNaN(startsAt.getTime()) || (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))) {
      statusText(status, "Check the event start and end times.", true); return;
    }
    const meeting = String(values.get("meeting_url") || "").trim();
    const episode = String(values.get("episode_url") || "").trim();
    if ((meeting && !safeUrl(meeting)) || (episode && !safeUrl(episode))) {
      statusText(status, "Links must use HTTPS.", true); return;
    }
    button.disabled = true;
    statusText(status, "Publishing event…");
    try {
      const payload = {
        circle_id: groupId, creator_id: user.id, title: String(values.get("title") || "").trim(),
        description: String(values.get("description") || "").trim(), event_type: String(values.get("event_type")),
        starts_at: startsAt.toISOString(), ends_at: endsAt ? endsAt.toISOString() : null,
        location_type: String(values.get("location_type")), location_text: String(values.get("location_text") || "").trim(),
        meeting_url: meeting, episode_url: episode, status: "scheduled", branch_key: group.branch_key || "community",
        updated_at: new Date().toISOString()
      };
      const { error: createError } = await sb.from("podcast_community_circle_events").insert(payload);
      if (createError) throw createError;
      form.reset();
      statusText(status, "Event published.");
      await refreshEvents();
    } catch (error) { statusText(status, error.message || "Could not publish event.", true); }
    finally { button.disabled = false; }
  });
}
