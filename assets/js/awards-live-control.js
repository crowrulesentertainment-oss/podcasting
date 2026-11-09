import { sb } from "./client.js";
import { FUNCTIONS, SITE_BASE } from "./config.js";

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const app = $("#controlApp");
const message = $("#controlMessage");
let seasons = [];
let polls = [];
let refreshTimer = null;
let channel = null;
let busy = false;
let searchTerm = "";
let statusFilter = "all";

function status(text, type = "") {
  message.textContent = text;
  message.className = "control-status" + (type ? " " + type : "");
}
function failMessage(error) {
  return error?.message || error?.details || error?.hint || String(error || "Unknown error");
}
async function checkAdmin() {
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError) throw userError;
  if (!userData?.user) {
    location.href = SITE_BASE + "login.html?next=awards-control.html";
    return false;
  }
  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData?.session?.access_token;
  if (!token) {
    location.href = SITE_BASE + "login.html?next=awards-control.html";
    return false;
  }
  const { data, error } = await sb.functions.invoke(FUNCTIONS.adminBootstrap, {
    body: {},
    headers: { Authorization: "Bearer " + token }
  });
  if (error) throw new Error("Administrator verification failed: " + failMessage(error));
  if (!data?.ok || !["active", "initialized"].includes(data.status)) {
    throw new Error(data?.message || data?.error || "Administrator access is not active for this account.");
  }
  return true;
}

async function loadData() {
  const [seasonResult, pollResult] = await Promise.all([
    sb.from("crowrules_award_seasons")
      .select("id,slug,title,created_at")
      .order("created_at", { ascending: false }),
    sb.from("crowrules_award_live_polls")
      .select("id,season_id,question,description,status,results_visible,starts_at,ends_at,created_at,updated_at")
      .order("created_at", { ascending: false })
  ]);
  if (seasonResult.error) throw new Error("Could not load award seasons: " + failMessage(seasonResult.error));
  if (pollResult.error) throw new Error("Could not load ceremony polls: " + failMessage(pollResult.error));
  seasons = seasonResult.data || [];
  polls = pollResult.data || [];

  const ids = polls.map((poll) => poll.id);
  let options = [];
  if (ids.length) {
    const result = await sb.from("crowrules_award_live_poll_options")
      .select("id,poll_id,label,sort_order")
      .in("poll_id", ids)
      .order("sort_order", { ascending: true });
    if (result.error) throw new Error("Could not load poll answer options: " + failMessage(result.error));
    options = result.data || [];
  }
  const optionsByPoll = new Map(polls.map((poll) => [
    poll.id, options.filter((option) => option.poll_id === poll.id)
  ]));
  render(optionsByPoll);
  await loadCounts();
}

