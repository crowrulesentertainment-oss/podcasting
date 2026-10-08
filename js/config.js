// CrowRules Podcasting public browser configuration.
// Publishable key only — never place a Supabase service-role/secret key here.
// Sitewide singleton: every Podcasting page shares the same Supabase client/session.
window.CROW_PODCASTING_CONFIG = {
  supabaseUrl: "https://cevylpnoexugwgygvtgu.supabase.co",
  supabasePublishableKey: "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-",
  stripeCheckoutFunction: "podcast-subscription-checkout"
};

(() => {
  "use strict";
  const C = window.CROW_PODCASTING_CONFIG;
  if (!C?.supabaseUrl || !C?.supabasePublishableKey) {
    console.error("CrowRules Podcasting: Supabase configuration is missing.");
    return;
  }
  if (!window.supabase?.createClient) {
    console.error("CrowRules Podcasting: Supabase JS client did not load before config.js.");
    window.CROW_SUPABASE_READY = Promise.reject(new Error("Supabase JS client unavailable"));
    return;
  }
  if (!window.CROW_PODCASTING) {
    try {
      window.CROW_PODCASTING = window.supabase.createClient(
        C.supabaseUrl,
        C.supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce"
          }
        }
      );
    } catch (error) {
      console.error("CrowRules Podcasting: failed to initialize Supabase.", error);
      window.CROW_SUPABASE_READY = Promise.reject(error);
      return;
    }
  }

  const sb = window.CROW_PODCASTING;
  window.CROW_SUPABASE_READY = Promise.resolve(sb);

  // Sitewide holiday theme: one setting controls every Podcasting page.
  const applyHolidayTheme = (row) => {
    const enabled = !!row?.holiday_enabled;
    const theme = String(row?.holiday_theme || "standard").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const allowed = new Set(["standard","halloween","christmas","thanksgiving","newyear","valentines","spring"]);
    const safeTheme = allowed.has(theme) ? theme : "standard";
    document.documentElement.classList.remove(...Array.from(allowed).filter(x => x !== "standard").map(x => "theme-" + x));
    if (enabled && safeTheme !== "standard") document.documentElement.classList.add("theme-" + safeTheme);
    document.documentElement.dataset.crowHolidayTheme = enabled ? safeTheme : "standard";
    document.documentElement.dataset.crowHolidayEnabled = enabled ? "true" : "false";
    window.CROW_HOLIDAY_THEME = { enabled, theme: enabled ? safeTheme : "standard" };
    if (enabled && safeTheme === "halloween") halloweenFX(); else removeHalloweenFX();
    window.dispatchEvent(new CustomEvent("crowrules:holiday-theme", { detail: window.CROW_HOLIDAY_THEME }));
  };
  window.CROW_APPLY_HOLIDAY_THEME = applyHolidayTheme;
  // Halloween atmosphere controller: adds lightweight cinematic particle layers.
  const halloweenFX = () => {
    if (document.getElementById("crow-halloween-fx")) return;
    const root = document.createElement("div"); root.id="crow-halloween-fx"; root.setAttribute("aria-hidden","true");
    root.innerHTML='<div class="crow-halloween-moon"></div><div class="crow-halloween-fog fog-a"></div><div class="crow-halloween-fog fog-b"></div><div class="crow-halloween-ghosts"><span class="ghost g1">👻</span><span class="ghost g2">👻</span><span class="ghost g3">👻</span></div><div class="crow-halloween-witches"><span class="witch w1">🧙‍♀️</span><span class="witch w2">🧙‍♀️</span></div><div class="crow-halloween-bats"><span>🦇</span><span>🦇</span><span>🦇</span><span>🦇</span></div><div class="crow-halloween-pumpkins"><span>🎃</span><span>🎃</span><span>🎃</span></div><div class="crow-halloween-embers"></div>';
    document.body.appendChild(root);
    const emb=root.querySelector(".crow-halloween-embers");
    for(let i=0;i<18;i++){const p=document.createElement("i");p.style.setProperty("--x",Math.random()*100+"vw");p.style.setProperty("--d",(5+Math.random()*10)+"s");p.style.setProperty("--delay",(-Math.random()*12)+"s");p.style.setProperty("--drift",(-35+Math.random()*70)+"px");emb.appendChild(p);}
  };
  const removeHalloweenFX = () => document.getElementById("crow-halloween-fx")?.remove();

  const loadHolidayTheme = async () => {
    try {
      const { data, error } = await sb.from("crp_site_settings").select("holiday_theme,holiday_enabled,updated_at").eq("site_key", "podcasting").maybeSingle();
      if (!error) applyHolidayTheme(data || null);
    } catch (error) { console.warn("CrowRules Podcasting: holiday theme bootstrap failed.", error); }
  };
  loadHolidayTheme();
  try {
    sb.channel("crowrules-sitewide-theme")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crp_site_settings", filter: "site_key=eq.podcasting" }, payload => applyHolidayTheme(payload.new))
      .subscribe();
  } catch (error) { console.warn("CrowRules Podcasting: holiday theme realtime unavailable.", error); }

  if (!window.CROW_AUTH_STATE) {
    window.CROW_AUTH_STATE = { session: null, user: null, event: "INITIALIZED" };
  }

  const publish = (event, session) => {
    const user = session?.user || null;
    window.CROW_AUTH_STATE = { session: session || null, user, event };
    window.dispatchEvent(new CustomEvent("crowrules:auth", {
      detail: { event, session: session || null, user }
    }));
    if (window.CrowAccount?.refresh) window.CrowAccount.refresh();
  };

  sb.auth.getSession()
    .then(({ data }) => publish("INITIAL_SESSION", data?.session || null))
    .catch(error => console.warn("CrowRules Podcasting: session bootstrap failed.", error));

  if (!window.CrowAccount) {
    const listeners = new Set();
    let account = { session: null, user: null, profile: null, member: null, creator: null, membership: null, loading: true, lastError: null };
    const notify = () => {
      const snapshot = Object.freeze({ ...account });
      listeners.forEach(fn => { try { fn(snapshot); } catch (e) { console.warn("CrowAccount listener:", e); } });
      window.dispatchEvent(new CustomEvent("crowrules:account", { detail: snapshot }));
    };
    const loadAccount = async (sessionOverride) => {
      const session = sessionOverride === undefined ? account.session : sessionOverride;
      const user = session?.user || null;
      account = { ...account, session: session || null, user, loading: true, lastError: null };
      notify();
      if (!user) {
        account = { ...account, profile: null, member: null, creator: null, membership: null, loading: false };
        notify(); return account;
      }
      try {
        const [pr, mr] = await Promise.all([
          sb.from("podcasting_profiles").select("*").eq("id", user.id).maybeSingle(),
          sb.from("members").select("id,user_id,first_name,last_name,username,email,membership_type,role,status,points,watch_minutes,bio,avatar_url,last_active_at,display_name").eq("user_id", user.id).maybeSingle()
        ]);
        if (pr.error) throw pr.error;
        if (mr.error) throw mr.error;
        const member = mr.data || null;
        let creator = null;
        if (member?.id) {
          const cr = await sb.from("creators").select("id,name,display_name,avatar_url,is_active,role,discipline,member_id").eq("member_id", member.id).maybeSingle();
          if (!cr.error) creator = cr.data || null;
        }
        account = { ...account, profile: pr.data || null, member, creator,
          membership: { type: member?.membership_type || "free", status: member?.status || null, role: member?.role || null, points: Number(member?.points || 0) },
          loading: false };
      } catch (error) { account = { ...account, loading: false, lastError: error }; }
      notify(); return account;
    };
    window.CrowAccount = Object.freeze({
      get: () => ({ ...account }),
      user: () => account.user,
      session: () => account.session,
      profile: () => account.profile,
      membership: () => account.membership,
      creator: () => account.creator,
      isSignedIn: () => !!account.user,
      isCreator: () => !!account.creator?.is_active || !!account.profile?.is_creator,
      refresh: () => loadAccount(),
      onChange: (fn) => { if (typeof fn !== "function") return () => {}; listeners.add(fn); fn({ ...account }); return () => listeners.delete(fn); }
    });
  }

  if (!window.CROW_AUTH_LISTENER_INSTALLED) {
    window.CROW_AUTH_LISTENER_INSTALLED = true;
    sb.auth.onAuthStateChange((event, session) => {
      publish(event, session);
    });
  }
})();
