/* CrowRules Podcasting — Universal Admin Data Editor
 * Schema-aware JSON editor for approved application tables.
 * Requires an authenticated user with a database-verified administrator role.
 * Uses the public client and normal RLS; never embeds service-role credentials.
 */
(function () {
  "use strict";
  const cfg = window.CROW_CONFIG || {};
  if (!window.supabase?.createClient || !cfg.supabaseUrl || !cfg.supabaseKey) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const TABLES = [
    "members", "member_roles", "creators", "podcasts", "podcast_episodes",
    "episodes", "podcast_follows", "podcast_subscriptions",
    "podcast_user_saved_episodes", "podcast_listens", "podcast_play_events",
    "podcast_analytics_events", "podcast_member_reports",
    "cr_podcast_social_comments_v5", "cr_donations",
    "cr_podcast_stripe_accounts", "cr_podcast_creator_earnings", "cr_podcast_payouts"
  ];
  const ADMIN = new Set(["admin", "super_admin", "owner", "administrator"]);
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const css = `
    #universalAdminEditor{margin:22px 0 30px}
    #universalAdminEditor .uae-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    #universalAdminEditor .uae-grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.8fr);gap:12px}
    #universalAdminEditor .uae-json{width:100%;min-height:300px;resize:vertical;background:#070a13;color:#e2e8f0;border:1px solid #343951;border-radius:10px;padding:12px;font:12px/1.6 ui-monospace,Consolas,monospace}
    #universalAdminEditor .uae-records{max-height:520px;overflow:auto;display:grid;gap:7px}
    #universalAdminEditor .uae-record{width:100%;text-align:left;white-space:normal;overflow-wrap:anywhere}
    #universalAdminEditor .uae-record.active{border-color:#22d3ee;background:#10232d}
    #universalAdminEditor .uae-tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    #universalAdminEditor .uae-note{font-size:11px;line-height:1.65;color:#9ca3b5}
    #universalAdminEditor .uae-status{margin:10px 0}
    @media(max-width:800px){#universalAdminEditor .uae-grid{grid-template-columns:1fr}}
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  let root, tableSelect, searchInput, recordsEl, editor, statusEl, selected = null, rows = [], primaryKey = null, busy = false;
  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = "notice uae-status " + (ok ? "success" : "error");
    statusEl.classList.remove("hidden");
  }
  async function verifyAdmin() {
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) throw new Error("Sign in with your CrowRules administrator account to use the editor.");
    const { data: member, error } = await db.from("members").select("id,role").eq("user_id", user.id).maybeSingle();
    if (error) throw new Error("Could not verify administrator membership: " + error.message);
    if (!member) throw new Error("No CrowRules member record is linked to this account.");
    const { data: roles, error: roleError } = await db.from("member_roles").select("role").eq("member_id", member.id);
    if (roleError) throw new Error("Could not verify assigned roles: " + roleError.message);
    const all = [member.role, ...(roles || []).map(x => x.role)].filter(Boolean).map(x => String(x).toLowerCase());
    if (!all.some(x => ADMIN.has(x))) throw new Error("Access denied. A database-verified Admin role is required.");
    return user;
  }
  function makeRoot() {
    if (document.getElementById("universalAdminEditor")) return;
    root = document.createElement("section");
    root.id = "universalAdminEditor";
    root.className = "section panel";
    root.innerHTML = `
      <div class="uae-head"><div><div class="eyebrow">FULL CONTROL • DATABASE EDITOR</div><h2 style="margin:8px 0">UNIVERSAL CONTENT & RECORD EDITOR</h2><p class="muted">Edit supported CrowRules Podcasting records and fields from one workspace.</p></div><span class="pill open" id="uaeAuthState">VERIFYING ACCESS</span></div>
      <div class="notice uae-note">Changes save directly through Supabase and remain subject to database permissions and Row Level Security. Select a record to edit its fields as JSON. Add creates a new row; Delete is permanent and requires confirmation. Some tables may be read-only or require fields/relationships the database enforces.</div>
      <div class="uae-tools"><label for="uaeTable" class="small">TABLE</label><select id="uaeTable" class="field">${TABLES.map(t=>'<option value="'+t+'">'+t+'</option>').join("")}</select><input id="uaeSearch" class="field search" placeholder="Filter loaded records…"><button class="btn" id="uaeReload">LOAD / REFRESH</button><button class="btn primary" id="uaeNew">NEW RECORD</button></div>
      <div id="uaeStatus" class="notice uae-status hidden" role="status" aria-live="polite"></div>
      <div class="uae-grid"><div class="panel"><h3 style="font:700 12px Orbitron;margin-top:0">RECORDS <span id="uaeCount" class="muted"></span></h3><div id="uaeRecords" class="uae-records"><p class="muted">Loading records…</p></div></div>
      <div class="panel"><div class="uae-head"><h3 style="font:700 12px Orbitron;margin:0">RECORD JSON</h3><span id="uaeSelected" class="muted small">No record selected</span></div><p class="uae-note">Keep JSON valid. Existing records must retain their primary key. For safety, this editor loads at most 200 rows at a time.</p><textarea id="uaeJson" class="uae-json" spellcheck="false" aria-label="Record JSON"></textarea><div class="uae-tools"><button class="btn primary" id="uaeSave">SAVE CHANGES</button><button class="btn danger" id="uaeDelete">DELETE RECORD</button><button class="btn" id="uaeClear">CLEAR SELECTION</button></div></div></div>`;
    const app = document.getElementById("app");
    (app?.parentElement || document.querySelector("main") || document.body).appendChild(root);
    tableSelect = root.querySelector("#uaeTable"); searchInput = root.querySelector("#uaeSearch");
    recordsEl = root.querySelector("#uaeRecords"); editor = root.querySelector("#uaeJson");
    statusEl = root.querySelector("#uaeStatus");
    root.querySelector("#uaeReload").addEventListener("click", loadRows);
    root.querySelector("#uaeNew").addEventListener("click", newRecord);
    root.querySelector("#uaeSave").addEventListener("click", saveRecord);
    root.querySelector("#uaeDelete").addEventListener("click", deleteRecord);
    root.querySelector("#uaeClear").addEventListener("click", clearSelection);
    tableSelect.addEventListener("change", () => { clearSelection(); loadRows(); });
    searchInput.addEventListener("input", renderRows);
    recordsEl.addEventListener("click", e => {
      const b = e.target.closest("[data-record-index]");
      if (b) selectRecord(Number(b.dataset.recordIndex));
    });
  }
  function guessKey(row) {
    if (!row || typeof row !== "object") return null;
    for (const key of ["id", "uuid", "member_id", "podcast_id", "episode_id", "user_id"]) {
      if (Object.prototype.hasOwnProperty.call(row, key)) return key;
    }
    return null;
  }
  async function loadRows() {
    if (busy) return;
    busy = true; selected = null; primaryKey = null; editor.value = "";
    try {
      await verifyAdmin();
      const table = tableSelect.value;
      const { data, error } = await db.from(table).select("*").limit(200);
      if (error) throw error;
      rows = data || [];
      primaryKey = guessKey(rows[0]);
      root.querySelector("#uaeAuthState").textContent = "ADMIN VERIFIED";
      root.querySelector("#uaeAuthState").className = "pill published";
      root.querySelector("#uaeSelected").textContent = primaryKey ? "Key: " + primaryKey : "Key not detected";
      renderRows();
      setStatus("Loaded " + rows.length + " record(s) from " + table + ". " + (rows.length === 200 ? "Showing first 200 rows." : ""), true);
    } catch (e) {
      rows = []; renderRows(); setStatus(e.message || String(e), false);
    } finally { busy = false; }
  }
  function renderRows() {
    if (!recordsEl) return;
    const q = (searchInput.value || "").trim().toLowerCase();
    const filtered = rows.map((row, i) => ({row, i})).filter(({row}) => !q || JSON.stringify(row).toLowerCase().includes(q));
    root.querySelector("#uaeCount").textContent = "(" + filtered.length + "/" + rows.length + ")";
    recordsEl.innerHTML = filtered.length ? filtered.map(({row, i}) => {
      const key = guessKey(row), value = key ? row[key] : "row " + (i + 1);
      const title = row.title || row.display_name || row.name || row.email || row.slug || value;
      const sub = [key && (key + ": " + value), row.status && ("status: " + row.status)].filter(Boolean).join(" • ");
      return '<button class="btn uae-record ' + (selected === i ? "active" : "") + '" data-record-index="' + i + '"><strong>' + esc(title) + '</strong><div class="uae-note">' + esc(sub || JSON.stringify(row).slice(0, 100)) + '</div></button>';
    }).join("") : '<p class="muted">No records found for this filter. Use NEW RECORD to create one.</p>';
  }
  function selectRecord(i) {
    if (!rows[i]) return;
    selected = i; primaryKey = guessKey(rows[i]); editor.value = JSON.stringify(rows[i], null, 2);
    root.querySelector("#uaeSelected").textContent = primaryKey ? primaryKey + " = " + rows[i][primaryKey] : "Primary key could not be inferred";
    renderRows();
  }
  function clearSelection() { selected = null; editor.value = ""; root.querySelector("#uaeSelected").textContent = "No record selected"; renderRows(); }
  function newRecord() {
    selected = null; primaryKey = guessKey(rows[0]);
    editor.value = JSON.stringify({}, null, 2);
    root.querySelector("#uaeSelected").textContent = "NEW RECORD • fill required fields";
    renderRows(); setStatus("Enter the fields required by the selected table, then choose SAVE CHANGES.", true);
  }
  async function saveRecord() {
    if (busy) return;
    let value;
    try { value = JSON.parse(editor.value); } catch (e) { setStatus("Invalid JSON: " + e.message, false); return; }
    if (!value || Array.isArray(value) || typeof value !== "object") { setStatus("Record must be a JSON object.", false); return; }
    busy = true;
    try {
      await verifyAdmin();
      const table = tableSelect.value;
      let result;
      if (selected !== null && rows[selected]) {
        const old = rows[selected], key = guessKey(old);
        if (!key || old[key] == null) throw new Error("Cannot safely update this row because its primary key was not detected.");
        if (value[key] !== old[key]) throw new Error("Do not change the primary key (" + key + ").");
        const patch = {...value}; delete patch[key];
        result = await db.from(table).update(patch).eq(key, old[key]).select("*").maybeSingle();
      } else {
        result = await db.from(table).insert(value).select("*").maybeSingle();
      }
      if (result.error) throw result.error;
      if (!result.data) throw new Error("No row was returned. Check RLS, table permissions, and required fields.");
      setStatus((selected !== null ? "Record updated" : "Record created") + " successfully.", true);
      await loadRows();
      const key = guessKey(result.data);
      const idx = key ? rows.findIndex(r => String(r[key]) === String(result.data[key])) : -1;
      if (idx >= 0) selectRecord(idx);
    } catch (e) { setStatus("Save failed: " + (e.message || String(e)), false); }
    finally { busy = false; }
  }
  async function deleteRecord() {
    if (busy) return;
    if (selected === null || !rows[selected]) { setStatus("Select an existing record before deleting.", false); return; }
    const row = rows[selected], key = guessKey(row);
    if (!key || row[key] == null) { setStatus("Cannot safely delete: primary key could not be detected.", false); return; }
    if (!confirm("PERMANENTLY DELETE this " + tableSelect.value + " record where " + key + " = " + row[key] + "? This cannot be undone.")) return;
    busy = true;
    try {
      await verifyAdmin();
      const { data, error } = await db.from(tableSelect.value).delete().eq(key, row[key]).select(key);
      if (error) throw error;
      if (!data?.length) throw new Error("No row was deleted. RLS may block this operation or the row may not exist.");
      setStatus("Record deleted.", true); await loadRows();
    } catch (e) { setStatus("Delete failed: " + (e.message || String(e)), false); }
    finally { busy = false; }
  }
  function start() {
    if (document.getElementById("app") && !document.getElementById("universalAdminEditor")) {
      makeRoot(); loadRows();
    }
  }
  const observer = new MutationObserver(() => { if (!document.getElementById("universalAdminEditor")) start(); });
  observer.observe(document.body, {childList:true, subtree:true});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true}); else start();
})();