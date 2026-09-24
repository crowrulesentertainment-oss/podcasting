/* CrowRules Podcasting — Member Platform State Bus + Optimistic Actions */
(() => {
  "use strict";

  const TABLES = [
    ["podcast_follows", "user_id"],
    ["podcast_saved_episodes", "user_id"],
    ["podcast_episode_progress", "user_id"],
    ["podcast_notifications", "user_id"],
    ["podcast_member_profile_stats", "user_id"],
    ["membership_subscriptions", "user_id"],
    ["podcast_member_profiles", "user_id"],
    ["podcast_member_follows", "follower_user_id"],
    ["podcast_notification_preferences", "user_id"]
  ];

  let client = null;
  let userId = null;
  let channel = null;
  let pollTimer = null;
  let started = false;
  const pending = new Map();

  function getClient() {
    if (client) return client;
    if (window.supabaseClient) return (client = window.supabaseClient);
    if (window.supabase && window.CROWRULES_SUPABASE_URL && window.CROWRULES_SUPABASE_PUBLISHABLE_KEY) {
      client = window.window.CrowRulesData.getClient();
    }
    return client;
  }

  function emit(reason, payload = {}) {
    const detail = { reason, at: new Date().toISOString(), ...payload };
    window.dispatchEvent(new CustomEvent("crowrules:member-state", { detail }));

    try {
      if ("BroadcastChannel" in window) {
        if (!window.__crowRulesMemberBroadcast) {
          window.__crowRulesMemberBroadcast = new BroadcastChannel("crowrules-member-platform");
          window.__crowRulesMemberBroadcast.onmessage = event => {
            if (event.data?.source === "crowrules-member-state") {
              window.dispatchEvent(new CustomEvent("crowrules:member-state", {
                detail: { ...event.data, crossPage: true }
              }));
            }
          };
        }
        window.__crowRulesMemberBroadcast.postMessage({
          source: "crowrules-member-state",
          reason,
          at: detail.at
        });
      }
    } catch (_) {}
  }

  function actionId(prefix = "action") {
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  }

  async function optimistic({
    key = actionId(),
    label = "Action",
    apply,
    rollback,
    commit,
    success = label + " complete",
    failure = label + " failed",
    timeout = 15000
  }) {
    if (typeof apply !== "function" || typeof commit !== "function") {
      throw new Error("Optimistic action requires apply and commit functions.");
    }
    if (pending.has(key)) return pending.get(key);

    let resolvePending;
    const promise = new Promise(resolve => { resolvePending = resolve; });
    pending.set(key, promise);

    let applied = false;
    try {
      await apply();
      applied = true;
      emit("optimistic-start", { key, label });

      const result = await Promise.race([
        Promise.resolve().then(commit),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timed out.")), timeout)
        )
      ]);

      if (result?.error) throw result.error;

      emit("optimistic-success", { key, label, result });
      if (window.CrowRulesPro?.toast) window.CrowRulesPro.toast("✓ " + success);
      resolvePending({ ok: true, result });
      return { ok: true, result };
    } catch (error) {
      if (applied && typeof rollback === "function") {
        try { await rollback(); } catch (_) {}
      }
      emit("optimistic-rollback", {
        key,
        label,
        error: error?.message || String(error)
      });
      if (window.CrowRulesPro?.toast) window.CrowRulesPro.toast("↩ " + failure);
      resolvePending({ ok: false, error });
      return { ok: false, error };
    } finally {
      pending.delete(key);
    }
  }

  async function start() {
    if (started) return;
    const db = getClient();
    if (!db) return;
    started = true;

    const auth = await window.CrowRulesData.getUser().then(user=>({data:{user}}));
    userId = auth.data?.user?.id || null;
    if (!userId) {
      emit("signed-out");
      return;
    }

    channel = db.channel("crowrules-member-platform-" + userId.slice(0, 12));

    TABLES.forEach(([table, column]) => {
      channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table,
        filter: column + "=eq." + userId
      }, payload => {
        emit("database-change", {
          table,
          event: payload.eventType,
          record: payload.new || payload.old || null
        });
      });
    });

    channel.subscribe(status => emit("realtime-status", { status }));

    db.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id || null;
      if (nextId !== userId || event === "SIGNED_OUT") {
        userId = nextId;
        emit(event === "SIGNED_OUT" ? "signed-out" : "auth-change", { event });
      }
    });

    pollTimer = setInterval(() => emit("sync-pulse"), 30000);
    window.addEventListener("focus", () => emit("focus-sync"));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) emit("visibility-sync");
    });

    window.CrowRulesMemberState = {
      userId,
      client: db,
      notify: emit,
      optimistic,
      pending,
      stop: async () => {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
        if (channel) {
          try { await db.removeChannel(channel); } catch (_) {}
        }
        channel = null;
        started = false;
      }
    };

    emit("ready", { userId });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
