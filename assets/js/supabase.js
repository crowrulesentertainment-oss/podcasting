(function () {
  "use strict";

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error(
      "[CrowRules] Supabase JavaScript library failed to load."
    );
    return;
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY ===
      "YOUR_REAL_PUBLISHABLE_OR_ANON_KEY"
  ) {
    console.error(
      "[CrowRules] Supabase publishable key is missing."
    );

    window.dispatchEvent(
      new Event("supabase-config-error")
    );

    return;
  }

  const client =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

  window.crowSupabase =
    client;

  window.supabaseClient =
    client;

})();
