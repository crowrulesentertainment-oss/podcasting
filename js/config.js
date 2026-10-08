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
