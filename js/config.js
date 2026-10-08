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
  };

  sb.auth.getSession()
    .then(({ data }) => publish("INITIAL_SESSION", data?.session || null))
    .catch(error => console.warn("CrowRules Podcasting: session bootstrap failed.", error));

  if (!window.CROW_AUTH_LISTENER_INSTALLED) {
    window.CROW_AUTH_LISTENER_INSTALLED = true;
    sb.auth.onAuthStateChange((event, session) => {
      publish(event, session);
    });
  }
})();
