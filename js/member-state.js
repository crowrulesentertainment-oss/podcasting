/* CrowRules Podcasting — Member Platform State Bus */
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

  function getClient() {
    if (client) return client;
    if (window.supabaseClient) {
      client = window.supabaseClient;
      return client;
    }
    if (window.supabase && window.CROWRULES_SUPABASE_URL && window.CROWRULES_SUPABASE_PUBLISHABLE_KEY) {
      client = window.supabase.createClient(
        window.CROWRULES_SUPABASE_URL,
        window.CROWRULES_SUPABASE_PUBLISHABLE_KEY
      );
    }
    return client;
  }

  function emit(reason, payload = {}) {
    const detail = {
      reason,
      at: new Date().toISOString(),
      ...payload
    };
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

  async function start() {
    if (started) return;
    const db = getClient();
    if (!db) return;

    started = true;

    const auth = await db.auth.getUser();
    userId = auth.data?.user?.id || null;
    if (!userId) {
      emit("signed-out");
      return;
    }

    if (channel) {
      try { await db.removeChannel(channel); } catch (_) {}
    }

    channel = db.channel("crowrules-member-platform-" + userId.slice(0, 12));

    TABLES.forEach(([table, column]) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: column + "=eq." + userId
        },
        payload => {
          emit("database-change", {
            table,
            event: payload.eventType,
            record: payload.new || payload.old || null
          });
        }
      );
    });

    channel
      .on("system", {}, payload => {
        emit("realtime-system", { status: payload?.status || null });
      })
      .subscribe(status => {
        emit("realtime-status", { status });
      });

    db.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id || null;
      if (nextId !== userId || event === "SIGNED_OUT") {
        userId = nextId;
        emit(event === "SIGNED_OUT" ? "signed-out" : "auth-change", { event });
      }
    });

    pollTimer = window.setInterval(() => {
      emit("sync-pulse");
    }, 30000);

    window.addEventListener("focus", () => emit("focus-sync"));
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) emit("visibility-sync");
    });

    window.CrowRulesMemberState = {
      userId,
      client: db,
      notify: emit,
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
