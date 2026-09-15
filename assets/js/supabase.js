(() => {
  "use strict";

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  window.CROW_SUPABASE_URL = SUPABASE_URL;
  window.CROW_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;

  if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
  ) {
    console.error(
      "CrowRules Podcasting: Supabase JS failed to load."
    );

    window.crowSupabase = null;
    return;
  }

  try {
    window.crowSupabase = window.supabase.createClient(
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
      "CrowRules Podcasting: Supabase initialized."
    );
  } catch (error) {
    console.error(
      "CrowRules Podcasting: Supabase initialization failed.",
      error
    );

    window.crowSupabase = null;
  }
})();
