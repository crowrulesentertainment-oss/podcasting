import { sb } from "./client.js";

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

const notice = (message, kind = "") =>
  '<p class="crg-tool-status ' + kind + '" role="status">' + esc(message) + "</p>";

async function publicNames(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await sb.from("crowrules_public_profiles")
    .select("user_id,display_name,username")
    .in("user_id", ids);
  if (error) return new Map();
  return new Map((data || []).map(row => [
    row.user_id,
    row.display_name || row.username || "Community member"
  ]));
}

export async function mountGroupTools({ root, groupId, user, group, member }) {
  const aside = root.querySelector(".crg-detail-layout aside");
  if (!aside || !user || !member) return;

  const roster = document.createElement("section");
  roster.className = "crg-panel crg-roster-panel";
  roster.innerHTML = '<div class="crg-tool-heading"><div><span class="crg-kicker">THE PEOPLE</span><h3>Group members</h3></div><span class="crg-tool-count" id="crg-roster-count">—</span></div><div id="crg-roster-list" class="crg-roster-list">' + notice("Loading members…") + "</div>";
  aside.appendChild(roster);

  const rosterList = roster.querySelector("#crg-roster-list");
  try {
    const { data, error } = await sb.from("podcast_community_circle_members")
      .select("member_id,role")
      .eq("circle_id", groupId);
    if (error) throw error;
    const rows = data || [];
    roster.querySelector("#crg-roster-count").textContent = String(rows.length);
    const names = await publicNames([...new Set(rows.map(row => row.member_id))]);
    rosterList.innerHTML = rows.length ? rows.map(row => {
      const name = names.get(row.member_id) || (row.member_id === user.id ? "You" : "Community member");
      return '<div class="crg-roster-person"><span class="crg-roster-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</span><span class="crg-roster-name">' + esc(name) + '</span><span class="crg-roster-role">' + esc(row.role || "member") + "</span></div>";
    }).join("") : notice("No member records are visible yet.");
  } catch (error) {
    rosterList.innerHTML = notice(error.message || "The member list is unavailable.");
  }

  const canModerate = group.owner_id === user.id || ["owner", "moderator"].includes(String(member.role || "").toLowerCase());
  if (!canModerate) return;

  const requests = document.createElement("section");
  requests.className = "crg-panel crg-requests-panel";
  requests.innerHTML = '<div class="crg-tool-heading"><div><span class="crg-kicker">GROUP MANAGEMENT</span><h3>Join requests</h3></div><span class="crg-tool-count" id="crg-request-count">—</span></div><div id="crg-request-list">' + notice("Loading requests…") + "</div>";
  aside.appendChild(requests);

  const requestList = requests.querySelector("#crg-request-list");
  const requestCount = requests.querySelector("#crg-request-count");

  async function refreshRequests() {
    requestList.innerHTML = notice("Checking pending requests…");
    const { data, error } = await sb.from("podcast_community_circle_join_requests")
      .select("id,user_id,status,created_at")
      .eq("circle_id", groupId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = data || [];
    requestCount.textContent = String(rows.length);
    if (!rows.length) {
      requestList.innerHTML = notice("You're all caught up. There are no pending requests.");
      return;
    }
    const names = await publicNames([...new Set(rows.map(row => row.user_id))]);
    requestList.innerHTML = rows.map(row => {
      const name = names.get(row.user_id) || "Podcasting member";
      return '<article class="crg-request-row" data-request="' + esc(row.id) + '"><div class="crg-request-copy"><strong>' + esc(name) + '</strong><small>Requested ' + esc(new Date(row.created_at).toLocaleDateString()) + '</small></div><div class="crg-request-actions"><button class="crg-btn" type="button" data-decision="approved">Approve</button><button class="crg-btn secondary" type="button" data-decision="declined">Decline</button></div></article>';
    }).join("");
    requestList.querySelectorAll("[data-decision]").forEach(button => {
      button.addEventListener("click", async () => {
        const row = button.closest("[data-request]");
        const requestId = row?.dataset.request;
        const decision = button.dataset.decision;
        if (!requestId || !decision) return;
        row.querySelectorAll("button").forEach(item => { item.disabled = true; });
        try {
          const { error: reviewError } = await sb.rpc("review_podcast_circle_join_request", {
            p_request_id: requestId,
            p_decision: decision
          });
          if (reviewError) throw reviewError;
          await refreshRequests();
        } catch (error) {
          row.querySelectorAll("button").forEach(item => { item.disabled = false; });
          const status = document.createElement("div");
          status.innerHTML = notice(error.message || "The request could not be reviewed.", "error");
          row.appendChild(status);
        }
      });
    });
  }

  try {
    await refreshRequests();
  } catch (error) {
    requestList.innerHTML = notice(error.message || "Join requests are unavailable.");
  }
}