function render(optionsByPoll = new Map()) {
  const active = polls.filter((poll) => poll.status === "active").length;
  const draft = polls.filter((poll) => poll.status === "draft").length;
  const seasonOptions = seasons.map((season) =>
    '<option value="' + esc(season.id) + '">' + esc(season.title) + "</option>"
  ).join("");

  const visiblePolls = polls.filter((poll) => {
    const matchesStatus = statusFilter === "all" || poll.status === statusFilter;
    const seasonName = seasons.find((season) => season.id === poll.season_id)?.title || "";
    const matchesSearch = (poll.question + " " + seasonName).toLowerCase().includes(searchTerm);
    return matchesStatus && matchesSearch;
  });

  app.innerHTML = `
    <section class="control-stats" aria-label="Poll overview">
      <div class="control-stat"><span>AWARD SEASONS</span><b>${seasons.length}</b></div>
      <div class="control-stat"><span>TOTAL POLLS</span><b>${polls.length}</b></div>
      <div class="control-stat"><span>LIVE NOW</span><b>${active}</b></div>
      <div class="control-stat"><span>DRAFTS</span><b>${draft}</b></div>
    </section>
    <section class="control-panel">
      <div class="control-section-head"><div><span class="eyebrow">CEREMONY PRODUCTION</span><h2>Create a new audience poll</h2><p class="control-help">Build the question and answer choices before the ceremony. Drafts are not visible to the audience.</p></div></div>
      ${seasons.length ? `
      <form id="newPoll">
        <div class="control-form-grid">
          <label>AWARD SEASON<select name="season_id" required>${seasonOptions}</select></label>
          <label>POLL QUESTION<input name="question" required maxlength="300" placeholder="Which moment defined tonight for you?"></label>
        </div>
        <label class="control-field-gap">HOST INTRO / DESCRIPTION<textarea name="description" maxlength="1000" placeholder="A short prompt to read aloud before opening the poll."></textarea></label>
        <label class="control-field-gap">ANSWER OPTIONS <span class="control-help">One answer per line. Add 2–8 unique choices.</span><textarea name="options" required placeholder="The opening announcement&#10;The creator stories&#10;The community awards&#10;The final reveal"></textarea></label>
        <div class="control-actions"><button class="control-btn" type="submit">CREATE DRAFT POLL</button></div>
      </form>` : '<div class="control-access"><h2>No award season found</h2><p>Create or publish an award season in the main Admin Center before creating a ceremony poll.</p><a class="outline-button" href="admin.html?tab=awards">OPEN AWARDS ADMIN ↗</a></div>'}
    </section>
    <section class="control-panel">
      <div class="control-section-head"><div><span class="eyebrow">LIVE CEREMONY MANAGEMENT</span><h2>Poll control desk</h2><p class="control-help">Launch drafts, monitor audience responses, close voting and reveal results on the public ceremony page.</p></div><button class="control-btn secondary" id="refreshPolls" type="button">↻ REFRESH</button></div>
      <div class="control-toolbar">
        <input id="pollSearch" type="search" aria-label="Search polls" placeholder="Search poll questions…" value="${esc(searchTerm)}">
        <select id="pollStatusFilter" aria-label="Filter polls">
          <option value="all" ${statusFilter === "all" ? "selected" : ""}>All statuses</option>
          <option value="draft" ${statusFilter === "draft" ? "selected" : ""}>Drafts</option>
          <option value="active" ${statusFilter === "active" ? "selected" : ""}>Live</option>
          <option value="closed" ${statusFilter === "closed" ? "selected" : ""}>Closed</option>
          <option value="archived" ${statusFilter === "archived" ? "selected" : ""}>Archived</option>
        </select>
      </div>
      <div id="pollAdminList">${visiblePolls.length ? visiblePolls.map((poll) => renderPoll(poll, optionsByPoll.get(poll.id) || [])).join("") : '<div class="control-access"><h2>No matching polls</h2><p>Create a poll above or change the search/filter.</p></div>'}</div>
      <p class="control-help control-last-sync" id="lastPollSync">Updates automatically while this page is open.</p>
    </section>`;

  const form = $("#newPoll");
  if (form) form.addEventListener("submit", createPoll);
  $("#refreshPolls")?.addEventListener("click", refresh);
  $("#pollSearch")?.addEventListener("change", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    render(optionsByPoll);
  });
  $("#pollStatusFilter")?.addEventListener("change", (event) => {
    statusFilter = event.target.value;
    render(optionsByPoll);
  });
  app.querySelectorAll("[data-poll-action]").forEach((button) => {
    button.addEventListener("click", () => act(button.dataset.pollAction, button.dataset.pollId));
  });
  app.querySelectorAll("[data-edit-poll]").forEach((button) => {
    button.addEventListener("click", () => editDraft(button.dataset.editPoll));
  });
}

