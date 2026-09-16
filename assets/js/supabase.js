```javascript
/* =========================================================
   CrowRules Podcasting
   Supabase Client
   Project: cevylpnoexugwgygvtgu
   ========================================================= */

(function () {
  "use strict";

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  /*
    IMPORTANT:
    Replace the value below with the PUBLISHABLE KEY from:

    Supabase Dashboard
    → Settings
    → API Keys
    → Publishable key

    It normally starts with:
    sb_publishable_

    Do NOT put your secret/service_role key here.
  */
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  function showConfigError(message) {
    console.error("[CrowRules Supabase]", message);

    window.supabaseClient = null;

    window.dispatchEvent(
      new CustomEvent("supabase-config-error", {
        detail: message
      })
    );
  }

  /*
    Make sure the Supabase CDN library loaded first.
  */
  if (
    typeof window.supabase === "undefined" ||
    typeof window.supabase.createClient !== "function"
  ) {
    showConfigError(
      "Supabase JavaScript library did not load. " +
      "Make sure @supabase/supabase-js is included before assets/js/supabase.js."
    );

    return;
  }

  /*
    Prevent the placeholder from being used.
  */
  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY.includes(
      "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY"
    )
  ) {
    showConfigError(
      "Supabase publishable key has not been configured."
    );

    return;
  }

  try {
    window.supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
          }
        }
      );

    console.log(
      "[CrowRules Supabase] Client initialized successfully."
    );
  } catch (error) {
    console.error(
      "[CrowRules Supabase] Initialization failed:",
      error
    );

    window.supabaseClient = null;

    window.dispatchEvent(
      new CustomEvent("supabase-config-error", {
        detail:
          error && error.message
            ? error.message
            : "Unable to initialize Supabase."
      })
    );
  }
})();
```
