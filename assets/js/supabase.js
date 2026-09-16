/* =========================================================
   CrowRules Podcasting
   Supabase Client
   ========================================================= */

(function () {
  "use strict";

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  if (
    typeof window.supabase === "undefined" ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error(
      "CrowRules Podcasting: Supabase JS library failed to load."
    );

    window.supabaseClient = null;
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
      "CrowRules Podcasting: Supabase connected."
    );

  } catch (error) {

    console.error(
      "CrowRules Podcasting: Supabase initialization failed.",
      error
    );

    window.supabaseClient = null;
  }

})();