function renderPoll(poll, options) {
  const season = seasons.find((item) => item.id === poll.season_id)?.title || "Award season";
  const statusClass = poll.status === "active" ? "live" : poll.status === "closed" ? "closed" : "";
  const controls = [];
  if (poll.status === "draft") {
    controls.push('<button class="control-btn secondary" data-edit-poll="' + poll.id + '">EDIT DRAFT</button>');
    controls.push('<button class="control-btn" data-poll-action="activate" data-poll-id="' + poll.id + '">LAUNCH POLL</button>');
  }
  if (poll.status === "active") controls.push('<button class="control-btn danger" data-poll-action="close" data-poll-id="' + poll.id + '">CLOSE VOTING</button>');
  if (poll.status !== "archived") {
    controls.push('<button class="control-btn secondary" data-poll-action="reveal" data-poll-id="' + poll.id + '">' + (poll.results_visible ? "HIDE RESULTS" : "REVEAL RESULTS") + "</button>");
    controls.push('<button class="control-btn secondary" data-poll-action="archive" data-poll-id="' + poll.id + '">ARCHIVE</button>');
  }
  return `
    <article class="control-poll">
      <div class="control-poll-head"><div><span class="eyebrow">${esc(season)}</span><h3>${esc(poll.question)}</h3><small>${options.length} answer choices · Created ${new Date(poll.created_at).toLocaleString()}</small></div><span class="control-flag ${statusClass}">${esc(poll.status.toUpperCase())}</span></div>
      <p class="control-help">${esc(poll.description || "No host intro added.")}</p>
      <div class="control-answer-preview">${options.map((option) => '<span>' + esc(option.label) + "</span>").join("")}</div>
      <div class="control-poll-results" data-results="${poll.id}"><span class="control-help">Loading response totals…</span></div>
      <div class="control-actions">${controls.join("")}</div>
    </article>`;
}

function parseOptions(value) {
  const options = value.split("\n").map((item) => item.trim()).filter(Boolean);
  if (options.length < 2 || options.length > 8) throw new Error("Enter between two and eight answer options.");
  if (new Set(options.map((item) => item.toLocaleLowerCase())).size !== options.length) throw new Error("Remove duplicate answer options.");
  return options;
}

