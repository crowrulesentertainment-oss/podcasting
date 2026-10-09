/* CrowRules Podcasting home live chat.
 * Public reads + authenticated writes. Requires public.podcasting_chat_messages
 * and the RLS policies in sql/podcasting_chat_setup.sql.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const feed = $("homeChatFeed"), state = $("homeChatState"), form = $("homeChatForm");
  const input = $("homeChatInput"), send = $("homeChatSend"), feedback = $("homeChatFeedback");
  if (!feed || !form) return;
  const C = window.CROW_CONFIG || {};
  let client = null, channel = null, currentUser = null, busy = false;
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function setState(value, label) { state.dataset.state = value; state.textContent = label; }
  function tell(message, kind = "") { feedback.textContent = message; feedback.dataset.kind = kind; }
  function showEmpty(message) { feed.innerHTML = '<div class="home-chat-empty">' + safe(message) + '</div>'; }
  function formatTime(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
  }
  function render(rows) {
    if (!rows.length) { showEmpty("No messages yet. Be the first to start a friendly conversation."); return; }
    feed.replaceChildren();
    rows.forEach(row => {
      const article = document.createElement("article");
      article.className = "home-chat-message";
      const head = document.createElement("div"); head.className = "home-chat-message-head";
      const name = document.createElement("b"); name.textContent = row.display_name || "CrowRules Member";
      const time = document.createElement("time"); time.dateTime = row.created_at || ""; time.textContent = formatTime(row.created_at);
      head.append(name, time);
      const body = document.createElement("p"); body.textContent = row.message || "";
      article.append(head, body); feed.appendChild(article);
    });
    feed.scrollTop = feed.scrollHeight;
  }
  function addMessage(row) {
    const empty = feed.querySelector(".home-chat-empty");
    if (empty) feed.replaceChildren();
    // Render with textContent; never inject user-supplied content as HTML.
    const article = document.createElement("article"); article.className = "home-chat-message";
    const head = document.createElement("div"); head.className = "home-chat-message-head";
    const name = document.createElement("b"); name.textContent = row.display_name || "CrowRules Member";
    const time = document.createElement("time"); time.dateTime = row.created_at || ""; time.textContent = formatTime(row.created_at);
    head.append(name, time);
    const body = document.createElement("p"); body.textContent = row.message || "";
    article.append(head, body); feed.appendChild(article);
    while (feed.children.length > 100) feed.removeChild(feed.firstElementChild);
    feed.scrollTop = feed.scrollHeight;
  }
  async function loadMessages() {
    const { data, error } = await client.from("podcasting_chat_messages")
      .select("id,user_id,display_name,message,created_at")
      .order("created_at", { ascending: true }).limit(100);
    if (error) throw error;
    render(data || []);
  }
  async function refreshAuth() {
    const { data, error } = await client.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") throw error;
    currentUser = data?.user || null;
    input.disabled = !currentUser;
    send.disabled = !currentUser || busy;
    $("homeChatPrompt").textContent = currentUser
      ? "You're signed in. Send a message to the community."
      : "Sign in with your CrowRules account to send a message. You can read public messages without signing in.";
    input.placeholder = currentUser ? "Write a message…" : "Sign in to join the conversation…";
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const message = input.value.trim();
    if (!message) { tell("Write a message before sending.", "error"); return; }
    if (!currentUser) { tell("Please sign in before sending a message.", "error"); return; }
    busy = true; send.disabled = true; send.textContent = "SENDING…"; tell("");
    try {
      const meta = currentUser.user_metadata || {};
      const displayName = String(meta.display_name || meta.full_name || meta.name || currentUser.email?.split("@")[0] || "CrowRules Member").slice(0,80);
      const { error } = await client.from("podcasting_chat_messages").insert({
        user_id: currentUser.id, display_name: displayName, message: message.slice(0,1000)
      });
      if (error) throw error;
      input.value = ""; tell("Message sent.", "success");
    } catch (error) {
      tell(error?.message?.includes("podcasting_chat_messages")
        ? "Chat database setup is required. Apply sql/podcasting_chat_setup.sql in your Supabase SQL Editor, then refresh."
        : "Message could not be sent. Check your connection and chat permissions, then try again.", "error");
    } finally {
      busy = false; send.textContent = "SEND MESSAGE →"; send.disabled = !currentUser;
    }
  });
  async function boot() {
    if (!window.supabase?.createClient || !C.supabaseUrl || !C.supabaseKey) {
      setState("error", "CHAT UNAVAILABLE"); showEmpty("Supabase configuration was not found. Chat cannot connect."); input.disabled = true; send.disabled = true; return;
    }
    try {
      client = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
      });
      await refreshAuth();
      await loadMessages();
      setState("online", "CHAT CONNECTED");
      channel = client.channel("podcasting-home-chat")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "podcasting_chat_messages" }, payload => {
          const row = payload.new;
          if (row?.id && !feed.querySelector('[data-chat-id="' + CSS.escape(String(row.id)) + '"]')) {
            addMessage(row);
            const last = feed.lastElementChild; if (last) last.dataset.chatId = String(row.id);
          }
        }).subscribe(statusText => {
          if (statusText === "CHANNEL_ERROR" || statusText === "TIMED_OUT") setState("error", "REALTIME RECONNECTING");
          else if (statusText === "SUBSCRIBED") setState("online", "CHAT CONNECTED");
        });
      client.auth.onAuthStateChange(() => { Promise.resolve().then(refreshAuth).catch(() => {}); });
    } catch (error) {
      setState("error", "CHAT NEEDS SETUP");
      showEmpty("Live chat could not load. Apply sql/podcasting_chat_setup.sql in Supabase and verify table access.");
      input.disabled = true; send.disabled = true;
    }
  }
  window.addEventListener("pagehide", () => { if (client && channel) client.removeChannel(channel); }, { once: true });
  boot();
})();