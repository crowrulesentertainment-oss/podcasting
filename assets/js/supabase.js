/* =========================================================
   CrowRules Podcasting
   Supabase Browser Client
   =========================================================

   IMPORTANT:
   - This file is intended for browser/client-side use.
   - Use ONLY your Supabase publishable key here.
   - NEVER use a service_role or secret key in this file.
   ========================================================= */

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  // Expose configuration for other CrowRules scripts.
  window.CROW_SUPABASE_URL = SUPABASE_URL;
  window.CROW_SUPABASE_PUBLISHABLE_KEY =
    SUPABASE_PUBLISHABLE_KEY;

  /*
   * Make sure Supabase JS was loaded before this file.
   *
   * Your HTML should load:
   *
   * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   * <script src="assets/js/supabase.js"></script>
   */
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

  // Do not create a client without a usable key.
  if (
    !SUPABASE_PUBLISHABLE_KEY ||
    SUPABASE_PUBLISHABLE_KEY ===
      "YOUR_SUPABASE_PUBLISHABLE_KEY"
  ) {
    console.error(
      "CrowRules Podcasting: Supabase publishable key is missing."
    );

    window.crowSupabase = null;

    return;
  }

  try {
    /*
     * Create the single shared Supabase client.
     *
     * Other CrowRules pages can use:
     *
     * const supabase = window.crowSupabase;
     */
    window.crowSupabase =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            flowType: "pkce"
          },
          global: {
            headers: {
              "x-client-info":
                "crowrules-podcasting"
            }
          }
        }
      );

    console.log(
      "CrowRules Podcasting: Supabase initialized."
    );
  } catch (error) {
    console.error(
      "CrowRules Podcasting: Failed to initialize Supabase.",
      error
    );

    window.crowSupabase = null;
  }

  /*
   * Convenience helper used by some existing CrowRules pages.
   *
   * Example:
   *
   * const supabase = await loadSupabase();
   */
  window.loadSupabase = async function () {
    if (!window.crowSupabase) {
      throw new Error(
        "CrowRules Podcasting: Supabase is not initialized."
      );
    }

    return window.crowSupabase;
  };

  /*
   * Authentication helper.
   *
   * Example:
   *
   * const user = await getCurrentUser();
   */
  window.getCurrentUser = async function () {
    if (!window.crowSupabase) {
      return null;
    }

    try {
      const {
        data,
        error
      } = await window.crowSupabase.auth.getUser();

      if (error) {
        console.warn(
          "CrowRules Podcasting: Unable to get current user.",
          error
        );

        return null;
      }

      return data?.user || null;
    } catch (error) {
      console.error(
        "CrowRules Podcasting: Authentication lookup failed.",
        error
      );

      return null;
    }
  };

  /*
   * Simple authentication-state listener.
   *
   * Other pages can optionally use:
   *
   * window.onCrowAuthChange((event, session) => {
   *   console.log(event, session);
   * });
   */
  window.onCrowAuthChange = function (callback) {
    if (
      !window.crowSupabase ||
      typeof callback !== "function"
    ) {
      return null;
    }

    const {
      data: subscription
    } =
      window.crowSupabase.auth.onAuthStateChange(
        callback
      );

    return subscription;
  };
})();