async function createPoll(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const options = parseOptions(form.elements.options.value);
    const { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData?.user) throw userError || new Error("Your sign-in session expired. Sign in again.");
    const { data: poll, error } = await sb.from("crowrules_award_live_polls").insert({
      season_id: form.elements.season_id.value,
      question: form.elements.question.value.trim(),
      description: form.elements.description.value.trim(),
      status: "draft",
      created_by: userData.user.id
    }).select("*").single();
    if (error) throw error;
    const optionResult = await sb.from("crowrules_award_live_poll_options").insert(
      options.map((label, index) => ({ poll_id: poll.id, label, sort_order: index }))
    );
    if (optionResult.error) {
      await sb.from("crowrules_award_live_polls").delete().eq("id", poll.id);
      throw optionResult.error;
    }
    status("Draft poll created successfully.", "success");
    form.reset();
    await refresh();
  } catch (error) {
    status("Could not create poll: " + failMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

async function editDraft(id) {
  const poll = polls.find((item) => item.id === id);
  if (!poll || poll.status !== "draft") return;
  const question = prompt("Edit poll question:", poll.question);
  if (question === null) return;
  const description = prompt("Edit host intro / description:", poll.description || "");
  if (description === null) return;
  const current = await sb.from("crowrules_award_live_poll_options")
    .select("label").eq("poll_id", id).order("sort_order", { ascending: true });
  if (current.error) return status("Could not load draft options: " + failMessage(current.error), "error");
  const answerText = prompt("Edit answer choices (one per line):", (current.data || []).map((item) => item.label).join("\n"));
  if (answerText === null) return;
  try {
    const options = parseOptions(answerText);
    if (!question.trim()) throw new Error("The poll question cannot be empty.");
    const update = await sb.from("crowrules_award_live_polls")
      .update({ question: question.trim(), description: description.trim() }).eq("id", id);
    if (update.error) throw update.error;
    const remove = await sb.from("crowrules_award_live_poll_options").delete().eq("poll_id", id);
    if (remove.error) throw remove.error;
    const add = await sb.from("crowrules_award_live_poll_options").insert(
      options.map((label, index) => ({ poll_id: id, label, sort_order: index }))
    );
    if (add.error) throw add.error;
    status("Draft poll updated.", "success");
    await refresh();
  } catch (error) {
    status("Draft update failed: " + failMessage(error), "error");
  }
}

async function act(action, id) {
  if (busy) return;
  const poll = polls.find((item) => item.id === id);
  if (!poll) return;
  const confirmations = {
    activate: "Launch this poll for the audience now?",
    close: "Close voting now? Members will no longer be able to vote.",
    archive: "Archive this poll? It will no longer appear as an active ceremony poll."
  };
  if (confirmations[action] && !confirm(confirmations[action])) return;
  busy = true;
  try {
    let patch = {};
    if (action === "activate") {
      const options = await sb.from("crowrules_award_live_poll_options").select("id").eq("poll_id", id);
      if (options.error) throw options.error;
      if ((options.data || []).length < 2) throw new Error("A poll needs at least two answer options.");
      const anotherLive = polls.find((item) => item.season_id === poll.season_id && item.status === "active" && item.id !== id);
      if (anotherLive) throw new Error("Another poll is already live for this award season. Close it before launching this one.");
      patch = { status: "active", starts_at: new Date().toISOString(), ends_at: null };
    } else if (action === "close") {
      patch = { status: "closed", ends_at: new Date().toISOString() };
    } else if (action === "reveal") {
      patch = { results_visible: !poll.results_visible };
    } else if (action === "archive") {
      patch = { status: "archived", ends_at: poll.ends_at || new Date().toISOString() };
    }
    const { data, error } = await sb.from("crowrules_award_live_polls")
      .update(patch).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No poll was updated. Check that your administrator permissions are still active.");
    status(action === "activate" ? "Poll is now live on the public ceremony page." :
      action === "close" ? "Voting is closed." :
      action === "reveal" ? (patch.results_visible ? "Results are visible to the audience." : "Results are hidden from the audience.") :
      "Poll archived.", "success");
    busy = false;
    await refresh();
  } catch (error) {
    status("Poll action failed: " + failMessage(error), "error");
  } finally {
    busy = false;
  }
}

async function loadCounts() {
  for (const poll of polls) {
    const box = document.querySelector('[data-results="' + poll.id + '"]');
    if (!box) continue;
    const { data, error } = await sb.rpc("crowrules_get_award_live_poll_results", { p_poll_id: poll.id });
    if (error) {
      box.innerHTML = '<span class="control-help">Response totals unavailable: ' + esc(failMessage(error)) + "</span>";
      continue;
    }
    const rows = data || [];
    const total = rows.reduce((sum, row) => sum + Number(row.votes || 0), 0);
    box.innerHTML = rows.map((row) => {
      const votes = Number(row.votes || 0);
      const percent = total ? Math.round(votes / total * 100) : 0;
      return '<div class="control-result-row"><span>' + esc(row.label) +
        '</span><b>' + votes + ' · ' + percent + '%</b></div>';
    }).join("") + '<div class="control-help">TOTAL RESPONSES: ' + total +
      (poll.results_visible ? " · RESULTS PUBLIC" : " · PRIVATE HOST VIEW") + "</div>";
  }
  const sync = $("#lastPollSync");
  if (sync) sync.textContent = "Last updated " + new Date().toLocaleTimeString() + " · Auto-refresh every 10 seconds";
}

async function refresh() {
  if (busy) return;
  try {
    await loadData();
    status("Poll control desk is up to date.", "success");
  } catch (error) {
    status("Could not refresh poll control: " + failMessage(error), "error");
  }
}

async function start() {
  try {
    if (!app || !message) throw new Error("The control page is missing a required page element. Refresh the page or contact CrowRules support.");
    if (!await checkAdmin()) return;
    status("Administrator access verified. Loading the poll control desk…", "success");
    await loadData();
    refreshTimer = setInterval(() => { if (!busy) refresh(); }, 10000);
    channel = sb.channel("crowrules-awards-poll-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "crowrules_award_live_polls" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "crowrules_award_live_poll_options" }, () => refresh())
      .subscribe();
    window.addEventListener("pagehide", () => {
      clearInterval(refreshTimer);
      if (channel) sb.removeChannel(channel);
    }, { once: true });
  } catch (error) {
    const reason = failMessage(error);
    status(reason, "error");
    app.innerHTML = '<div class="control-access"><h2>Control room could not load</h2><p>' +
      esc(reason) + '</p><a class="gold-button" href="' + SITE_BASE +
      'login.html?next=awards-control.html">SIGN IN / RETURN</a><p class="control-help">If you are already signed in, refresh the page after signing in again. Your existing polls have not been changed.</p></div>';
  }
}
start();
