/*
 * CrowRules Podcasting
 * Website-wide Supabase client
 *
 * Location:
 * /assets/js/supabase.js
 *
 * Works from:
 * /login.html
 * /signup.html
 * /creator/dashboard.html
 * /creator/upload-episode.html
 * and other pages throughout the site.
 */

(function () {
  "use strict";

  const SUPABASE_URL =
    "https://cevylpnoexugwgygvtgu.supabase.co";

  /*
   * Browser-safe Supabase publishable key.
   *
   * NEVER put a service_role/secret key in this file.
   */
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_AdfM5y6RqvF3tbvEVzDZSg_JuGTQLD-";

  window.CrowRulesSupabaseConfig = {
    url: SUPABASE_URL,
    key: SUPABASE_PUBLISHABLE_KEY
  };

  function createClient() {
    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {
      console.error(
        "CrowRules: Supabase JavaScript library was not loaded."
      );

      return null;
    }

    try {
      return window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
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
      console.error(
        "CrowRules: Failed to initialize Supabase.",
        error
      );

      return null;
    }
  }

  const client = createClient();

  /*
   * Primary global name.
   */
  window.crowSupabase = client;

  /*
   * Compatibility name used by some older CrowRules pages.
   */
  window.supabaseClient = client;

  /*
   * Legacy compatibility.
   */
  window.Crow = window.Crow || {};

  window.Crow.client = function () {
    return client;
  };

  /*
   * Site-aware path helpers.
   */
  window.CrowRulesPaths = {
    root: function (path) {
      path = String(path || "").replace(/^\/+/, "");

      return (
        window.location.origin +
        "/podcasting/" +
        path
      );
    },

    login: function () {
      return this.root("login.html");
    },

    dashboard: function () {
      return this.root("creator/dashboard.html");
    },

    uploadEpisode: function () {
      return this.root("creator/upload-episode.html");
    }
  };

  /*
   * Helper used by all pages.
   */
  window.CrowRulesAuth = {

    client: function () {
      return (
        window.crowSupabase ||
        window.supabaseClient ||
        null
      );
    },

    async getSession() {
      const client = this.client();

      if (!client) {
        return {
          session: null,
          error: new Error(
            "Supabase client is not configured."
          )
        };
      }

      return await client.auth.getSession();
    },

    async getUser() {
      const client = this.client();

      if (!client) {
        return {
          user: null,
          error: new Error(
            "Supabase client is not configured."
          )
        };
      }

      return await client.auth.getUser();
    },

    async requireUser(options = {}) {
      const {
        redirect = true,
        redirectTo = this.getLoginUrl()
      } = options;

      const result =
        await this.getSession();

      if (result.error) {
        console.error(
          "CrowRules authentication error:",
          result.error
        );

        if (redirect) {
          window.location.replace(
            redirectTo
          );
        }

        return null;
      }

      if (!result.session) {
        if (redirect) {
          window.location.replace(
            redirectTo
          );
        }

        return null;
      }

      return result.session.user;
    },

    getLoginUrl() {
      return window.CrowRulesPaths.login();
    },

    getDashboardUrl() {
      return window.CrowRulesPaths.dashboard();
    },

    getUploadEpisodeUrl() {
      return window.CrowRulesPaths.uploadEpisode();
    },

    async signOut() {
      const client = this.client();

      if (!client) {
        window.location.replace(
          this.getLoginUrl()
        );

        return;
      }

      const { error } =
        await client.auth.signOut();

      if (error) {
        console.error(
          "CrowRules sign-out error:",
          error
        );
      }

      window.location.replace(
        this.getLoginUrl()
      );
    }
  };

  /*
   * Useful diagnostic.
   */
  window.CrowRulesSupabaseReady =
    !!client;

  console.log(
    client
      ? "CrowRules Supabase initialized."
      : "CrowRules Supabase NOT initialized."
  );

})();
